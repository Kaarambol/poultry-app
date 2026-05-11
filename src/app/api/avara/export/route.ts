import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const cropId = String(body.cropId || "").trim();
    if (!cropId) return NextResponse.json({ error: "cropId is required." }, { status: 400 });

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
        placements: {
          include: { house: true },
          orderBy: [{ houseId: "asc" }, { batchNo: "asc" }],
        },
        daily: {
          orderBy: [{ houseId: "asc" }, { date: "asc" }],
        },
        targetProfile: {
          include: { days: true },
        },
      },
    });

    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canOperate(role)) {
      return NextResponse.json({ error: "No permission to export." }, { status: 403 });
    }

    // ── Houses ────────────────────────────────────────────────────────────────
    const houseMap: Record<string, { id: string; name: string; number: number; birdsPlaced: number }> = {};
    for (const p of crop.placements) {
      if (!houseMap[p.houseId]) {
        const m = String(p.house.name).match(/(\d+)/);
        houseMap[p.houseId] = { id: p.houseId, name: p.house.name, number: m ? Number(m[1]) : 0, birdsPlaced: 0 };
      }
      houseMap[p.houseId].birdsPlaced += p.birdsPlaced;
    }
    const houses = Object.values(houseMap).sort((a, b) => a.number - b.number);

    // ── Annotate daily records with age day ───────────────────────────────────
    const placed = new Date(crop.placementDate);
    const daily = crop.daily.map(r => ({
      ...r,
      ageDay: Math.floor((new Date(r.date).getTime() - placed.getTime()) / 86400000),
    }));

    // ── Target weight lookup map: dayNumber → weightTargetG ──────────────────
    const targetWeightMap: Record<number, number> = {};
    if (crop.targetProfile) {
      for (const d of crop.targetProfile.days) {
        if (d.weightTargetG != null) targetWeightMap[d.dayNumber] = d.weightTargetG;
      }
    }

    // ── Per-house thin / clear day numbers ───────────────────────────────────
    // Each house can have a different thin/clear date — compute from placements.
    const houseThinDay:  Record<string, number | null> = {};
    const houseClearDay: Record<string, number | null> = {};
    for (const h of houses) { houseThinDay[h.id] = null; houseClearDay[h.id] = null; }

    for (const p of crop.placements) {
      if (p.thinDate) {
        const d = Math.floor((new Date(p.thinDate).getTime() - placed.getTime()) / 86400000);
        if (houseThinDay[p.houseId] === null || d < houseThinDay[p.houseId]!)
          houseThinDay[p.houseId] = d;
      }
      if (p.clearDate) {
        const d = Math.floor((new Date(p.clearDate).getTime() - placed.getTime()) / 86400000);
        if (houseClearDay[p.houseId] === null || d > houseClearDay[p.houseId]!)
          houseClearDay[p.houseId] = d;
      }
    }

    const anyThin  = Object.values(houseThinDay).some(d => d !== null);
    const anyClear = Object.values(houseClearDay).some(d => d !== null);

    // ── Stages ───────────────────────────────────────────────────────────────
    // weightOnly = true → show only weight + CDMR, no period mortality columns
    // THIN / CLEAR use per-house effective days inside the house loop.
    type Stage = { key: string; label: string; fromDay: number; toDay: number; weightOnly: boolean };

    const STAGES: Stage[] = [
      { key: "DAY_3",  label: "Day 3",  fromDay: 1,  toDay: 3,  weightOnly: false },
      { key: "DAY_7",  label: "Day 7",  fromDay: 4,  toDay: 7,  weightOnly: false },
      { key: "DAY_14", label: "Day 14", fromDay: 8,  toDay: 14, weightOnly: false },
      { key: "DAY_21", label: "Day 21", fromDay: 15, toDay: 21, weightOnly: false },
      // Day 26: single-day snapshot — weight and CDMR only, no period mortality
      { key: "DAY_26", label: "Day 26", fromDay: 26, toDay: 26, weightOnly: true  },
      // Day 28: full period 22–28
      { key: "DAY_28", label: "Day 28", fromDay: 22, toDay: 28, weightOnly: false },
    ];

    if (anyThin || anyClear) {
      // THIN: 29 → each house's own thin day
      STAGES.push({ key: "THIN",  label: "Thin",  fromDay: 29, toDay: 9999, weightOnly: false });
      // CLEAR: each house's thin+1 → each house's own clear day
      STAGES.push({ key: "CLEAR", label: "Clear", fromDay: 29, toDay: 9999, weightOnly: false });
    }

    // ── Helper: cumulative CDMR for a house up to a given day ─────────────────
    // Independent per-stage — no shared accumulator, so DAY_26 and DAY_28 don't conflict.
    const getCdmr = (houseId: string, upToDay: number, birdsPlaced: number): number => {
      const recs = daily.filter(r => r.houseId === houseId && r.ageDay <= upToDay);
      const totMort  = recs.reduce((s, r) => s + r.mort, 0);
      const totCulls = recs.reduce((s, r) => s + r.cullsSmall + r.cullsLeg, 0);
      return birdsPlaced > 0 ? (totMort + totCulls) / birdsPlaced * 100 : 0;
    };

    // ── Build stage blocks ────────────────────────────────────────────────────
    type Row = {
      houseName: string;
      birdsPlaced: number;
      mort: number;
      cullsSmall: number;
      cullsLeg: number;
      weight: number | null;
      weightPct: number | null;
      periodLossPct: number;
      cdmr: number;
      weightOnly: boolean;
    };

    type StageBlock = { key: string; label: string; fromDay: number; toDay: number; rows: Row[] };
    const blocks: StageBlock[] = [];

    for (const stage of STAGES) {
      const rows: Row[] = [];

      for (const house of houses) {
        // For THIN/CLEAR: use each house's own dates
        let effectiveFromDay = stage.fromDay;
        let effectiveToDay   = stage.toDay;

        if (stage.key === "THIN") {
          effectiveFromDay = 29;
          effectiveToDay   = houseThinDay[house.id] ?? 9999;
        } else if (stage.key === "CLEAR") {
          const hThin      = houseThinDay[house.id];
          effectiveFromDay = hThin !== null ? hThin + 1 : 29;
          effectiveToDay   = houseClearDay[house.id] ?? 9999;
        }

        const recs = daily.filter(r =>
          r.houseId === house.id && r.ageDay >= effectiveFromDay && r.ageDay <= effectiveToDay
        );

        // For weightOnly stages (Day 26) don't sum period mortality
        const mort       = stage.weightOnly ? 0 : recs.reduce((s, r) => s + r.mort,       0);
        const cullsSmall = stage.weightOnly ? 0 : recs.reduce((s, r) => s + r.cullsSmall, 0);
        const cullsLeg   = stage.weightOnly ? 0 : recs.reduce((s, r) => s + r.cullsLeg,   0);

        let weight: number | null = null;
        if (effectiveToDay >= 9000 || stage.key === "CLEAR") {
          // Clearance or open-ended: take last available weight record in the period
          for (const r of recs) {
            if (r.avgWeightG != null) weight = r.avgWeightG / 1000;
          }
        } else {
          const weightRec = daily.find(r => r.houseId === house.id && r.ageDay === effectiveToDay + 1);
          if (weightRec?.avgWeightG != null) weight = weightRec.avgWeightG / 1000;
        }

        const allCulls      = cullsSmall + cullsLeg;
        const totalLoss     = mort + allCulls;
        const periodLossPct = stage.weightOnly ? 0 : (house.birdsPlaced > 0 ? (totalLoss / house.birdsPlaced) * 100 : 0);

        // CDMR: cumulative up to the effective last day of this stage (per-house)
        const cdmr = getCdmr(house.id, effectiveToDay, house.birdsPlaced);

        // Weight %: compare to target for the stage's end day (toDay), not toDay+1
        const targetWeightG = stage.toDay < 9000 ? (targetWeightMap[stage.toDay] ?? null) : null;
        const weightPct     = weight != null && targetWeightG != null ? (weight * 1000 / targetWeightG) * 100 : null;

        rows.push({ houseName: house.name, birdsPlaced: house.birdsPlaced, mort, cullsSmall, cullsLeg, weight, weightPct, periodLossPct, cdmr, weightOnly: stage.weightOnly });
      }

      blocks.push({ key: stage.key, label: stage.label, fromDay: stage.fromDay, toDay: stage.toDay, rows });
    }

    // ── Build Excel ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "Poultry App";
    const ws = wb.addWorksheet("Weekly Return");

    ws.columns = [
      { key: "house",     width: 16 },
      { key: "placed",    width: 13 },
      { key: "mort",      width: 9  },
      { key: "cullsSm",   width: 11 },
      { key: "cullsLeg",  width: 11 },
      { key: "weight",    width: 10 },
      { key: "weightPct", width: 11 },
      { key: "periodPct", width: 12 },
      { key: "cdmr",      width: 10 },
    ];

    const NCOLS = 9;
    const BG_NAVY   = "FF1B3A5C";
    const BG_HEADER = "FFD9E8F5";
    const BG_TOTAL  = "FFEDEDED";
    const BG_EVEN   = "FFFAFCFF";
    const FG_WHITE  = "FFFFFFFF";
    const FG_NAVY   = "FF1B3A5C";

    function mergedHeader(text: string, bgArgb: string, fgArgb: string, size = 11) {
      const r = ws.addRow([text]);
      ws.mergeCells(r.number, 1, r.number, NCOLS);
      const c = r.getCell(1);
      c.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      c.font   = { bold: true, size, color: { argb: fgArgb } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      r.height = size === 14 ? 28 : 22;
      return r;
    }

    // Farm / crop title
    mergedHeader(`${crop.farm.name}  |  Crop: ${crop.cropNumber}  |  Placed: ${new Date(crop.placementDate).toLocaleDateString("en-GB")}  |  Breed: ${crop.breed || "—"}`, BG_NAVY, FG_WHITE, 12);
    mergedHeader(`Farm code: ${crop.farm.code}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`, "FFF0F4F9", FG_NAVY, 10);

    ws.addRow([]); // spacer

    for (const block of blocks) {
      const periodLabel =
        block.key === "THIN"  ? "Days 29 – Thin (per house)" :
        block.key === "CLEAR" ? "Thin+1 – Clear (per house)" :
        block.toDay >= 9000   ? `Days ${block.fromDay} to end` :
                                `Days ${block.fromDay} – ${block.toDay}`;

      // Stage title
      mergedHeader(`${block.label}  ·  ${periodLabel}`, BG_NAVY, FG_WHITE, 11);

      // Column headers
      const hdr = ws.addRow(["House", "Birds\nPlaced", "Mort", "Culls\nSmall", "Culls\nLeg", "Weight\n(kg)", "Weight\n%", "Period\nLoss %", "CDMR\n%"]);
      hdr.height = 32;
      hdr.eachCell((cell, col) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BG_HEADER } };
        cell.font      = { bold: true, size: 9, color: { argb: FG_NAVY } };
        cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle", wrapText: true };
        cell.border    = {
          top:    { style: "thin", color: { argb: "FFB8CCE0" } },
          bottom: { style: "thin", color: { argb: "FFB8CCE0" } },
          left:   { style: "thin", color: { argb: "FFB8CCE0" } },
          right:  { style: "thin", color: { argb: "FFB8CCE0" } },
        };
      });

      // Data rows
      let totMort = 0, totCullsSm = 0, totCullsLeg = 0, totBirds = 0;
      const isWeightOnly = block.rows.some(r => r.weightOnly);

      block.rows.forEach((r, i) => {
        totMort    += r.mort;
        totCullsSm += r.cullsSmall;
        totCullsLeg += r.cullsLeg;
        totBirds   += r.birdsPlaced;

        const dr = ws.addRow([
          r.houseName,
          r.birdsPlaced,
          r.weightOnly ? "" : (r.mort       || ""),
          r.weightOnly ? "" : (r.cullsSmall || ""),
          r.weightOnly ? "" : (r.cullsLeg   || ""),
          r.weight !== null ? r.weight : "",
          r.weightPct !== null ? r.weightPct : "",
          r.weightOnly ? "" : r.periodLossPct,
          r.cdmr,
        ]);

        dr.eachCell((cell, col) => {
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? BG_EVEN : "FFFFFFFF" } };
          cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
          cell.border    = {
            left:   { style: "hair", color: { argb: "FFD0D8E8" } },
            right:  { style: "hair", color: { argb: "FFD0D8E8" } },
            bottom: { style: "hair", color: { argb: "FFD0D8E8" } },
          };
          cell.font = { size: 10 };
        });

        if (r.weight !== null) dr.getCell(6).numFmt = "0.000";
        if (r.weightPct !== null) dr.getCell(7).numFmt = "0.00";
        if (!r.weightOnly) dr.getCell(8).numFmt = "0.0000";
        dr.getCell(9).numFmt = "0.0000";
      });

      // Total row
      const totalPct  = totBirds > 0 ? ((totMort + totCullsSm + totCullsLeg) / totBirds) * 100 : 0;
      const totalCdmr = totBirds > 0
        ? block.rows.reduce((s, r) => s + (r.cdmr / 100) * r.birdsPlaced, 0) / totBirds * 100
        : 0;

      const tr = ws.addRow([
        "TOTAL", totBirds,
        isWeightOnly ? "" : (totMort    || ""),
        isWeightOnly ? "" : (totCullsSm || ""),
        isWeightOnly ? "" : (totCullsLeg || ""),
        "", "",
        isWeightOnly ? "" : totalPct,
        totalCdmr,
      ]);
      tr.eachCell((cell, col) => {
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: BG_TOTAL } };
        cell.font   = { bold: true, size: 10 };
        cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
        cell.border = {
          top:    { style: "medium", color: { argb: "FF9EB4CC" } },
          bottom: { style: "medium", color: { argb: "FF9EB4CC" } },
          left:   { style: "thin",   color: { argb: "FFD0D8E8" } },
          right:  { style: "thin",   color: { argb: "FFD0D8E8" } },
        };
      });
      if (!isWeightOnly) tr.getCell(8).numFmt = "0.0000";
      tr.getCell(9).numFmt = "0.0000";

      ws.addRow([]); // blank separator between stages
    }

    // ── Write to /tmp, read back, return as download ─────────────────────────
    const os       = require("os") as typeof import("os");
    const fileName = `avara-${crop.cropNumber}-${Date.now()}.xlsx`;
    const tmpPath  = path.join(os.tmpdir(), fileName);

    await wb.xlsx.writeFile(tmpPath);
    const fileBuffer = fs.readFileSync(tmpPath);
    try { fs.unlinkSync(tmpPath); } catch {}

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("AVARA EXPORT ERROR:", error);
    return NextResponse.json({ error: error?.message || "Server error while exporting." }, { status: 500 });
  }
}

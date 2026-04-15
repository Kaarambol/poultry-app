import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// Period day ranges for each stage
const STAGES = [
  { key: "DAY_3",       label: "Day 3",        fromDay: 1,  toDay: 3    },
  { key: "DAY_7",       label: "Day 7",         fromDay: 4,  toDay: 7    },
  { key: "DAY_14",      label: "Day 14",        fromDay: 8,  toDay: 14   },
  { key: "DAY_21",      label: "Day 21",        fromDay: 15, toDay: 21   },
  { key: "DAY_26",      label: "Day 26",        fromDay: 22, toDay: 26   },
  { key: "DAY_28",      label: "Day 28",        fromDay: 27, toDay: 28   },
  { key: "THIN_35",     label: "Thin / Day 35", fromDay: 29, toDay: 35   },
  { key: "TOTAL_CLEAR", label: "Total Clear",   fromDay: 36, toDay: 9999 },
] as const;

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
      ageDay: Math.floor((new Date(r.date).getTime() - placed.getTime()) / 86400000) + 1,
    }));

    // ── Per-house cumulative trackers for CDMR ────────────────────────────────
    const cumMort:  Record<string, number> = {};
    const cumCulls: Record<string, number> = {};
    for (const h of houses) { cumMort[h.id] = 0; cumCulls[h.id] = 0; }

    type Row = {
      houseName: string;
      birdsPlaced: number;
      mort: number;
      cullsSmall: number;
      cullsLeg: number;
      weight: number | null;
      periodLossPct: number;
      cdmr: number;
    };

    type StageBlock = { label: string; fromDay: number; toDay: number; rows: Row[] };
    const blocks: StageBlock[] = [];

    for (const stage of STAGES) {
      const rows: Row[] = [];

      for (const house of houses) {
        const recs = daily.filter(r =>
          r.houseId === house.id && r.ageDay >= stage.fromDay && r.ageDay <= stage.toDay
        );

        const mort       = recs.reduce((s, r) => s + r.mort,       0);
        const cullsSmall = recs.reduce((s, r) => s + r.cullsSmall, 0);
        const cullsLeg   = recs.reduce((s, r) => s + r.cullsLeg,   0);
        const otherCulls = recs.reduce((s, r) => s + r.culls,      0);

        let weight: number | null = null;
        for (const r of recs) {
          if (r.avgWeightG != null) weight = r.avgWeightG / 1000;
        }

        const allCulls = cullsSmall + cullsLeg + otherCulls;
        cumMort[house.id]  += mort;
        cumCulls[house.id] += allCulls;

        const totalLoss    = mort + allCulls;
        const periodLossPct = house.birdsPlaced > 0 ? (totalLoss      / house.birdsPlaced) * 100 : 0;
        const cdmr          = house.birdsPlaced > 0 ? ((cumMort[house.id] + cumCulls[house.id]) / house.birdsPlaced) * 100 : 0;

        rows.push({ houseName: house.name, birdsPlaced: house.birdsPlaced, mort, cullsSmall, cullsLeg, weight, periodLossPct, cdmr });
      }

      blocks.push({ label: stage.label, fromDay: stage.fromDay, toDay: stage.toDay, rows });
    }

    // ── Build Excel ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "Poultry App";
    const ws = wb.addWorksheet("Weekly Return");

    ws.columns = [
      { key: "house",    width: 16 },
      { key: "placed",   width: 13 },
      { key: "mort",     width: 9  },
      { key: "cullsSm",  width: 11 },
      { key: "cullsLeg", width: 11 },
      { key: "weight",   width: 10 },
      { key: "periodPct",width: 12 },
      { key: "cdmr",     width: 10 },
    ];

    const NCOLS = 8;
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
      const periodLabel = block.toDay === 9999
        ? `Days ${block.fromDay} to end`
        : `Days ${block.fromDay} – ${block.toDay}`;

      // Stage title
      mergedHeader(`${block.label}  ·  ${periodLabel}`, BG_NAVY, FG_WHITE, 11);

      // Column headers
      const hdr = ws.addRow(["House", "Birds\nPlaced", "Mort", "Culls\nSmall", "Culls\nLeg", "Weight\n(kg)", "Period\nLoss %", "CDMR\n%"]);
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

      block.rows.forEach((r, i) => {
        totMort      += r.mort;
        totCullsSm   += r.cullsSmall;
        totCullsLeg  += r.cullsLeg;
        totBirds     += r.birdsPlaced;

        const dr = ws.addRow([
          r.houseName,
          r.birdsPlaced,
          r.mort       || "",
          r.cullsSmall || "",
          r.cullsLeg   || "",
          r.weight !== null ? r.weight : "",
          r.periodLossPct,
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
          cell.font      = { size: 10 };
        });

        if (r.weight !== null) {
          dr.getCell(6).numFmt = "0.000";
        }
        dr.getCell(7).numFmt = "0.0000";
        dr.getCell(8).numFmt = "0.0000";
      });

      // Total row
      const totalPct  = totBirds > 0 ? ((totMort + totCullsSm + totCullsLeg) / totBirds) * 100 : 0;
      // CDMR for total: weighted average from the last stage rows
      const totalCdmr = totBirds > 0
        ? block.rows.reduce((s, r) => s + (r.cdmr / 100) * r.birdsPlaced, 0) / totBirds * 100
        : 0;

      const tr = ws.addRow(["TOTAL", totBirds, totMort || "", totCullsSm || "", totCullsLeg || "", "", totalPct, totalCdmr]);
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
      tr.getCell(7).numFmt = "0.0000";
      tr.getCell(8).numFmt = "0.0000";

      ws.addRow([]); // blank separator between stages
    }

    // ── Write to /tmp, read back, return as download ─────────────────────────
    const os       = require("os") as typeof import("os");
    const fileName = `avara-${crop.cropNumber}-${Date.now()}.xlsx`;
    const tmpPath  = path.join(os.tmpdir(), fileName);

    await wb.xlsx.writeFile(tmpPath);
    const fileBuffer = fs.readFileSync(tmpPath);
    try { fs.unlinkSync(tmpPath); } catch {}

    await prisma.avaraExport.create({
      data: { cropId: crop.id, stage: "FULL_REPORT", fileName, filePath: "" },
    });

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

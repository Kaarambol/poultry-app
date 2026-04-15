import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const cropId  = req.nextUrl.searchParams.get("cropId");
    const houseId = req.nextUrl.searchParams.get("houseId");
    if (!cropId || !houseId) return NextResponse.json({ error: "Missing cropId or houseId" }, { status: 400 });

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
        placements: { where: { houseId } },   // all batches for this house
      },
    });
    if (!crop) return NextResponse.json({ error: "Crop not found" }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canView(role)) return NextResponse.json({ error: "No permission" }, { status: 403 });

    const house = await prisma.house.findUnique({ where: { id: houseId } });

    // Sum ALL batches for this house
    const birdsPlaced = crop.placements.reduce((sum, p) => sum + p.birdsPlaced, 0);

    const allRecords = await prisma.dailyRecord.findMany({
      where: { cropId, houseId },
      orderBy: { date: "asc" },
    });

    const totalLosses = allRecords.reduce((sum, r) => sum + (r.mort || 0) + (r.culls || 0), 0);
    const birdsAlive  = birdsPlaced - totalLosses;

    const startDate   = new Date(crop.placementDate);
    // Age consistent with dashboard: placement day = day 0; read from last daily record if available
    const lastRecord  = allRecords.length > 0 ? allRecords[allRecords.length - 1] : null;
    const ageRefDate  = lastRecord ? new Date(lastRecord.date) : new Date();
    const ageDaysToday = Math.floor((ageRefDate.getTime() - startDate.getTime()) / 86400000);
    const last7        = allRecords.slice(-7);

    // ── Build Excel ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vet Report");

    ws.columns = [
      { width: 28 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
    ];

    const BG_NAVY  = "FF1B3A5C";
    const FG_WHITE = "FFFFFFFF";
    const FG_NAVY  = "FF1B3A5C";
    const NCOLS    = 4;

    // Title
    const titleRow = ws.addRow(["VETERINARY REPORT (LAST 7 DAYS)"]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, NCOLS);
    titleRow.getCell(1).fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BG_NAVY } };
    titleRow.getCell(1).font      = { bold: true, size: 13, color: { argb: FG_WHITE } };
    titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 28;

    ws.addRow([]);

    // Info rows
    const infoRows: [string, string | number][] = [
      ["Farm",               crop.farm.name],
      ["House",              house?.name || houseId],
      ["Crop Number",        crop.cropNumber],
      ["Arrival Date",       startDate.toLocaleDateString("en-GB")],
      ["Birds Placed",       birdsPlaced],
      ["Current Birds Alive",birdsAlive],
      ["Current Age",        `${ageDaysToday} days`],
    ];
    for (const [label, value] of infoRows) {
      const r = ws.addRow([label, value]);
      r.getCell(1).font = { bold: true, size: 10, color: { argb: FG_NAVY } };
      r.getCell(2).font = { size: 10 };
      r.height = 18;
    }

    ws.addRow([]);

    // Table header
    const hdr = ws.addRow(["Date", "Water (L)", "Mortality (Dead)", "Culls (Selection)"]);
    hdr.height = 22;
    hdr.eachCell((cell) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E8F5" } };
      cell.font      = { bold: true, size: 10, color: { argb: FG_NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border    = {
        top: { style: "thin", color: { argb: "FFB8CCE0" } },
        bottom: { style: "thin", color: { argb: "FFB8CCE0" } },
        left: { style: "thin", color: { argb: "FFB8CCE0" } },
        right: { style: "thin", color: { argb: "FFB8CCE0" } },
      };
    });

    // Data rows
    last7.forEach((r, i) => {
      const row = ws.addRow([
        new Date(r.date).toLocaleDateString("en-GB"),
        r.waterL || 0,
        r.mort   || 0,
        r.culls  || 0,
      ]);
      row.height = 18;
      row.eachCell((cell) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFFAFCFF" : "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font      = { size: 10 };
        cell.border    = {
          left:   { style: "hair", color: { argb: "FFD0D8E8" } },
          right:  { style: "hair", color: { argb: "FFD0D8E8" } },
          bottom: { style: "hair", color: { argb: "FFD0D8E8" } },
        };
      });
    });

    // Write to /tmp, read back, return
    const fileName = `Vet-Report-${house?.name || "house"}-${Date.now()}.xlsx`;
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
    console.error("VET REPORT ERROR:", error);
    return NextResponse.json({ error: error?.message || "Server error while generating report." }, { status: 500 });
  }
}
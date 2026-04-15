import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";

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
        placements: {
          include: { house: true },
          orderBy: [{ houseId: "asc" }, { batchNo: "asc" }],
        },
      },
    });

    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });

    const farm = await prisma.farm.findUnique({ where: { id: crop.farmId } });
    if (!farm) return NextResponse.json({ error: "Farm not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canView(role)) return NextResponse.json({ error: "No permission." }, { status: 403 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Placement Information");

    ws.columns = [
      { width: 16 },
      { width: 9  },
      { width: 14 },
      { width: 16 },
      { width: 13 },
      { width: 14 },
      { width: 22 },
    ];

    const BG_NAVY   = "FF1B3A5C";
    const BG_HEADER = "FFD9E8F5";
    const BG_EVEN   = "FFFAFCFF";
    const FG_WHITE  = "FFFFFFFF";
    const FG_NAVY   = "FF1B3A5C";
    const NCOLS     = 7;

    const addTitle = (text: string, bg: string, fg: string, sz: number) => {
      const row = ws.addRow([text]);
      ws.mergeCells(row.number, 1, row.number, NCOLS);
      const cell = row.getCell(1);
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font      = { bold: true, size: sz, color: { argb: fg } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      row.height     = 24;
    };

    addTitle(
      `${farm.name}  |  Crop: ${crop.cropNumber}  |  Placed: ${new Date(crop.placementDate).toLocaleDateString("en-GB")}  |  Breed: ${crop.breed || "—"}`,
      BG_NAVY, FG_WHITE, 12
    );
    addTitle(
      `Farm code: ${farm.code}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`,
      "FFF0F4F9", FG_NAVY, 10
    );
    ws.addRow([]);
    addTitle("Placement Information", BG_NAVY, FG_WHITE, 11);

    const hdr = ws.addRow(["House", "Batch No", "Placement Date", "Flock Number", "Birds Placed", "Parent Age (wks)", "Hatchery"]);
    hdr.height = 26;
    hdr.eachCell((cell, col) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BG_HEADER } };
      cell.font      = { bold: true, size: 9, color: { argb: FG_NAVY } };
      cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
      cell.border    = {
        top:    { style: "thin", color: { argb: "FFB8CCE0" } },
        bottom: { style: "thin", color: { argb: "FFB8CCE0" } },
        left:   { style: "thin", color: { argb: "FFB8CCE0" } },
        right:  { style: "thin", color: { argb: "FFB8CCE0" } },
      };
    });

    const sorted = [...crop.placements].sort((a, b) => {
      const hc = a.house.name.localeCompare(b.house.name, undefined, { numeric: true, sensitivity: "base" });
      return hc !== 0 ? hc : a.batchNo - b.batchNo;
    });

    let totalBirds = 0;
    sorted.forEach((p, i) => {
      totalBirds += p.birdsPlaced;
      const row = ws.addRow([
        p.house.name,
        p.batchNo,
        new Date(p.placementDate).toLocaleDateString("en-GB"),
        p.flockNumber    || "—",
        p.birdsPlaced,
        p.parentAgeWeeks != null ? p.parentAgeWeeks : "—",
        p.hatchery       || "—",
      ]);
      row.eachCell((cell, col) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? BG_EVEN : "FFFFFFFF" } };
        cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
        cell.border    = {
          left:   { style: "hair", color: { argb: "FFD0D8E8" } },
          right:  { style: "hair", color: { argb: "FFD0D8E8" } },
          bottom: { style: "hair", color: { argb: "FFD0D8E8" } },
        };
        cell.font = { size: 10 };
      });
      row.getCell(5).font = { bold: true, size: 10 };
    });

    const totRow = ws.addRow(["TOTAL", "", "", "", totalBirds, "", ""]);
    totRow.eachCell((cell, col) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
      cell.font      = { bold: true, size: 10 };
      cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle" };
      cell.border    = {
        top:    { style: "medium", color: { argb: "FF9EB4CC" } },
        bottom: { style: "medium", color: { argb: "FF9EB4CC" } },
        left:   { style: "thin",   color: { argb: "FFD0D8E8" } },
        right:  { style: "thin",   color: { argb: "FFD0D8E8" } },
      };
    });

    // Write to /tmp (writable on Vercel), read back, delete
    const fileName = `placement-${crop.cropNumber}-${Date.now()}.xlsx`;
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

  } catch (err: any) {
    console.error("PLACEMENT EXPORT ERROR:", err);
    return NextResponse.json({ error: err?.message || "Server error while exporting." }, { status: 500 });
  }
}

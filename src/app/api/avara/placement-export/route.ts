import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";
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
      },
    });

    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canView(role)) {
      return NextResponse.json({ error: "No permission." }, { status: 403 });
    }

    // ── Build Excel ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "Poultry App";
    const ws = wb.addWorksheet("Placement Information");

    const NCOLS = 7;
    const BG_NAVY   = "FF1B3A5C";
    const BG_HEADER = "FFD9E8F5";
    const BG_EVEN   = "FFFAFCFF";
    const FG_WHITE  = "FFFFFFFF";
    const FG_NAVY   = "FF1B3A5C";

    ws.columns = [
      { key: "house",       width: 16 },
      { key: "batch",       width: 9  },
      { key: "date",        width: 14 },
      { key: "flock",       width: 16 },
      { key: "birds",       width: 13 },
      { key: "parentAge",   width: 14 },
      { key: "hatchery",    width: 22 },
    ];

    function mergedHeader(text: string, bgArgb: string, fgArgb: string, size = 11) {
      const r = ws.addRow([text]);
      ws.mergeCells(r.number, 1, r.number, NCOLS);
      const c = r.getCell(1);
      c.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      c.font      = { bold: true, size, color: { argb: fgArgb } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      r.height    = 24;
      return r;
    }

    // Title rows
    mergedHeader(
      `${crop.farm.name}  |  Crop: ${crop.cropNumber}  |  Placed: ${new Date(crop.placementDate).toLocaleDateString("en-GB")}  |  Breed: ${crop.breed || "—"}`,
      BG_NAVY, FG_WHITE, 12
    );
    mergedHeader(
      `Farm code: ${crop.farm.code}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`,
      "FFF0F4F9", FG_NAVY, 10
    );

    ws.addRow([]); // spacer

    // Section header
    mergedHeader("Placement Information", BG_NAVY, FG_WHITE, 11);

    // Column headers
    const hdr = ws.addRow(["House", "Batch\nNo", "Placement\nDate", "Flock\nNumber", "Birds\nPlaced", "Parent Age\n(weeks)", "Hatchery"]);
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

    // Sort placements: by house name (numeric-aware), then batch number
    const sorted = [...crop.placements].sort((a, b) => {
      const hCmp = a.house.name.localeCompare(b.house.name, undefined, { numeric: true, sensitivity: "base" });
      return hCmp !== 0 ? hCmp : a.batchNo - b.batchNo;
    });

    sorted.forEach((p, i) => {
      const dr = ws.addRow([
        p.house.name,
        p.batchNo,
        new Date(p.placementDate).toLocaleDateString("en-GB"),
        p.flockNumber  || "—",
        p.birdsPlaced,
        p.parentAgeWeeks != null ? p.parentAgeWeeks : "—",
        p.hatchery     || "—",
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
      // Birds placed right-aligned bold
      dr.getCell(5).font = { bold: true, size: 10 };
    });

    // Totals row
    const totalBirds = sorted.reduce((s, p) => s + p.birdsPlaced, 0);
    const tr = ws.addRow(["TOTAL", "", "", "", totalBirds, "", ""]);
    tr.eachCell((cell, col) => {
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

    // ── Save ──────────────────────────────────────────────────────────────────
    const exportDir  = path.join(process.cwd(), "public", "exports");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    const fileName     = `placement-${crop.cropNumber}-${Date.now()}.xlsx`;
    const fullPath     = path.join(exportDir, fileName);
    const relativePath = `/exports/${fileName}`;

    await wb.xlsx.writeFile(fullPath);

    return NextResponse.json({ ok: true, fileName, filePath: relativePath });
  } catch (error) {
    console.error("PLACEMENT EXPORT ERROR:", error);
    return NextResponse.json({ error: "Server error while exporting." }, { status: 500 });
  }
}

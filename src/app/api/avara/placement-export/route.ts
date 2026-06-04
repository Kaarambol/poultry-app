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

    const BG_NAVY   = "FF1B3A5C";
    const BG_HEADER = "FFD9E8F5";
    const BG_LABEL  = "FFF0F4F9";
    const FG_WHITE  = "FFFFFFFF";
    const FG_NAVY   = "FF1B3A5C";

    const sorted = [...crop.placements].sort((a, b) => {
      const hc = a.house.name.localeCompare(b.house.name, undefined, { numeric: true, sensitivity: "base" });
      return hc !== 0 ? hc : a.batchNo - b.batchNo;
    });

    const NCOLS = 1 + sorted.length;

    // Column widths: label col + one per placement
    ws.getColumn(1).width = 20;
    sorted.forEach((_, i) => { ws.getColumn(i + 2).width = 18; });

    // Title rows
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

    // Header row: blank label cell + house names
    const hdrRow = ws.addRow(["", ...sorted.map(p => p.house.name)]);
    hdrRow.height = 28;
    hdrRow.eachCell((cell, col) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: col === 1 ? BG_LABEL : BG_HEADER } };
      cell.font      = { bold: true, size: 10, color: { argb: FG_NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border    = {
        top:    { style: "thin", color: { argb: "FFB8CCE0" } },
        bottom: { style: "thin", color: { argb: "FFB8CCE0" } },
        left:   { style: "thin", color: { argb: "FFB8CCE0" } },
        right:  { style: "thin", color: { argb: "FFB8CCE0" } },
      };
    });

    // Helper to add a data row
    const addDataRow = (label: string, values: (string | number)[], rowIdx: number) => {
      const row = ws.addRow([label, ...values]);
      row.height = 20;
      row.eachCell((cell, col) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col === 1 ? BG_LABEL : (rowIdx % 2 === 0 ? "FFFAFCFF" : "FFFFFFFF") } };
        cell.font = { bold: col === 1, size: 10, color: { argb: FG_NAVY } };
        cell.alignment = { horizontal: col === 1 ? "left" : "center", vertical: "middle", wrapText: col > 1 };
        cell.border = {
          left:   { style: "hair", color: { argb: "FFD0D8E8" } },
          right:  { style: "hair", color: { argb: "FFD0D8E8" } },
          bottom: { style: "hair", color: { argb: "FFD0D8E8" } },
        };
      });
    };

    // Data rows — one field per row, one house per column
    addDataRow("Batch No",           sorted.map(p => p.batchNo), 0);
    addDataRow("Placement Date",     sorted.map(p => new Date(p.placementDate).toLocaleDateString("en-GB")), 1);
    addDataRow("Flock Number",       sorted.map(p => p.flockNumber || "—"), 2);
    addDataRow("Birds Placed",       sorted.map(p => p.birdsPlaced), 3);
    addDataRow("Parent Age (wks)",   sorted.map(p => p.parentAgeWeeks != null ? p.parentAgeWeeks : "—"), 4);
    addDataRow("Hatchery",           sorted.map(p => p.hatchery || "—"), 5);
    addDataRow("Notes",              sorted.map(p => p.notes || "—"), 6);

    // Total row
    const totRow = ws.addRow(["TOTAL BIRDS", ...sorted.map(p => p.birdsPlaced)]);
    totRow.height = 22;
    totRow.eachCell((cell, col) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
      cell.font      = { bold: true, size: 10, color: { argb: FG_NAVY } };
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

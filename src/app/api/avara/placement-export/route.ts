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
    const BG_EVEN   = "FFFAFCFF";
    const FG_WHITE  = "FFFFFFFF";
    const FG_NAVY   = "FF1B3A5C";
    const NCOLS     = 6; // Batch No | Notes | Birds Placed | Parent Age | Flock # | Hatchery

    // Column widths
    ws.getColumn(1).width = 10; // Batch No
    ws.getColumn(2).width = 28; // Notes
    ws.getColumn(3).width = 14; // Birds Placed
    ws.getColumn(4).width = 16; // Parent Age
    ws.getColumn(5).width = 16; // Flock #
    ws.getColumn(6).width = 20; // Hatchery

    // Group placements by house
    const byHouse = new Map<string, typeof crop.placements>();
    for (const p of crop.placements) {
      const key = p.house.name;
      if (!byHouse.has(key)) byHouse.set(key, []);
      byHouse.get(key)!.push(p);
    }
    // Sort houses naturally
    const houseNames = [...byHouse.keys()].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    // Sort batches within each house
    for (const [key, batches] of byHouse) {
      byHouse.set(key, batches.sort((a, b) => a.batchNo - b.batchNo));
    }

    const styleCell = (cell: ExcelJS.Cell, opts: { bg?: string; bold?: boolean; sz?: number; fg?: string; hAlign?: ExcelJS.Alignment["horizontal"] }) => {
      if (opts.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
      cell.font = { bold: opts.bold ?? false, size: opts.sz ?? 10, color: { argb: opts.fg ?? FG_NAVY } };
      cell.alignment = { horizontal: opts.hAlign ?? "center", vertical: "middle", wrapText: true };
    };

    const border = (cell: ExcelJS.Cell, style: ExcelJS.BorderStyle = "thin") => {
      const c = { style, color: { argb: "FFB8CCE0" } } as ExcelJS.Border;
      cell.border = { top: c, bottom: c, left: c, right: c };
    };

    // Global title
    const titleRow = ws.addRow([`${farm.name}  |  Crop: ${crop.cropNumber}  |  Breed: ${crop.breed || "—"}  |  Generated: ${new Date().toLocaleDateString("en-GB")}`]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, NCOLS);
    styleCell(titleRow.getCell(1), { bg: BG_NAVY, bold: true, sz: 12, fg: FG_WHITE, hAlign: "center" });
    titleRow.height = 24;

    ws.addRow([]);

    // One table per house
    for (const houseName of houseNames) {
      const batches = byHouse.get(houseName)!;
      const placementDate = new Date(batches[0].placementDate).toLocaleDateString("en-GB");
      const hasNotes = batches.some(p => p.notes && p.notes.trim() !== "");

      // Dynamic columns: with or without Notes
      const cols = hasNotes
        ? ["Batch No", "Notes", "Birds Placed", "Parent Age (wks)", "Flock Number", "Hatchery"]
        : ["Batch No", "Birds Placed", "Parent Age (wks)", "Flock Number", "Hatchery"];
      const nCols = cols.length;

      // Row 1: Placement Date
      const dateRow = ws.addRow([`Placement Date: ${placementDate}`]);
      ws.mergeCells(dateRow.number, 1, dateRow.number, nCols);
      styleCell(dateRow.getCell(1), { bg: "FFF0F4F9", bold: false, sz: 10, fg: FG_NAVY, hAlign: "left" });
      dateRow.height = 18;

      // Row 2: House name
      const houseRow = ws.addRow([houseName]);
      ws.mergeCells(houseRow.number, 1, houseRow.number, nCols);
      styleCell(houseRow.getCell(1), { bg: BG_NAVY, bold: true, sz: 11, fg: FG_WHITE, hAlign: "left" });
      houseRow.height = 22;

      // Row 3: Column headers
      const hdr = ws.addRow(cols);
      hdr.height = 22;
      hdr.eachCell(cell => {
        styleCell(cell, { bg: BG_HEADER, bold: true, sz: 9, fg: FG_NAVY, hAlign: "center" });
        border(cell);
      });

      // Data rows — one per batch
      let totalBirds = 0;
      batches.forEach((p, i) => {
        totalBirds += p.birdsPlaced;
        const values = hasNotes
          ? [p.batchNo, p.notes || "", p.birdsPlaced, p.parentAgeWeeks ?? "—", p.flockNumber || "—", p.hatchery || "—"]
          : [p.batchNo, p.birdsPlaced, p.parentAgeWeeks ?? "—", p.flockNumber || "—", p.hatchery || "—"];
        const row = ws.addRow(values);
        row.height = 20;
        row.eachCell((cell, col) => {
          const isNotes = hasNotes && col === 2;
          styleCell(cell, { bg: i % 2 === 0 ? BG_EVEN : "FFFFFFFF", hAlign: isNotes ? "left" : "center" });
          border(cell, "hair");
        });
        // Bold birds placed column
        const birdsCol = hasNotes ? 3 : 2;
        row.getCell(birdsCol).font = { bold: true, size: 10, color: { argb: FG_NAVY } };
      });

      // Total row
      const totValues = hasNotes
        ? ["TOTAL", "", totalBirds, "", "", ""]
        : ["TOTAL", totalBirds, "", "", ""];
      const totRow = ws.addRow(totValues);
      totRow.height = 22;
      totRow.eachCell((cell, col) => {
        styleCell(cell, { bg: "FFEDEDED", bold: true, sz: 10, hAlign: col === 1 ? "left" : "center" });
        border(cell, "thin");
      });

      // Spacer between houses
      ws.addRow([]);
    }

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

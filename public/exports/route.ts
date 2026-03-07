import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

function getMaxDayForStage(stage: string) {
  switch (stage) {
    case "DAY_3":
      return 3;
    case "DAY_7":
      return 7;
    case "DAY_14":
      return 14;
    case "DAY_21":
      return 21;
    case "DAY_26":
      return 26;
    case "DAY_28":
      return 28;
    case "THIN_35":
      return 35;
    case "TOTAL_CLEAR":
      return 9999;
    default:
      return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cropId = String(body.cropId || "").trim();
    const stage = String(body.stage || "").trim();

    if (!cropId || !stage) {
      return NextResponse.json(
        { error: "cropId and stage are required." },
        { status: 400 }
      );
    }

    const maxDay = getMaxDayForStage(stage);
    if (maxDay === null) {
      return NextResponse.json(
        { error: "Invalid stage." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
        placements: {
          include: {
            house: true,
          },
        },
        daily: {
          include: {
            house: true,
          },
          orderBy: [{ houseId: "asc" }, { date: "asc" }],
        },
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    const placementDate = new Date(crop.placementDate);

    const filteredDaily = crop.daily.filter((record) => {
      const recordDate = new Date(record.date);
      const ageDays =
        Math.floor(
          (recordDate.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      return ageDays <= maxDay;
    });

    const houseMap: Record<
      string,
      {
        houseName: string;
        birdsPlaced: number;
        mort: number;
        culls: number;
        totalLosses: number;
        birdsAlive: number;
        mortalityPct: number;
        feedKg: number;
        waterL: number;
      }
    > = {};

    for (const placement of crop.placements) {
      houseMap[placement.houseId] = {
        houseName: placement.house.name,
        birdsPlaced: placement.birdsPlaced,
        mort: 0,
        culls: 0,
        totalLosses: 0,
        birdsAlive: placement.birdsPlaced,
        mortalityPct: 0,
        feedKg: 0,
        waterL: 0,
      };
    }

    for (const record of filteredDaily) {
      const item = houseMap[record.houseId];
      if (!item) continue;

      item.mort += record.mort;
      item.culls += record.culls;
      item.feedKg += record.feedKg;
      item.waterL += record.waterL;
    }

    for (const key of Object.keys(houseMap)) {
      const item = houseMap[key];
      item.totalLosses = item.mort + item.culls;
      item.birdsAlive = item.birdsPlaced - item.totalLosses;
      item.mortalityPct =
        item.birdsPlaced > 0 ? (item.totalLosses / item.birdsPlaced) * 100 : 0;
    }

    const houses = Object.values(houseMap);

    const totals = {
      birdsPlaced: houses.reduce((sum, h) => sum + h.birdsPlaced, 0),
      mort: houses.reduce((sum, h) => sum + h.mort, 0),
      culls: houses.reduce((sum, h) => sum + h.culls, 0),
      totalLosses: houses.reduce((sum, h) => sum + h.totalLosses, 0),
      birdsAlive: houses.reduce((sum, h) => sum + h.birdsAlive, 0),
      feedKg: houses.reduce((sum, h) => sum + h.feedKg, 0),
      waterL: houses.reduce((sum, h) => sum + h.waterL, 0),
      mortalityPct: 0,
    };

    totals.mortalityPct =
      totals.birdsPlaced > 0 ? (totals.totalLosses / totals.birdsPlaced) * 100 : 0;

    const templatePath = path.join(process.cwd(), "templates", "avara-template.xlsx");

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Template file not found." },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { error: "No worksheet found in template." },
        { status: 500 }
      );
    }

    // BASIC AUTO-FILL
    worksheet.getCell("B2").value = crop.farm.name;
    worksheet.getCell("B3").value = crop.farm.code;
    worksheet.getCell("B4").value = crop.cropNumber;
    worksheet.getCell("B5").value = new Date(crop.placementDate).toLocaleDateString("en-GB");
    worksheet.getCell("B6").value = crop.breed || "";
    worksheet.getCell("B7").value = crop.hatchery || "";
    worksheet.getCell("B8").value = stage;

    worksheet.getCell("D2").value = totals.birdsPlaced;
    worksheet.getCell("D3").value = totals.mort;
    worksheet.getCell("D4").value = totals.culls;
    worksheet.getCell("D5").value = totals.totalLosses;
    worksheet.getCell("D6").value = totals.birdsAlive;
    worksheet.getCell("D7").value = Number(totals.mortalityPct.toFixed(2));
    worksheet.getCell("D8").value = Number(totals.feedKg.toFixed(2));
    worksheet.getCell("D9").value = Number(totals.waterL.toFixed(2));

    // PER HOUSE TABLE START
    let row = 12;
    for (const house of houses) {
      worksheet.getCell(`A${row}`).value = house.houseName;
      worksheet.getCell(`B${row}`).value = house.birdsPlaced;
      worksheet.getCell(`C${row}`).value = house.mort;
      worksheet.getCell(`D${row}`).value = house.culls;
      worksheet.getCell(`E${row}`).value = house.totalLosses;
      worksheet.getCell(`F${row}`).value = house.birdsAlive;
      worksheet.getCell(`G${row}`).value = Number(house.mortalityPct.toFixed(2));
      worksheet.getCell(`H${row}`).value = Number(house.feedKg.toFixed(2));
      worksheet.getCell(`I${row}`).value = Number(house.waterL.toFixed(2));
      row++;
    }

    const safeStage = stage.toLowerCase();
    const fileName = `avara-${crop.cropNumber}-${safeStage}-${Date.now()}.xlsx`;
    const relativePath = `/exports/${fileName}`;
    const fullPath = path.join(process.cwd(), "public", "exports", fileName);

    await workbook.xlsx.writeFile(fullPath);

    const savedExport = await prisma.avaraExport.create({
      data: {
        cropId: crop.id,
        stage,
        fileName,
        filePath: relativePath,
      },
    });

    return NextResponse.json({
      ok: true,
      exportId: savedExport.id,
      fileName,
      filePath: relativePath,
    });
  } catch (error) {
    console.error("AVARA EXPORT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while exporting Avara file." },
      { status: 500 }
    );
  }
}
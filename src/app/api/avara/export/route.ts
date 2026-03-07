import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

type StageKey =
  | "DAY_3"
  | "DAY_7"
  | "DAY_14"
  | "DAY_21"
  | "DAY_26"
  | "DAY_28"
  | "THIN_35"
  | "TOTAL_CLEAR";

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

function getStageLabel(stage: string) {
  switch (stage) {
    case "DAY_3":
      return "Day 3";
    case "DAY_7":
      return "Day 7";
    case "DAY_14":
      return "Day 14";
    case "DAY_21":
      return "Day 21";
    case "DAY_26":
      return "Day 26";
    case "DAY_28":
      return "Day 28";
    case "THIN_35":
      return "Thin / Day 35";
    case "TOTAL_CLEAR":
      return "Total Clear";
    default:
      return stage;
  }
}

function getHousePlacementCells(houseNumber: number) {
  const map: Record<number, { breed: string; total: string; firstDate: string }> = {
    1: { breed: "D6", total: "C15", firstDate: "D5" },
    2: { breed: "J6", total: "I15", firstDate: "J5" },
    3: { breed: "P6", total: "O15", firstDate: "P5" },
    4: { breed: "V6", total: "U15", firstDate: "V5" },
    5: { breed: "D19", total: "C28", firstDate: "D18" },
    6: { breed: "J19", total: "I28", firstDate: "J18" },
    7: { breed: "P19", total: "O28", firstDate: "P18" },
    8: { breed: "V19", total: "U28", firstDate: "V18" },
    9: { breed: "D32", total: "C41", firstDate: "D31" },
    10: { breed: "J32", total: "I41", firstDate: "J31" },
    11: { breed: "P32", total: "O41", firstDate: "P31" },
    12: { breed: "V32", total: "U41", firstDate: "V31" },
    13: { breed: "D45", total: "C54", firstDate: "D44" },
    14: { breed: "J45", total: "I54", firstDate: "J44" },
    15: { breed: "P45", total: "O54", firstDate: "P44" },
  };

  return map[houseNumber] || null;
}

function getStageRowMap(stage: StageKey) {
  const map: Record<
    StageKey,
    {
      mortRow: number;
      legCullsRow: number;
      otherCullsRow: number;
      weightRow?: number;
    }
  > = {
    DAY_3: { mortRow: 11, legCullsRow: 12, otherCullsRow: 13 },
    DAY_7: { mortRow: 37, legCullsRow: 38, otherCullsRow: 39, weightRow: 40 },
    DAY_14: { mortRow: 65, legCullsRow: 66, otherCullsRow: 67, weightRow: 68 },
    DAY_21: { mortRow: 93, legCullsRow: 94, otherCullsRow: 95, weightRow: 96 },
    DAY_26: { mortRow: 0, legCullsRow: 0, otherCullsRow: 0, weightRow: 119 },
    DAY_28: { mortRow: 144, legCullsRow: 145, otherCullsRow: 146, weightRow: 147 },
    THIN_35: { mortRow: 173, legCullsRow: 174, otherCullsRow: 175 },
    TOTAL_CLEAR: { mortRow: 199, legCullsRow: 200, otherCullsRow: 201 },
  };

  return map[stage];
}

function getHouseColumn(houseNumber: number) {
  const cols = [
    "",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
  ];
  return cols[houseNumber] || null;
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const cropId = String(body.cropId || "").trim();
    const stage = String(body.stage || "").trim() as StageKey;

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

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to export Avara files." },
        { status: 403 }
      );
    }

    const mainPlacementDate = new Date(crop.placementDate);

    const dailyWithAge = crop.daily.map((record) => {
      const recordDate = new Date(record.date);
      const ageDays =
        Math.floor(
          (recordDate.getTime() - mainPlacementDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      return {
        ...record,
        ageDays,
      };
    });

    const filteredDaily = dailyWithAge.filter((record) => record.ageDays <= maxDay);

    const houseMap: Record<
      string,
      {
        houseId: string;
        houseName: string;
        houseNumber: number;
        birdsPlaced: number;
        mort: number;
        culls: number;
        totalLosses: number;
        birdsAlive: number;
        mortalityPct: number;
        feedKg: number;
        waterL: number;
        weightKg: number | null;
        firstPlacementDate: Date | null;
        hatcheries: string[];
        flockNumbers: string[];
      }
    > = {};

    for (const placement of crop.placements) {
      const match = String(placement.house.name).match(/(\d+)/);
      const houseNumber = match ? Number(match[1]) : 0;

      if (!houseMap[placement.houseId]) {
        houseMap[placement.houseId] = {
          houseId: placement.houseId,
          houseName: placement.house.name,
          houseNumber,
          birdsPlaced: 0,
          mort: 0,
          culls: 0,
          totalLosses: 0,
          birdsAlive: 0,
          mortalityPct: 0,
          feedKg: 0,
          waterL: 0,
          weightKg: null,
          firstPlacementDate: null,
          hatcheries: [],
          flockNumbers: [],
        };
      }

      const item = houseMap[placement.houseId];
      item.birdsPlaced += placement.birdsPlaced;

      const thisPlacementDate = new Date(placement.placementDate);
      if (!item.firstPlacementDate || thisPlacementDate < item.firstPlacementDate) {
        item.firstPlacementDate = thisPlacementDate;
      }

      if (placement.hatchery && !item.hatcheries.includes(placement.hatchery)) {
        item.hatcheries.push(placement.hatchery);
      }

      if (placement.flockNumber && !item.flockNumbers.includes(placement.flockNumber)) {
        item.flockNumbers.push(placement.flockNumber);
      }
    }

    for (const record of filteredDaily) {
      const item = houseMap[record.houseId];
      if (!item) continue;

      item.mort += record.mort;
      item.culls += record.culls;
      item.feedKg += record.feedKg;
      item.waterL += record.waterL;

      if (record.avgWeightG !== null && record.avgWeightG !== undefined) {
        item.weightKg = Number(record.avgWeightG) / 1000;
      }
    }

    for (const key of Object.keys(houseMap)) {
      const item = houseMap[key];
      item.totalLosses = item.mort + item.culls;
      item.birdsAlive = item.birdsPlaced - item.totalLosses;
      item.mortalityPct =
        item.birdsPlaced > 0 ? (item.totalLosses / item.birdsPlaced) * 100 : 0;
    }

    const houses = Object.values(houseMap).sort((a, b) => a.houseNumber - b.houseNumber);

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

    const exportDir = path.join(process.cwd(), "public", "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const weeklySheet = workbook.getWorksheet("Weekly Return");
    const placementSheet = workbook.getWorksheet("Placement Information");
    const weights35Sheet = workbook.getWorksheet("35 day weights");

    if (!weeklySheet || !placementSheet) {
      return NextResponse.json(
        { error: "Required worksheets not found in template." },
        { status: 500 }
      );
    }

    weeklySheet.getCell("C2").value = crop.farm.name;
    weeklySheet.getCell("C3").value = crop.cropNumber;
    weeklySheet.getCell("C4").value = crop.farm.code;

    placementSheet.getCell("C2").value = crop.farm.name;
    placementSheet.getCell("D5").value = mainPlacementDate;

    for (const house of houses) {
      if (!house.houseNumber) continue;

      const cellMap = getHousePlacementCells(house.houseNumber);
      if (!cellMap) continue;

      placementSheet.getCell(cellMap.firstDate).value = house.firstPlacementDate || mainPlacementDate;

      const hatcheryText = house.hatcheries.join(", ");
      const flockText = house.flockNumbers.join(", ");
      const descriptionParts = [crop.breed || "", hatcheryText, flockText].filter(Boolean);

      placementSheet.getCell(cellMap.breed).value = descriptionParts.join(" / ");
      placementSheet.getCell(cellMap.total).value = house.birdsPlaced;
    }

    const stageRows = getStageRowMap(stage);

    if (stageRows.mortRow > 0) {
      for (const house of houses) {
        const col = getHouseColumn(house.houseNumber);
        if (!col) continue;

        weeklySheet.getCell(`${col}${stageRows.mortRow}`).value = house.mort;
        weeklySheet.getCell(`${col}${stageRows.legCullsRow}`).value = 0;
        weeklySheet.getCell(`${col}${stageRows.otherCullsRow}`).value = house.culls;

        if (stageRows.weightRow && house.weightKg !== null) {
          weeklySheet.getCell(`${col}${stageRows.weightRow}`).value = house.weightKg;
        }
      }
    } else if (stageRows.weightRow) {
      for (const house of houses) {
        const col = getHouseColumn(house.houseNumber);
        if (!col) continue;

        if (house.weightKg !== null) {
          weeklySheet.getCell(`${col}${stageRows.weightRow}`).value = house.weightKg;
        }
      }
    }

    if (weights35Sheet && stage === "THIN_35") {
      weights35Sheet.getCell("B4").value = crop.farm.name;
      weights35Sheet.getCell("B5").value = crop.cropNumber;
      weights35Sheet.getCell("B6").value = crop.farm.code;

      for (const house of houses) {
        const col = getHouseColumn(house.houseNumber);
        if (!col) continue;

        if (house.weightKg !== null) {
          weights35Sheet.getCell(`${col}10`).value = house.weightKg;
        }
      }
    }

    weeklySheet.getCell("D232").value = 0;
    weeklySheet.getCell("D233").value = Number(totals.feedKg.toFixed(2));
    weeklySheet.getCell("D234").value = 0;
    weeklySheet.getCell("D235").value = 0;
    weeklySheet.getCell("D237").value = 0;

    const safeStage = stage.toLowerCase();
    const fileName = `avara-${crop.cropNumber}-${safeStage}-${Date.now()}.xlsx`;
    const relativePath = `/exports/${fileName}`;
    const fullPath = path.join(exportDir, fileName);

    await workbook.xlsx.writeFile(fullPath);

    const savedExport = await prisma.avaraExport.create({
      data: {
        cropId: crop.id,
        stage: getStageLabel(stage),
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
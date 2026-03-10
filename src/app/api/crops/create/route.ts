import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PlacementInput = {
  houseId: string;
  placementDate: string;
  hatchery?: string;
  flockNumber?: string;
  birdsPlaced: number;
  parentAgeWeeks?: number | string;
  notes?: string;
};

type HouseConfigInput = {
  houseId: string;
  activeFloorAreaM2?: number | string;
  activeCapacityBirds?: number | string;
  activeDrinkerLineCount?: number | string;
  activeNippleCount?: number | string;
  activeFeederPanCount?: number | string;
  activeFanCount?: number | string;
  activeHeaterCount?: number | string;
  notes?: string;
};

function parseOptionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const cropNumber = String(body.cropNumber || "").trim();
    const placementDate = String(body.placementDate || "").trim();
    const breed = String(body.breed || "").trim();
    const hatchery = String(body.hatchery || "").trim();
    const notes = String(body.notes || "").trim();

    const chickenPricePerKg = parseOptionalFloat(body.chickenPricePerKg);
    const salePricePerKgAllIn = parseOptionalFloat(body.salePricePerKgAllIn);
    const currency = String(body.currency || "GBP").trim();

    const placements = Array.isArray(body.placements) ? body.placements : [];
    const houseConfigs = Array.isArray(body.houseConfigs)
      ? body.houseConfigs
      : [];

    if (!farmId || !cropNumber || !placementDate) {
      return NextResponse.json(
        { error: "farmId, cropNumber and placementDate are required." },
        { status: 400 }
      );
    }

    const activeCrop = await prisma.crop.findFirst({
      where: { farmId, status: "ACTIVE" },
    });

    if (activeCrop) {
      return NextResponse.json(
        { error: "This farm already has an active crop." },
        { status: 409 }
      );
    }

    const existingCropNumber = await prisma.crop.findFirst({
      where: { farmId, cropNumber },
    });

    if (existingCropNumber) {
      return NextResponse.json(
        { error: "This crop number already exists for this farm." },
        { status: 409 }
      );
    }

    const farmHouses = await prisma.house.findMany({
      where: { farmId },
    });

    const farmHouseMap = new Map(
      farmHouses.map((house) => [house.id, house])
    );

    const parsedPlacements = (placements as PlacementInput[]).map((p) => ({
      houseId: String(p.houseId || "").trim(),
      placementDate: String(p.placementDate || "").trim(),
      hatchery: String(p.hatchery || "").trim(),
      flockNumber: String(p.flockNumber || "").trim(),
      birdsPlaced: Number(p.birdsPlaced || 0),
      parentAgeWeeks: parseOptionalInt(p.parentAgeWeeks),
      notes: String(p.notes || "").trim(),
    }));

    const usedPlacements = parsedPlacements.filter(
      (p) =>
        p.houseId &&
        p.placementDate &&
        p.flockNumber &&
        Number.isFinite(p.birdsPlaced) &&
        p.birdsPlaced > 0
    );

    if (usedPlacements.length === 0) {
      return NextResponse.json(
        { error: "At least one placement batch with birds placed is required." },
        { status: 400 }
      );
    }

    for (const p of usedPlacements) {
      if (!farmHouseMap.has(p.houseId)) {
        return NextResponse.json(
          { error: "Invalid house selected." },
          { status: 400 }
        );
      }
    }

    const parsedHouseConfigs = (houseConfigs as HouseConfigInput[]).map(
      (item) => ({
        houseId: String(item.houseId || "").trim(),
        activeFloorAreaM2: parseOptionalFloat(item.activeFloorAreaM2),
        activeCapacityBirds: parseOptionalInt(item.activeCapacityBirds),
        activeDrinkerLineCount: parseOptionalInt(
          item.activeDrinkerLineCount
        ),
        activeNippleCount: parseOptionalInt(item.activeNippleCount),
        activeFeederPanCount: parseOptionalInt(
          item.activeFeederPanCount
        ),
        activeFanCount: parseOptionalInt(item.activeFanCount),
        activeHeaterCount: parseOptionalInt(item.activeHeaterCount),
        notes: String(item.notes || "").trim(),
      })
    );

    const configMap = new Map(
      parsedHouseConfigs.map((item) => [item.houseId, item])
    );

    const usedHouseIds = Array.from(
      new Set(usedPlacements.map((p) => p.houseId))
    );

    const crop = await prisma.crop.create({
      data: {
        farmId,
        cropNumber,
        placementDate: new Date(placementDate),
        breed: breed || null,
        hatchery: hatchery || null,
        chickenPricePerKg,
        salePricePerKgAllIn,
        currency: currency || "GBP",
        notes: notes || null,
        placements: {
          create: usedPlacements.map((p) => ({
            houseId: p.houseId,
            placementDate: new Date(p.placementDate),
            hatchery: p.hatchery || hatchery || null,
            flockNumber: p.flockNumber || null,
            birdsPlaced: p.birdsPlaced,
            parentAgeWeeks: p.parentAgeWeeks,
            notes: p.notes || null,
          })),
        },
        cropHouseConfigs: {
          create: usedHouseIds.map((houseId) => {
            const house = farmHouseMap.get(houseId)!;
            const override = configMap.get(houseId);

            return {
              houseId,
              activeFloorAreaM2:
                override?.activeFloorAreaM2 ??
                house.usableAreaM2 ??
                house.floorAreaM2,
              activeCapacityBirds:
                override?.activeCapacityBirds ??
                house.defaultCapacityBirds,
              activeDrinkerLineCount:
                override?.activeDrinkerLineCount ??
                house.defaultDrinkerLineCount,
              activeNippleCount:
                override?.activeNippleCount ??
                house.defaultNippleCount,
              activeFeederPanCount:
                override?.activeFeederPanCount ??
                house.defaultFeederPanCount,
              activeFanCount:
                override?.activeFanCount ?? house.defaultFanCount,
              activeHeaterCount:
                override?.activeHeaterCount ??
                house.defaultHeaterCount,
              notes: override?.notes || null,
            };
          }),
        },
      },
    });

    return NextResponse.json(crop);
  } catch (error) {
    console.error("CREATE CROP ERROR:", error);
    return NextResponse.json(
      { error: "Server error while creating crop." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { cloneFarmTemplateToCrop } from "@/lib/target-profile-template";

type PlacementInput = {
  houseId: string;
  placementDate: string;
  hatchery?: string;
  flockNumber?: string;
  birdsPlaced: number;
  parentAgeWeeks?: number | string;
  thinDate?: string;
  clearDate?: string;
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

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    const houseConfigs = Array.isArray(body.houseConfigs) ? body.houseConfigs : [];

    if (!farmId || !cropNumber || !placementDate) {
      return NextResponse.json(
        { error: "farmId, cropNumber and placementDate are required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to create crop." },
        { status: 403 }
      );
    }

    const parsedMainPlacementDate = new Date(placementDate);

    if (Number.isNaN(parsedMainPlacementDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid crop placement date." },
        { status: 400 }
      );
    }

    const activeCrop = await prisma.crop.findFirst({
      where: {
        farmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        cropNumber: true,
      },
    });

    if (activeCrop) {
      return NextResponse.json(
        {
          error: "This farm already has an active crop.",
          activeCropId: activeCrop.id,
          activeCropNumber: activeCrop.cropNumber,
        },
        { status: 409 }
      );
    }

    const existingCropNumber = await prisma.crop.findFirst({
      where: {
        farmId,
        cropNumber,
      },
      select: {
        id: true,
      },
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

    const farmHouseMap = new Map(farmHouses.map((house) => [house.id, house]));

    const parsedPlacements = (placements as PlacementInput[]).map((p) => ({
      houseId: String(p.houseId || "").trim(),
      placementDate: String(p.placementDate || "").trim(),
      hatchery: String(p.hatchery || "").trim(),
      flockNumber: String(p.flockNumber || "").trim(),
      birdsPlaced: Number(p.birdsPlaced || 0),
      parentAgeWeeks: parseOptionalInt(p.parentAgeWeeks),
      thinDate: parseOptionalDate(p.thinDate),
      clearDate: parseOptionalDate(p.clearDate),
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

      const placementDateObj = new Date(p.placementDate);

      if (Number.isNaN(placementDateObj.getTime())) {
        return NextResponse.json(
          { error: "One or more placement dates are invalid." },
          { status: 400 }
        );
      }
    }

    const placementsPerHouse = new Map<string, number>();

    const usedPlacementsWithBatchNo = usedPlacements.map((p) => {
      const current = placementsPerHouse.get(p.houseId) || 0;
      const nextBatchNo = current + 1;
      placementsPerHouse.set(p.houseId, nextBatchNo);

      return {
        ...p,
        batchNo: nextBatchNo,
      };
    });

    const tooManyBatches = Array.from(placementsPerHouse.values()).some(
      (count) => count > 4
    );

    if (tooManyBatches) {
      return NextResponse.json(
        { error: "Maximum 4 placement batches per house are allowed." },
        { status: 400 }
      );
    }

    const parsedHouseConfigs = (houseConfigs as HouseConfigInput[]).map((item) => ({
      houseId: String(item.houseId || "").trim(),
      activeFloorAreaM2: parseOptionalFloat(item.activeFloorAreaM2),
      activeCapacityBirds: parseOptionalInt(item.activeCapacityBirds),
      activeDrinkerLineCount: parseOptionalInt(item.activeDrinkerLineCount),
      activeNippleCount: parseOptionalInt(item.activeNippleCount),
      activeFeederPanCount: parseOptionalInt(item.activeFeederPanCount),
      activeFanCount: parseOptionalInt(item.activeFanCount),
      activeHeaterCount: parseOptionalInt(item.activeHeaterCount),
      notes: String(item.notes || "").trim(),
    }));

    const configMap = new Map(parsedHouseConfigs.map((item) => [item.houseId, item]));
    const usedHouseIds = Array.from(new Set(usedPlacementsWithBatchNo.map((p) => p.houseId)));

    const result = await prisma.$transaction(async (tx) => {
      const crop = await tx.crop.create({
        data: {
          farmId,
          cropNumber,
          placementDate: parsedMainPlacementDate,
          breed: breed || null,
          hatchery: hatchery || null,
          status: "ACTIVE",
          chickenPricePerKg,
          salePricePerKgAllIn,
          currency: currency || "GBP",
          notes: notes || null,
          placements: {
            create: usedPlacementsWithBatchNo.map((p) => ({
              houseId: p.houseId,
              batchNo: p.batchNo,
              placementDate: new Date(p.placementDate),
              hatchery: p.hatchery || hatchery || null,
              flockNumber: p.flockNumber || null,
              birdsPlaced: p.birdsPlaced,
              parentAgeWeeks: p.parentAgeWeeks,
              thinDate: p.thinDate,
              clearDate: p.clearDate,
              isActive: true,
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
                  override?.activeFanCount ??
                  house.defaultFanCount,
                activeHeaterCount:
                  override?.activeHeaterCount ??
                  house.defaultHeaterCount,
                notes: override?.notes || null,
              };
            }),
          },
        },
        include: {
          placements: {
            orderBy: [
              { houseId: "asc" },
              { batchNo: "asc" },
              { placementDate: "asc" },
            ],
          },
          cropHouseConfigs: true,
        },
      });

      await cloneFarmTemplateToCrop({
        prisma: tx as any,
        farmId,
        cropId: crop.id,
        cropNumber,
      });

      return crop;
    });

    return NextResponse.json(
      {
        success: true,
        crop: result,
        active: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE CROP ERROR:", error);

    return NextResponse.json(
      { error: "Server error while creating crop." },
      { status: 500 }
    );
  }
}
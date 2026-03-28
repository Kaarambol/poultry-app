import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView, canOperate } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{
    cropId: string;
  }>;
};

function parseOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { cropId } = await context.params;

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        placements: {
          include: {
            house: true,
          },
          orderBy: [{ houseId: "asc" }, { batchNo: "asc" }],
        },
      },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this crop." },
        { status: 403 }
      );
    }

    const grouped = new Map<
      string,
      {
        placementId: string;
        houseId: string;
        houseName: string;
        birdsPlaced: number;
        thinDate: Date | null;
        thinBirds: number | null;
        thin2Date: Date | null;
        thin2Birds: number | null;
        clearDate: Date | null;
        clearBirds: number | null;
        notes: string | null;
      }
    >();

    for (const p of crop.placements) {
      const existing = grouped.get(p.houseId);

      if (!existing) {
        grouped.set(p.houseId, {
          placementId: p.id, // store reference to first batch for this house
          houseId: p.houseId,
          houseName: p.house.name,
          birdsPlaced: p.birdsPlaced,
          thinDate: p.thinDate,
          thinBirds: p.thinBirds,
          thin2Date: p.thin2Date,
          thin2Birds: p.thin2Birds,
          clearDate: p.clearDate,
          clearBirds: p.clearBirds,
          notes: p.notes,
        });
      } else {
        existing.birdsPlaced += p.birdsPlaced;

        // if first batch has no thin/clear but a later one does, use first found value
        if (!existing.thinDate && p.thinDate) existing.thinDate = p.thinDate;
        if (existing.thinBirds === null && p.thinBirds !== null) existing.thinBirds = p.thinBirds;

        if (!existing.thin2Date && p.thin2Date) existing.thin2Date = p.thin2Date;
        if (existing.thin2Birds === null && p.thin2Birds !== null) existing.thin2Birds = p.thin2Birds;

        if (!existing.clearDate && p.clearDate) existing.clearDate = p.clearDate;
        if (existing.clearBirds === null && p.clearBirds !== null) existing.clearBirds = p.clearBirds;

        if (!existing.notes && p.notes) existing.notes = p.notes;
      }
    }

    return NextResponse.json({
      crop: {
        id: crop.id,
        cropNumber: crop.cropNumber,
        placementDate: crop.placementDate,
        status: crop.status,
      },
      placements: Array.from(grouped.values()).map((p) => ({
        id: p.placementId,
        houseId: p.houseId,
        houseName: p.houseName,
        birdsPlaced: p.birdsPlaced,
        thinDate: p.thinDate,
        thinBirds: p.thinBirds,
        thin2Date: p.thin2Date,
        thin2Birds: p.thin2Birds,
        clearDate: p.clearDate,
        clearBirds: p.clearBirds,
        notes: p.notes,
      })),
    });
  } catch (error) {
    console.error("GET THIN CLEAR ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading thin/clear data." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { cropId } = await context.params;
    const body = await req.json();

    const placementId = String(body.placementId || "").trim();

    if (!placementId) {
      return NextResponse.json(
        { error: "placementId is required." },
        { status: 400 }
      );
    }

    const placement = await prisma.cropHousePlacement.findUnique({
      where: { id: placementId },
      include: {
        crop: true,
        house: true,
      },
    });

    if (!placement || placement.cropId !== cropId) {
      return NextResponse.json(
        { error: "Placement not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, placement.crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    const allHousePlacements = await prisma.cropHousePlacement.findMany({
      where: {
        cropId,
        houseId: placement.houseId,
      },
      orderBy: [{ batchNo: "asc" }, { placementDate: "asc" }],
    });

    const totalHouseBirdsPlaced = allHousePlacements.reduce(
      (sum, row) => sum + row.birdsPlaced,
      0
    );

    const thinDate = parseOptionalDate(body.thinDate);
    const thinBirds = parseOptionalInt(body.thinBirds);
    const thin2Date = parseOptionalDate(body.thin2Date);
    const thin2Birds = parseOptionalInt(body.thin2Birds);
    const clearDate = parseOptionalDate(body.clearDate);
    const clearBirds = parseOptionalInt(body.clearBirds);
    const notes = String(body.notes || "").trim() || null;

    const nums = [thinBirds, thin2Birds, clearBirds].filter(
      (v) => v !== null
    ) as number[];

    if (nums.some((v) => v < 0)) {
      return NextResponse.json(
        { error: "Bird numbers cannot be negative." },
        { status: 400 }
      );
    }

    const totalRemoved =
      (thinBirds || 0) + (thin2Birds || 0) + (clearBirds || 0);

    if (totalRemoved > totalHouseBirdsPlaced) {
      return NextResponse.json(
        { error: "Total removed birds cannot exceed total birds placed in this house." },
        { status: 400 }
      );
    }

    if (thin2Date && !thinDate) {
      return NextResponse.json(
        { error: "Second thin date cannot be used without first thin date." },
        { status: 400 }
      );
    }

    if (thin2Birds !== null && !thin2Date) {
      return NextResponse.json(
        { error: "Second thin birds require second thin date." },
        { status: 400 }
      );
    }

    // save on the first batch for this house
    const primaryPlacement = allHousePlacements[0];

    if (!primaryPlacement) {
      return NextResponse.json(
        { error: "No placements found for this house." },
        { status: 404 }
      );
    }

    const updated = await prisma.cropHousePlacement.update({
      where: { id: primaryPlacement.id },
      data: {
        thinDate,
        thinBirds,
        thin2Date,
        thin2Birds,
        clearDate,
        clearBirds,
        notes,
      },
      include: {
        house: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("SAVE THIN CLEAR ERROR:", error);
    return NextResponse.json(
      { error: "Server error while saving thin/clear data." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PlacementInput = {
  houseId: string;
  placementDate: string;
  hatchery?: string;
  flockNumber?: string;
  birdsPlaced: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const cropNumber = String(body.cropNumber || "").trim();
    const placementDate = String(body.placementDate || "").trim();
    const breed = String(body.breed || "").trim();
    const hatchery = String(body.hatchery || "").trim();
    const placements = Array.isArray(body.placements) ? body.placements : [];

    if (!farmId || !cropNumber || !placementDate) {
      return NextResponse.json(
        { error: "farmId, cropNumber and main placementDate are required." },
        { status: 400 }
      );
    }

    const activeCrop = await prisma.crop.findFirst({
      where: {
        farmId,
        status: "ACTIVE",
      },
    });

    if (activeCrop) {
      return NextResponse.json(
        { error: "This farm already has an active crop. Finish it before creating a new one." },
        { status: 409 }
      );
    }

    const existingCropNumber = await prisma.crop.findFirst({
      where: {
        farmId,
        cropNumber,
      },
    });

    if (existingCropNumber) {
      return NextResponse.json(
        { error: "This crop number already exists for the selected farm." },
        { status: 409 }
      );
    }

    const parsedPlacements = (placements as PlacementInput[]).map((p) => ({
      houseId: String(p.houseId || "").trim(),
      placementDate: String(p.placementDate || "").trim(),
      hatchery: String(p.hatchery || "").trim(),
      flockNumber: String(p.flockNumber || "").trim(),
      birdsPlaced: Number(p.birdsPlaced || 0),
    }));

    const usedPlacements = parsedPlacements.filter((p) => p.birdsPlaced > 0);

    if (usedPlacements.length === 0) {
      return NextResponse.json(
        { error: "At least one placement batch with birds placed is required." },
        { status: 400 }
      );
    }

    for (const p of usedPlacements) {
      if (!p.houseId) {
        return NextResponse.json(
          { error: "Each used batch must have a house." },
          { status: 400 }
        );
      }

      if (!p.placementDate) {
        return NextResponse.json(
          { error: "Each used batch must have a placement date." },
          { status: 400 }
        );
      }

      if (!p.hatchery) {
        return NextResponse.json(
          { error: "Each used batch must have a hatchery." },
          { status: 400 }
        );
      }

      if (!p.flockNumber) {
        return NextResponse.json(
          { error: "Each used batch must have a flock number." },
          { status: 400 }
        );
      }

      if (p.birdsPlaced <= 0) {
        return NextResponse.json(
          { error: "Birds placed must be greater than zero in each used batch." },
          { status: 400 }
        );
      }
    }

    const crop = await prisma.crop.create({
      data: {
        farmId,
        cropNumber,
        placementDate: new Date(placementDate),
        breed: breed || null,
        hatchery: hatchery || null,
        status: "ACTIVE",
        placements: {
          create: usedPlacements.map((p) => ({
            houseId: p.houseId,
            placementDate: new Date(p.placementDate),
            hatchery: p.hatchery || null,
            flockNumber: p.flockNumber || null,
            birdsPlaced: p.birdsPlaced,
          })),
        },
      },
      include: {
        placements: true,
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
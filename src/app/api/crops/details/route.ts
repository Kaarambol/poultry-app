import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        placements: {
          include: {
            house: true,
          },
        },
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    const grouped: Record<
      string,
      {
        house: {
          id: string;
          name: string;
        };
        birdsPlaced: number;
      }
    > = {};

    for (const placement of crop.placements) {
      if (!grouped[placement.houseId]) {
        grouped[placement.houseId] = {
          house: {
            id: placement.house.id,
            name: placement.house.name,
          },
          birdsPlaced: 0,
        };
      }

      grouped[placement.houseId].birdsPlaced += placement.birdsPlaced;
    }

    return NextResponse.json({
      id: crop.id,
      cropNumber: crop.cropNumber,
      placementDate: crop.placementDate,
      placements: Object.values(grouped),
    });
  } catch (error) {
    console.error("CROP DETAILS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading crop details." },
      { status: 500 }
    );
  }
}
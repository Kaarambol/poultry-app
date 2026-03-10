import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = String(url.searchParams.get("q") || "").trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Search query must have at least 2 characters." },
        { status: 400 }
      );
    }

    const placements = await prisma.cropHousePlacement.findMany({
      where: {
        flockNumber: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        crop: {
          include: {
            farm: true,
            daily: true,
            feedRecords: true,
            medications: true,
          },
        },
        house: true,
      },
      orderBy: [
        { flockNumber: "asc" },
        { placementDate: "desc" },
      ],
    });

    const groupedMap = new Map<
      string,
      {
        flockNumber: string;
        totalBirdsPlaced: number;
        farmsCount: number;
        cropsCount: number;
        housesCount: number;
        firstPlacementDate: string | null;
        latestPlacementDate: string | null;
        items: Array<{
          placementId: string;
          farmId: string;
          farmName: string;
          farmCode: string;
          cropId: string;
          cropNumber: string;
          cropStatus: string;
          houseId: string;
          houseName: string;
          houseCode: string | null;
          placementDate: string;
          hatchery: string | null;
          birdsPlaced: number;
          parentAgeWeeks: number | null;
          notes: string | null;
          currentBirdsAliveEstimate: number;
          totalFeedKg: number;
          totalWheatKg: number;
          medicationRecordsCount: number;
        }>;
      }
    >();

    for (const placement of placements) {
      const flockNumber = placement.flockNumber || "NO_FLOCK_NUMBER";

      if (!groupedMap.has(flockNumber)) {
        groupedMap.set(flockNumber, {
          flockNumber,
          totalBirdsPlaced: 0,
          farmsCount: 0,
          cropsCount: 0,
          housesCount: 0,
          firstPlacementDate: null,
          latestPlacementDate: null,
          items: [],
        });
      }

      const group = groupedMap.get(flockNumber)!;

      const cropDailyForHouse = placement.crop.daily.filter(
        (record) => record.houseId === placement.houseId
      );

      const totalLossesForHouse = cropDailyForHouse.reduce(
        (sum, record) => sum + record.mort + record.culls,
        0
      );

      const currentBirdsAliveEstimate = placement.birdsPlaced - totalLossesForHouse;

      const feedRecordsForHouse = placement.crop.feedRecords.filter(
        (record) => record.houseId === placement.houseId || record.houseId === null
      );

      const totalFeedKg = feedRecordsForHouse.reduce(
        (sum, record) => sum + record.feedKg,
        0
      );

      const totalWheatKg = feedRecordsForHouse.reduce(
        (sum, record) => sum + record.wheatKg,
        0
      );

      group.totalBirdsPlaced += placement.birdsPlaced;

      const placementDateIso = placement.placementDate.toISOString();

      if (
        !group.firstPlacementDate ||
        new Date(placementDateIso) < new Date(group.firstPlacementDate)
      ) {
        group.firstPlacementDate = placementDateIso;
      }

      if (
        !group.latestPlacementDate ||
        new Date(placementDateIso) > new Date(group.latestPlacementDate)
      ) {
        group.latestPlacementDate = placementDateIso;
      }

      group.items.push({
        placementId: placement.id,
        farmId: placement.crop.farm.id,
        farmName: placement.crop.farm.name,
        farmCode: placement.crop.farm.code,
        cropId: placement.crop.id,
        cropNumber: placement.crop.cropNumber,
        cropStatus: placement.crop.status,
        houseId: placement.house.id,
        houseName: placement.house.name,
        houseCode: placement.house.code,
        placementDate: placementDateIso,
        hatchery: placement.hatchery,
        birdsPlaced: placement.birdsPlaced,
        parentAgeWeeks: placement.parentAgeWeeks,
        notes: placement.notes,
        currentBirdsAliveEstimate,
        totalFeedKg,
        totalWheatKg,
        medicationRecordsCount: placement.crop.medications.length,
      });
    }

    const results = Array.from(groupedMap.values()).map((group) => {
      const uniqueFarmIds = new Set(group.items.map((item) => item.farmId));
      const uniqueCropIds = new Set(group.items.map((item) => item.cropId));
      const uniqueHouseIds = new Set(group.items.map((item) => item.houseId));

      return {
        ...group,
        farmsCount: uniqueFarmIds.size,
        cropsCount: uniqueCropIds.size,
        housesCount: uniqueHouseIds.size,
      };
    });

    return NextResponse.json({
      query,
      results,
      totalMatches: placements.length,
      totalFlocks: results.length,
    });
  } catch (error) {
    console.error("CHECK FLOCK SEARCH ERROR:", error);
    return NextResponse.json(
      { error: "Server error while searching flock." },
      { status: 500 }
    );
  }
}
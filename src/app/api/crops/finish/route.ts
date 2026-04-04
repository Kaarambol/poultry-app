import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canFinishCrop } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

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

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const existingCrop = await prisma.crop.findUnique({
      where: { id: cropId },
    });

    if (!existingCrop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, existingCrop.farmId);

    if (!canFinishCrop(role)) {
      return NextResponse.json(
        { error: "You do not have permission to finish this crop." },
        { status: 403 }
      );
    }

    if (existingCrop.status === "FINISHED") {
      return NextResponse.json(
        { error: "This crop is already finished." },
        { status: 409 }
      );
    }

    // Use the latest clearDate across all placements as the crop finish date
    const placements = await prisma.cropHousePlacement.findMany({
      where: { cropId },
      select: { clearDate: true },
    });

    const clearDates = placements
      .map((p) => p.clearDate)
      .filter((d): d is Date => d !== null);

    const finishDate =
      clearDates.length > 0
        ? new Date(Math.max(...clearDates.map((d) => d.getTime())))
        : new Date();

    const crop = await prisma.crop.update({
      where: { id: cropId },
      data: {
        status: "FINISHED",
        finishDate,
      },
    });

    await writeChangeLog({
      farmId: existingCrop.farmId,
      userId: uid,
      action: "FINISH_CROP",
      description: `Finished crop ${crop.cropNumber}.`,
    });

    return NextResponse.json(crop);
  } catch (error) {
    console.error("FINISH CROP ERROR:", error);
    return NextResponse.json(
      { error: "Server error while finishing crop." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const cropId      = String(body.cropId      || "").trim();
    const houseId     = String(body.houseId     || "").trim();
    const placementDate = String(body.placementDate || "").trim();
    const birdsPlaced = Number(body.birdsPlaced);
    const flockNumber = String(body.flockNumber || "").trim() || null;
    const hatchery    = String(body.hatchery    || "").trim() || null;

    if (!cropId || !houseId || !placementDate || !(birdsPlaced > 0)) {
      return NextResponse.json(
        { error: "cropId, houseId, placementDate and birdsPlaced are required." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(placementDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid placement date." }, { status: 400 });
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      select: { id: true, farmId: true, status: true },
    });

    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    if (crop.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Placements can only be added to an active crop." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canOperate(role)) {
      return NextResponse.json({ error: "No permission." }, { status: 403 });
    }

    const house = await prisma.house.findFirst({
      where: { id: houseId, farmId: crop.farmId },
    });
    if (!house) {
      return NextResponse.json({ error: "House not found on this farm." }, { status: 400 });
    }

    // Next batch number for this house in this crop
    const existing = await prisma.cropHousePlacement.findMany({
      where: { cropId, houseId },
      select: { batchNo: true },
    });
    const nextBatchNo = existing.length > 0
      ? Math.max(...existing.map((p) => p.batchNo)) + 1
      : 1;

    if (nextBatchNo > 4) {
      return NextResponse.json(
        { error: "Maximum 4 placement batches per house." },
        { status: 400 }
      );
    }

    const placement = await prisma.cropHousePlacement.create({
      data: {
        cropId,
        houseId,
        batchNo: nextBatchNo,
        placementDate: parsedDate,
        birdsPlaced,
        flockNumber,
        hatchery,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, placement });
  } catch (error) {
    console.error("ADD PLACEMENT ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

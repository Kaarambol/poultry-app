import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

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
    const houseId = String(body.houseId || "").trim();
    const date = String(body.date || "").trim();

    const mort = Number(body.mort || 0);
    const culls = Number(body.culls || 0);
    const feedKg = Number(body.feedKg || 0);
    const waterL = Number(body.waterL || 0);
    const avgWeightG =
      body.avgWeightG === "" || body.avgWeightG === null || body.avgWeightG === undefined
        ? null
        : Number(body.avgWeightG);
    const notes = String(body.notes || "").trim();

    if (!cropId || !houseId || !date) {
      return NextResponse.json(
        { error: "cropId, houseId and date are required." },
        { status: 400 }
      );
    }

    if (mort < 0 || culls < 0 || feedKg < 0 || waterL < 0 || (avgWeightG !== null && avgWeightG < 0)) {
      return NextResponse.json(
        { error: "Values cannot be negative." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
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
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    if (crop.status === "FINISHED") {
      return NextResponse.json(
        { error: "Cannot add daily records to a finished crop." },
        { status: 409 }
      );
    }

    const recordDate = new Date(date);
    const placementDate = new Date(crop.placementDate);

    if (recordDate < placementDate) {
      return NextResponse.json(
        { error: "Daily record date cannot be earlier than placement date." },
        { status: 400 }
      );
    }

    const existing = await prisma.dailyRecord.findUnique({
      where: {
        cropId_houseId_date: {
          cropId,
          houseId,
          date: new Date(date),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A record for this crop, house and date already exists." },
        { status: 409 }
      );
    }

    const record = await prisma.dailyRecord.create({
      data: {
        cropId,
        houseId,
        date: new Date(date),
        mort,
        culls,
        feedKg,
        waterL,
        avgWeightG,
        notes: notes || null,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("CREATE DAILY RECORD ERROR:", error);
    return NextResponse.json(
      { error: "Server error while creating daily record." },
      { status: 500 }
    );
  }
}
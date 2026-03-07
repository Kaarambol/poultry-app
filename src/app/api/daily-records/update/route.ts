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

    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Record id is required." },
        { status: 400 }
      );
    }

    const existingRecord = await prisma.dailyRecord.findUnique({
      where: { id },
      include: {
        crop: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Daily record not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, existingRecord.crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    if (existingRecord.crop.status === "FINISHED") {
      return NextResponse.json(
        { error: "Cannot update daily records in a finished crop." },
        { status: 409 }
      );
    }

    const mort = Number(body.mort || 0);
    const culls = Number(body.culls || 0);
    const feedKg = Number(body.feedKg || 0);
    const waterL = Number(body.waterL || 0);
    const avgWeightG =
      body.avgWeightG === "" || body.avgWeightG === null || body.avgWeightG === undefined
        ? null
        : Number(body.avgWeightG);
    const notes = String(body.notes || "").trim();

    if (mort < 0 || culls < 0 || feedKg < 0 || waterL < 0 || (avgWeightG !== null && avgWeightG < 0)) {
      return NextResponse.json(
        { error: "Values cannot be negative." },
        { status: 400 }
      );
    }

    const updated = await prisma.dailyRecord.update({
      where: { id },
      data: {
        mort,
        culls,
        feedKg,
        waterL,
        avgWeightG,
        notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE DAILY RECORD ERROR:", error);
    return NextResponse.json(
      { error: "Server error while updating daily record." },
      { status: 500 }
    );
  }
}
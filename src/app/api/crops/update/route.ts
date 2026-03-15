import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

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

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();

    const cropId = String(body.cropId || "").trim();
    const cropNumber = String(body.cropNumber || "").trim();
    const placementDate = String(body.placementDate || "").trim();
    const breed = String(body.breed || "").trim();
    const hatchery = String(body.hatchery || "").trim();
    const currency = String(body.currency || "GBP").trim();
    const notes = String(body.notes || "").trim();

    const chickenPricePerKg = parseOptionalFloat(body.chickenPricePerKg);
    const salePricePerKgAllIn = parseOptionalFloat(body.salePricePerKgAllIn);

    const placements = Array.isArray(body.placements) ? body.placements : [];

    if (!cropId || !cropNumber || !placementDate) {
      return NextResponse.json(
        { error: "cropId, cropNumber and placementDate are required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        placements: true,
      },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit crop data." },
        { status: 403 }
      );
    }

    const placementDateObj = new Date(placementDate);

    if (Number.isNaN(placementDateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid placement date." },
        { status: 400 }
      );
    }

    const existingCropNumber = await prisma.crop.findFirst({
      where: {
        farmId: crop.farmId,
        cropNumber,
        id: { not: cropId },
      },
      select: { id: true },
    });

    if (existingCropNumber) {
      return NextResponse.json(
        { error: "This crop number already exists for this farm." },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.dailyRecord.deleteMany({ where: { cropId } });
      await tx.nightCheck.deleteMany({ where: { cropId } });
      await tx.medicationRecord.deleteMany({ where: { cropId } });

      await tx.crop.update({
        where: { id: cropId },
        data: {
          cropNumber,
          placementDate: placementDateObj,
          breed: breed || null,
          hatchery: hatchery || null,
          chickenPricePerKg,
          salePricePerKgAllIn,
          currency: currency || "GBP",
          notes: notes || null,
        },
      });

      for (const p of placements) {
        const placementId = String(p.id || "").trim();
        if (!placementId) continue;

        const placementDateValue = String(p.placementDate || "").trim();
        const placementDateObjInner = new Date(placementDateValue);

        if (Number.isNaN(placementDateObjInner.getTime())) {
          throw new Error("Invalid batch placement date.");
        }

        await tx.cropHousePlacement.update({
          where: { id: placementId },
          data: {
            placementDate: placementDateObjInner,
            hatchery: String(p.hatchery || "").trim() || null,
            flockNumber: String(p.flockNumber || "").trim() || null,
            birdsPlaced: Number(p.birdsPlaced || 0),
            parentAgeWeeks: parseOptionalInt(p.parentAgeWeeks),
            notes: String(p.notes || "").trim() || null,
          },
        });
      }
    });

    await writeChangeLog({
      farmId: crop.farmId,
      userId: uid,
      action: "UPDATE_CROP",
      description: `Updated crop ${cropNumber} and removed dependent crop records for consistency.`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("UPDATE CROP ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Server error while updating crop." },
      { status: 500 }
    );
  }
}
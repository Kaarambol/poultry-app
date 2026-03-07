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
    const startDate = String(body.startDate || "").trim();
    const medicineName = String(body.medicineName || "").trim();

    if (!cropId || !startDate || !medicineName) {
      return NextResponse.json(
        { error: "cropId, startDate and medicineName are required." },
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
        { error: "Cannot add medication records to a finished crop." },
        { status: 409 }
      );
    }

    const record = await prisma.medicationRecord.create({
      data: {
        cropId,
        startDate: new Date(startDate),
        medicineName,
        supplier: body.supplier || null,
        batchNo: body.batchNo || null,
        expireDate: body.expireDate ? new Date(body.expireDate) : null,
        quantityPurchased: body.quantityPurchased || null,
        quantityUsed: body.quantityUsed || null,
        animalIdentity: body.animalIdentity || null,
        housesTreated: body.housesTreated || null,
        birdsTreated:
          body.birdsTreated === "" || body.birdsTreated === null || body.birdsTreated === undefined
            ? null
            : Number(body.birdsTreated),
        finishDate: body.finishDate ? new Date(body.finishDate) : null,
        withdrawalPeriod: body.withdrawalPeriod || null,
        safeSlaughterDate: body.safeSlaughterDate ? new Date(body.safeSlaughterDate) : null,
        administratorName: body.administratorName || null,
        reasonForTreatment: body.reasonForTreatment || null,
        methodOfTreatment: body.methodOfTreatment || null,
        dose: body.dose || null,
        totalMgPcu: body.totalMgPcu || null,
        report: body.report || null,
        prescription: body.prescription || null,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("CREATE MEDICATION ERROR:", error);
    return NextResponse.json(
      { error: "Server error while creating medication record." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
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

    const farmId = String(body.farmId || "").trim();
    const startDate = String(body.startDate || "").trim();
    const medicineName = String(body.medicineName || "").trim();

    if (!farmId || !startDate || !medicineName) {
      return NextResponse.json(
        { error: "farmId, startDate and medicineName are required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    const startDateObj = new Date(startDate);

    // Auto-assign to the crop whose date range contains startDate
    const crop = await prisma.crop.findFirst({
      where: {
        farmId,
        placementDate: { lte: startDateObj },
        OR: [
          { finishDate: null },
          { finishDate: { gte: startDateObj } },
        ],
      },
      orderBy: { placementDate: "desc" },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "No crop found matching this start date. Check placement and finish dates." },
        { status: 404 }
      );
    }

    const cropId = crop.id;

    const record = await prisma.medicationRecord.create({
      data: {
        cropId,
        startDate: startDateObj,
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

    await writeChangeLog({
      farmId: crop.farmId,
      userId: uid,
      action: "CREATE_MEDICATION",
      description: `Created medication record "${record.medicineName}" starting ${new Date(record.startDate).toLocaleDateString()}.`,
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
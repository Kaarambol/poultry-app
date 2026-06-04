import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

async function uploadMedFile(file: File, cropId: string, field: string): Promise<string> {
  const safeName = (file.name || "file")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  const pathname = `medication-files/${cropId}/${field}-${Date.now()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });
  return blob.url;
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const form = await req.formData();

    const farmId       = String(form.get("farmId")       || "").trim();
    const startDate    = String(form.get("startDate")    || "").trim();
    const medicineName = String(form.get("medicineName") || "").trim();

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
    const cropIdOverride = String(form.get("cropId") || "").trim();

    let crop;
    if (cropIdOverride) {
      crop = await prisma.crop.findFirst({ where: { id: cropIdOverride, farmId } });
      if (!crop) {
        return NextResponse.json({ error: "Selected crop not found." }, { status: 404 });
      }
    } else {
      crop = await prisma.crop.findFirst({
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
    }

    const cropId = crop.id;

    const birdsTreatedRaw = form.get("birdsTreated");
    const birdsTreated =
      birdsTreatedRaw === null || birdsTreatedRaw === "" ? null : Number(birdsTreatedRaw);

    // Handle optional file uploads
    let reportValue: string | null = null;
    let prescriptionValue: string | null = null;

    const reportFile = form.get("reportFile");
    if (reportFile instanceof File && reportFile.size > 0) {
      reportValue = await uploadMedFile(reportFile, cropId, "report");
    }

    const prescriptionFile = form.get("prescriptionFile");
    if (prescriptionFile instanceof File && prescriptionFile.size > 0) {
      prescriptionValue = await uploadMedFile(prescriptionFile, cropId, "prescription");
    }

    const record = await prisma.medicationRecord.create({
      data: {
        cropId,
        startDate:           startDateObj,
        medicineName,
        supplier:            String(form.get("supplier")            || "") || null,
        batchNo:             String(form.get("batchNo")             || "") || null,
        expireDate:          form.get("expireDate")      ? new Date(String(form.get("expireDate")))      : null,
        quantityPurchased:   String(form.get("quantityPurchased")   || "") || null,
        quantityUsed:        String(form.get("quantityUsed")        || "") || null,
        animalIdentity:      String(form.get("animalIdentity")      || "") || null,
        housesTreated:       String(form.get("housesTreated")       || "") || null,
        birdsTreated,
        finishDate:          form.get("finishDate")      ? new Date(String(form.get("finishDate")))      : null,
        withdrawalPeriod:    String(form.get("withdrawalPeriod")    || "") || null,
        safeSlaughterDate:   form.get("safeSlaughterDate") ? new Date(String(form.get("safeSlaughterDate"))) : null,
        administratorName:   String(form.get("administratorName")   || "") || null,
        reasonForTreatment:  String(form.get("reasonForTreatment")  || "") || null,
        methodOfTreatment:   String(form.get("methodOfTreatment")   || "") || null,
        dose:                String(form.get("dose")                || "") || null,
        totalMgPcu:          String(form.get("totalMgPcu")          || "") || null,
        report:              reportValue,
        prescription:        prescriptionValue,
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

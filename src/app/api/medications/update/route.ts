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

export async function PATCH(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const form = await req.formData();
    const id = String(form.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const existing = await prisma.medicationRecord.findUnique({
      where: { id },
      include: { crop: { select: { farmId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, existing.crop.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    const birdsTreatedRaw = form.get("birdsTreated");
    const birdsTreated =
      birdsTreatedRaw === null || birdsTreatedRaw === "" ? null : Number(birdsTreatedRaw);

    let reportValue: string | null = existing.report;
    let prescriptionValue: string | null = existing.prescription;

    const reportFile = form.get("reportFile");
    if (reportFile instanceof File && reportFile.size > 0) {
      reportValue = await uploadMedFile(reportFile, existing.cropId, "report");
    }
    const prescriptionFile = form.get("prescriptionFile");
    if (prescriptionFile instanceof File && prescriptionFile.size > 0) {
      prescriptionValue = await uploadMedFile(prescriptionFile, existing.cropId, "prescription");
    }

    const startDate = String(form.get("startDate") || "").trim();
    const medicineName = String(form.get("medicineName") || "").trim();
    if (!startDate || !medicineName) {
      return NextResponse.json({ error: "startDate and medicineName are required." }, { status: 400 });
    }

    const record = await prisma.medicationRecord.update({
      where: { id },
      data: {
        startDate:           new Date(startDate),
        medicineName,
        supplier:            String(form.get("supplier")            || "") || null,
        batchNo:             String(form.get("batchNo")             || "") || null,
        expireDate:          form.get("expireDate")        ? new Date(String(form.get("expireDate")))        : null,
        quantityPurchased:   String(form.get("quantityPurchased")   || "") || null,
        quantityUsed:        String(form.get("quantityUsed")        || "") || null,
        animalIdentity:      String(form.get("animalIdentity")      || "") || null,
        housesTreated:       String(form.get("housesTreated")       || "") || null,
        birdsTreated,
        finishDate:          form.get("finishDate")        ? new Date(String(form.get("finishDate")))        : null,
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
      farmId: existing.crop.farmId,
      userId: uid,
      action: "UPDATE_MEDICATION",
      description: `Updated medication record "${record.medicineName}".`,
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("UPDATE MEDICATION ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

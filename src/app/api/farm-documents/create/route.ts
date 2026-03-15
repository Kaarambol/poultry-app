import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveFarmDocumentFile } from "@/lib/farm-document-storage";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

export const runtime = "nodejs";

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
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

    const farmId = String(form.get("farmId") || "").trim();
    const title = String(form.get("title") || "").trim();
    const documentType = String(form.get("documentType") || "").trim();
    const status = String(form.get("status") || "ACTIVE").trim();
    const documentFormat = String(
      form.get("documentFormat") || "ELECTRONIC"
    ).trim();

    const electronicCopy = parseBoolean(form.get("electronicCopy"));
    const officeCopy = parseBoolean(form.get("officeCopy"));
    const gateHouseCopy = parseBoolean(form.get("gateHouseCopy"));

    const issueDate = parseOptionalDate(form.get("issueDate"));
    const expiryDate = parseOptionalDate(form.get("expiryDate"));
    const nextReviewDate = parseOptionalDate(form.get("nextReviewDate"));

    const referenceNo = String(form.get("referenceNo") || "").trim();
    const issuer = String(form.get("issuer") || "").trim();
    const notes = String(form.get("notes") || "").trim();

    if (!farmId || !title || !documentType) {
      return NextResponse.json(
        { error: "farmId, title and documentType are required." },
        { status: 400 }
      );
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!farm) {
      return NextResponse.json(
        { error: "Farm not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to upload documents." },
        { status: 403 }
      );
    }

    let fileUrl: string | null = null;
    let blobPath: string | null = null;
    let originalFileName: string | null = null;
    let storedFileName: string | null = null;
    let mimeType: string | null = null;

    const fileValue = form.get("file");

    if (fileValue instanceof File && fileValue.size > 0) {
      const saved = await saveFarmDocumentFile({
        farmId,
        file: fileValue,
      });

      fileUrl = saved.fileUrl ?? null;
      blobPath = saved.blobPath ?? saved.storedFileName ?? null;
      originalFileName = saved.originalFileName ?? fileValue.name ?? null;
      storedFileName = saved.storedFileName ?? null;
      mimeType = saved.mimeType ?? fileValue.type ?? null;
    }

    const document = await prisma.farmDocument.create({
      data: {
        farmId,
        title,
        documentType,
        status,
        documentFormat,
        electronicCopy,
        officeCopy,
        gateHouseCopy,
        issueDate,
        expiryDate,
        nextReviewDate,
        fileUrl,
        blobPath,
        originalFileName,
        storedFileName,
        mimeType,
        referenceNo: referenceNo || null,
        issuer: issuer || null,
        notes: notes || null,
      },
    });

    await writeChangeLog({
      farmId,
      userId: uid,
      action: "CREATE_FARM_DOCUMENT",
      description: `Uploaded farm document "${document.title}" for farm ${farm.name}.`,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("CREATE FARM DOCUMENT ERROR:", error);

    return NextResponse.json(
      { error: "Server error while creating farm document." },
      { status: 500 }
    );
  }
}
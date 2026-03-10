import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveFarmDocumentFile } from "@/lib/farm-document-storage";

export const runtime = "nodejs";

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return new Date(text);
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const id = String(form.get("id") || "").trim();
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

    if (!id || !title || !documentType) {
      return NextResponse.json(
        { error: "id, title and documentType are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.farmDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    let fileUrl = existing.fileUrl;
    let originalFileName = existing.originalFileName;
    let storedFileName = existing.storedFileName;
    let mimeType = existing.mimeType;

    const fileValue = form.get("file");
    if (fileValue instanceof File && fileValue.size > 0) {
      const saved = await saveFarmDocumentFile({
        farmId: existing.farmId,
        file: fileValue,
      });

      fileUrl = saved.fileUrl;
      originalFileName = saved.originalFileName;
      storedFileName = saved.storedFileName;
      mimeType = saved.mimeType;
    }

    const updated = await prisma.farmDocument.update({
      where: { id },
      data: {
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
        originalFileName,
        storedFileName,
        mimeType,
        referenceNo: referenceNo || null,
        issuer: issuer || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE FARM DOCUMENT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while updating farm document." },
      { status: 500 }
    );
  }
}
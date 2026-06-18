import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveCropDocumentFile } from "@/lib/crop-document-storage";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const form = await req.formData();

    const cropId = String(form.get("cropId") || "").trim();
    const category = String(form.get("category") || "").trim();
    const title = String(form.get("title") || "").trim();
    const notes = String(form.get("notes") || "").trim();

    if (!cropId || !category || !title) {
      return NextResponse.json(
        { error: "cropId, category and title are required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      select: { id: true, farmId: true },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to upload crop documents." },
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
      const saved = await saveCropDocumentFile({ cropId, file: fileValue });
      fileUrl = saved.fileUrl ?? null;
      blobPath = saved.blobPath ?? null;
      originalFileName = saved.originalFileName ?? null;
      storedFileName = saved.storedFileName ?? null;
      mimeType = saved.mimeType ?? null;
    }

    const document = await prisma.cropDocument.create({
      data: {
        cropId,
        category,
        title,
        notes: notes || null,
        fileUrl,
        blobPath,
        originalFileName,
        storedFileName,
        mimeType,
        uploadedByUserId: uid,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("UPLOAD CROP DOCUMENT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while uploading crop document." },
      { status: 500 }
    );
  }
}

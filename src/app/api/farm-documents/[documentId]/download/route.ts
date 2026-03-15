import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";
import { getSignedUrl } from "@vercel/blob";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const { documentId } = await context.params;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document id is required." },
        { status: 400 }
      );
    }

    const document = await prisma.farmDocument.findUnique({
      where: { id: documentId },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, document.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this document." },
        { status: 403 }
      );
    }

    if (!document.blobPath) {
      return NextResponse.json(
        { error: "Document has no stored blob path." },
        { status: 400 }
      );
    }

    const signed = await getSignedUrl({
      pathname: document.blobPath,
      expiresIn: 60 * 10,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      url: signed.url,
      fileName: document.originalFileName,
      mimeType: document.mimeType,
      farmId: document.farmId,
      farmName: document.farm.name,
    });
  } catch (error) {
    console.error("DOWNLOAD FARM DOCUMENT ERROR:", error);

    return NextResponse.json(
      { error: "Server error while generating download link." },
      { status: 500 }
    );
  }
}
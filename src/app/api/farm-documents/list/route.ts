import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const farmId = String(req.nextUrl.searchParams.get("farmId") || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view farm documents." },
        { status: 403 }
      );
    }

    const documents = await prisma.farmDocument.findMany({
      where: {
        farmId,
      },
      orderBy: [
        { expiryDate: "asc" },
        { nextReviewDate: "asc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        farmId: true,
        title: true,
        documentType: true,
        status: true,
        documentFormat: true,
        electronicCopy: true,
        officeCopy: true,
        gateHouseCopy: true,
        issueDate: true,
        expiryDate: true,
        nextReviewDate: true,
        fileUrl: true,
        blobPath: true,
        originalFileName: true,
        storedFileName: true,
        mimeType: true,
        referenceNo: true,
        issuer: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("LIST FARM DOCUMENTS ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading farm documents." },
      { status: 500 }
    );
  }
}
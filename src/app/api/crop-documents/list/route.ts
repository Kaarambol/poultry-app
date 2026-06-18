import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const cropId = String(req.nextUrl.searchParams.get("cropId") || "").trim();

    if (!cropId) {
      return NextResponse.json({ error: "cropId is required." }, { status: 400 });
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      select: { id: true, farmId: true },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view crop documents." },
        { status: 403 }
      );
    }

    const documents = await prisma.cropDocument.findMany({
      where: { cropId },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ cropId, documents });
  } catch (error) {
    console.error("LIST CROP DOCUMENTS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading crop documents." },
      { status: 500 }
    );
  }
}

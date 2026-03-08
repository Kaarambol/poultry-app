import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canManageAccess } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    const url = new URL(req.url);
    const farmId = String(url.searchParams.get("farmId") || "").trim();

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canManageAccess(role)) {
      return NextResponse.json(
        { error: "Only OWNER can view backup history." },
        { status: 403 }
      );
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { code: true },
    });

    if (!farm) {
      return NextResponse.json(
        { error: "Farm not found." },
        { status: 404 }
      );
    }

    const prefix = `weekly-backups/${farm.code}/`;
    const result = await list({ prefix });

    const items = result.blobs
      .map((blob) => ({
        pathname: blob.pathname,
        url: blob.url,
        uploadedAt: blob.uploadedAt,
        size: blob.size,
      }))
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

    return NextResponse.json(items);
  } catch (error) {
    console.error("BACKUP HISTORY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading backup history." },
      { status: 500 }
    );
  }
}
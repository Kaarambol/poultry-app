import { NextRequest, NextResponse } from "next/server";
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
        { error: "Only OWNER can view change log." },
        { status: 403 }
      );
    }

    const logs = await prisma.changeLog.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("CHANGE LOG LIST ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading change log." },
      { status: 500 }
    );
  }
}
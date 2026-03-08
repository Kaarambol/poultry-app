import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canManageAccess } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const farmId = String(body.farmId || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canManageAccess(role)) {
      return NextResponse.json(
        { error: "Only OWNER can download full backup." },
        { status: 403 }
      );
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        houses: true,
        crops: {
          include: {
            placements: true,
            daily: true,
            medications: true,
            avaraExports: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!farm) {
      return NextResponse.json(
        { error: "Farm not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exportedAt: new Date(),
      farm,
    });
  } catch (error) {
    console.error("FARM BACKUP ERROR:", error);
    return NextResponse.json(
      { error: "Server error during backup." },
      { status: 500 }
    );
  }
}
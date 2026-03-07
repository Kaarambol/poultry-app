import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManageAccess } from "@/lib/permissions";

const ALLOWED_ROLES = ["OWNER", "MANAGER", "ASSISTANT_MANAGER", "VIEWER"];

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const farmUserId = String(body.farmUserId || "").trim();
    const role = String(body.role || "").trim().toUpperCase();

    if (!farmUserId || !role) {
      return NextResponse.json(
        { error: "farmUserId and role are required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const target = await prisma.farmUser.findUnique({
      where: { id: farmUserId },
    });

    if (!target) {
      return NextResponse.json({ error: "Access row not found." }, { status: 404 });
    }

    const myAccess = await prisma.farmUser.findFirst({
      where: {
        farmId: target.farmId,
        userId: uid,
      },
    });

    if (!myAccess) {
      return NextResponse.json({ error: "No access to this farm." }, { status: 403 });
    }

    if (!canManageAccess(myAccess.role)) {
      return NextResponse.json(
        { error: "Only OWNER can change roles." },
        { status: 403 }
      );
    }

    const updated = await prisma.farmUser.update({
      where: { id: farmUserId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("FARM ACCESS UPDATE ROLE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while updating role." },
      { status: 500 }
    );
  }
}
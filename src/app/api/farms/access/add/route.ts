import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManageAccess } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";
import { FarmRole } from "@prisma/client";

const ALLOWED_ROLES = ["OWNER", "MANAGER", "ASSISTANT_MANAGER", "VIEWER"];

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const farmId = String(body.farmId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim().toUpperCase();

    if (!farmId || !email || !role) {
      return NextResponse.json(
        { error: "farmId, email and role are required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 }
      );
    }

    const myAccess = await prisma.farmUser.findFirst({
      where: {
        farmId,
        userId: uid,
      },
    });

    if (!myAccess) {
      return NextResponse.json({ error: "No access to this farm." }, { status: 403 });
    }

    if (!canManageAccess(myAccess.role)) {
      return NextResponse.json(
        { error: "Only OWNER can add users to the farm." },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User with this email does not exist." },
        { status: 404 }
      );
    }

    const existing = await prisma.farmUser.findFirst({
      where: {
        farmId,
        userId: user.id,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This user already has access to the farm." },
        { status: 409 }
      );
    }

    const created = await prisma.farmUser.create({
      data: {
        farmId,
        userId: user.id,
        role: role as FarmRole,
      },
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

    await writeChangeLog({
      farmId,
      userId: uid,
      action: "ADD_USER_ACCESS",
      description: `Added ${created.user.email} to farm with role ${created.role}.`,
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("FARM ACCESS ADD ERROR:", error);
    return NextResponse.json(
      { error: "Server error while adding farm access." },
      { status: 500 }
    );
  }
}
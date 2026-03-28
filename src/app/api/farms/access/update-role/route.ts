import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManageAccess } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";
import { FarmRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const { farmUserId, role } = body;

    if (!farmUserId || !role) {
      return NextResponse.json(
        { error: "farmUserId and role are required." },
        { status: 400 }
      );
    }

    // Find the access record to update
    const targetAccess = await prisma.farmUser.findUnique({
      where: { id: farmUserId },
    });

    if (!targetAccess) {
      return NextResponse.json({ error: "Access record not found." }, { status: 404 });
    }

    // Check permissions of the requesting user
    const myAccess = await prisma.farmUser.findFirst({
      where: {
        farmId: targetAccess.farmId,
        userId: uid,
      },
    });

    if (!myAccess || !canManageAccess(myAccess.role)) {
      return NextResponse.json(
        { error: "Only OWNER or MANAGER can update roles." },
        { status: 403 }
      );
    }

    const updated = await prisma.farmUser.update({
      where: { id: farmUserId },
      data: { 
        role: role as FarmRole
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
      farmId: targetAccess.farmId,
      userId: uid,
      action: "UPDATE_USER_ROLE",
      description: `Updated role for ${updated.user.email} to ${updated.role}.`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while updating role." },
      { status: 500 }
    );
  }
}
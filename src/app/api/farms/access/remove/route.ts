import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManageAccess } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const farmUserId = String(body.farmUserId || "").trim();

    if (!farmUserId) {
      return NextResponse.json(
        { error: "farmUserId is required." },
        { status: 400 }
      );
    }

    const target = await prisma.farmUser.findUnique({
      where: { id: farmUserId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
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
        { error: "Only OWNER can remove users from the farm." },
        { status: 403 }
      );
    }

    if (target.userId === uid) {
      return NextResponse.json(
        { error: "Owner cannot remove themselves." },
        { status: 400 }
      );
    }

    await prisma.farmUser.delete({
      where: { id: farmUserId },
    });

    await writeChangeLog({
      farmId: target.farmId,
      userId: uid,
      action: "REMOVE_USER_ACCESS",
      description: `Removed ${target.user.email} from farm access.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FARM ACCESS REMOVE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while removing farm access." },
      { status: 500 }
    );
  }
}
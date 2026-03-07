import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Record id is required." },
        { status: 400 }
      );
    }

    const existingRecord = await prisma.dailyRecord.findUnique({
      where: { id },
      include: {
        crop: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Daily record not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, existingRecord.crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    if (existingRecord.crop.status === "FINISHED") {
      return NextResponse.json(
        { error: "Cannot delete daily records from a finished crop." },
        { status: 409 }
      );
    }

    await prisma.dailyRecord.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE DAILY RECORD ERROR:", error);
    return NextResponse.json(
      { error: "Server error while deleting daily record." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

export async function DELETE(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const existing = await prisma.medicationRecord.findUnique({
      where: { id },
      include: { crop: { select: { farmId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, existing.crop.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    await prisma.medicationRecord.delete({ where: { id } });

    await writeChangeLog({
      farmId: existing.crop.farmId,
      userId: uid,
      action: "DELETE_MEDICATION",
      description: `Deleted medication record "${existing.medicineName}".`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE MEDICATION ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

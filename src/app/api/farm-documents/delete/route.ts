import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const document = await prisma.farmDocument.findUnique({
      where: { id },
      select: { id: true, farmId: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, document.farmId);
    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete documents." },
        { status: 403 }
      );
    }

    await prisma.farmDocument.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE FARM DOCUMENT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while deleting farm document." },
      { status: 500 }
    );
  }
}

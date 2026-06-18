import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const document = await prisma.cropDocument.findUnique({
      where: { id },
      select: {
        id: true,
        cropId: true,
        crop: { select: { farmId: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, document.crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete crop documents." },
        { status: 403 }
      );
    }

    await prisma.cropDocument.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE CROP DOCUMENT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while deleting crop document." },
      { status: 500 }
    );
  }
}

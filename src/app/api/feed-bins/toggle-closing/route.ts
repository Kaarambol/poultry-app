import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

// PATCH /api/feed-bins/toggle-closing
// Body: { binId, farmId, isClosingStock }
export async function PATCH(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const farmId: string = body.farmId ?? "";
    const binId: string = body.binId ?? "";
    const isClosingStock: boolean = !!body.isClosingStock;

    if (!farmId || !binId) return NextResponse.json({ error: "farmId and binId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    const updated = await prisma.feedBin.update({
      where: { id: binId },
      data: { isClosingStock },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("TOGGLE CLOSING STOCK ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

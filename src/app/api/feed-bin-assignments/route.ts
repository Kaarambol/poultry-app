import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView, canOperate } from "@/lib/permissions";

// GET /api/feed-bin-assignments?farmId=xxx
// Returns: { houseId: string, binIds: string[] }[]
export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = req.nextUrl.searchParams.get("farmId") ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    const assignments = await prisma.feedBinAssignment.findMany({
      where: { farmId },
      select: { houseId: true, binId: true },
    });

    // Group by houseId
    const map: Record<string, string[]> = {};
    for (const a of assignments) {
      if (!map[a.houseId]) map[a.houseId] = [];
      map[a.houseId].push(a.binId);
    }

    return NextResponse.json(map);
  } catch (e) {
    console.error("FEED BIN ASSIGNMENTS GET ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

// POST /api/feed-bin-assignments
// Body: { farmId, assignments: { houseId, binIds: string[] }[] }
export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const farmId: string = body.farmId ?? "";
    const assignments: { houseId: string; binIds: string[] }[] = body.assignments ?? [];

    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    const rows = assignments.flatMap(({ houseId, binIds }) =>
      binIds.map(binId => ({ farmId, houseId, binId }))
    );

    await prisma.$transaction([
      prisma.feedBinAssignment.deleteMany({ where: { farmId } }),
      prisma.feedBinAssignment.createMany({ data: rows }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("FEED BIN ASSIGNMENTS POST ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

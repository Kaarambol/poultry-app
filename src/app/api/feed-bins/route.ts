import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView, canOperate } from "@/lib/permissions";

// GET /api/feed-bins?farmId=xxx
export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = req.nextUrl.searchParams.get("farmId") ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    const bins = await prisma.feedBin.findMany({
      where: { farmId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(bins);
  } catch (e) {
    console.error("FEED BINS GET ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

// POST /api/feed-bins — replace all bins for a farm
// Body: { farmId, bins: [{ name, capacityTonnes }] }
export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const farmId: string = body.farmId ?? "";
    const bins: { name: string; capacityTonnes: number }[] = body.bins ?? [];

    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    // Replace all bins for this farm in a transaction
    await prisma.$transaction([
      prisma.feedBin.deleteMany({ where: { farmId } }),
      prisma.feedBin.createMany({
        data: bins.map((b, i) => ({
          farmId,
          name: b.name.trim(),
          capacityTonnes: b.capacityTonnes,
          sortOrder: i,
        })),
      }),
    ]);

    const saved = await prisma.feedBin.findMany({
      where: { farmId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(saved);
  } catch (e: any) {
    console.error("FEED BINS POST ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView, canOperate } from "@/lib/permissions";

// GET /api/feed-order-stock?farmId=xxx
export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = req.nextUrl.searchParams.get("farmId") ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    const stock = await prisma.feedOrderStock.findUnique({ where: { farmId } });
    return NextResponse.json(stock ?? { activeStockTonnes: 0, closingBinId: null, closingBinTonnes: 0 });
  } catch (e) {
    console.error("FEED ORDER STOCK GET ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

// POST /api/feed-order-stock
// Body: { farmId, activeStockTonnes, closingBinId, closingBinTonnes }
export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const farmId: string = body.farmId ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    const activeStockTonnes = parseFloat(body.activeStockTonnes) || 0;

    const saved = await prisma.feedOrderStock.upsert({
      where: { farmId },
      update: { activeStockTonnes },
      create: { farmId, activeStockTonnes },
    });

    return NextResponse.json(saved);
  } catch (e: any) {
    console.error("FEED ORDER STOCK POST ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

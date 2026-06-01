import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView, canOperate } from "@/lib/permissions";

// GET /api/feed-phases?farmId=xxx
export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = req.nextUrl.searchParams.get("farmId") ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    const template = await prisma.feedPhaseTemplate.findUnique({
      where: { farmId },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(template?.phases ?? []);
  } catch (e) {
    console.error("FEED PHASES GET ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

// POST /api/feed-phases — replace all phases for a farm
// Body: { farmId, phases: [{ feedProduct, dayFrom, dayTo }] }
export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const farmId: string = body.farmId ?? "";
    const phases: { feedProduct: string; dayFrom: number; dayTo: number | null; wheatPct: number; ownWheat: boolean }[] = body.phases ?? [];

    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Permission denied." }, { status: 403 });

    // Upsert template then replace phases
    const template = await prisma.feedPhaseTemplate.upsert({
      where: { farmId },
      update: {},
      create: { farmId },
    });

    await prisma.$transaction([
      prisma.feedPhase.deleteMany({ where: { templateId: template.id } }),
      prisma.feedPhase.createMany({
        data: phases.map((p, i) => ({
          templateId: template.id,
          feedProduct: p.feedProduct,
          dayFrom: p.dayFrom,
          dayTo: p.dayTo ?? null,
          sortOrder: i,
          wheatPct: p.wheatPct ?? 0,
          ownWheat: p.ownWheat ?? false,
        })),
      }),
    ]);

    const saved = await prisma.feedPhase.findMany({
      where: { templateId: template.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(saved);
  } catch (e: any) {
    console.error("FEED PHASES POST ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

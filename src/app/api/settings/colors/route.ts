import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mergeWithDefaults } from "@/lib/color-defaults";

export async function GET(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const record = await prisma.userColorSettings.findUnique({ where: { userId: uid } });
  const saved = (record?.colors as Record<string, any>) ?? {};
  return NextResponse.json(mergeWithDefaults(saved));
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await req.json();
  const colors = body.colors ?? {};

  await prisma.userColorSettings.upsert({
    where:  { userId: uid },
    update: { colors },
    create: { userId: uid, colors },
  });

  return NextResponse.json({ ok: true });
}

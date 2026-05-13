import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIsSuperAdmin } from "@/lib/permissions";

type RouteContext = { params: Promise<{ topicId: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!(await checkIsSuperAdmin(uid))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { topicId } = await context.params;
  const topic = await prisma.forumTopic.findUnique({ where: { id: topicId }, select: { id: true } });
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  await prisma.forumTopic.delete({ where: { id: topicId } });
  return NextResponse.json({ ok: true });
}

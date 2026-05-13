import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIsSuperAdmin } from "@/lib/permissions";

type RouteContext = { params: Promise<{ postId: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!(await checkIsSuperAdmin(uid))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { postId } = await context.params;
  const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await prisma.forumPost.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}

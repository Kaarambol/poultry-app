import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIsSuperAdmin } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!(await checkIsSuperAdmin(uid))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const topics = await prisma.forumTopic.findMany({
    orderBy: { lastPostAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      _count: { select: { posts: true } },
      posts: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return NextResponse.json(topics);
}

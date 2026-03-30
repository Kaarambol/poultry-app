import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const { topicId } = await params;
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { id: true },
    });
    if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

    const body = await req.json();
    const content = String(body.content || "").trim();
    if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

    const now = new Date();

    const [post] = await prisma.$transaction([
      prisma.forumPost.create({
        data: { topicId, content, authorId: uid },
        include: { author: { select: { id: true, name: true, email: true } } },
      }),
      prisma.forumTopic.update({
        where: { id: topicId },
        data: { lastPostAt: now },
      }),
    ]);

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("FORUM CREATE POST ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

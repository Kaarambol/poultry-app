import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_MS);

    // Auto-cleanup expired topics (no post for 6 months)
    await prisma.forumTopic.deleteMany({
      where: { lastPostAt: { lt: sixMonthsAgo } },
    });

    const topics = await prisma.forumTopic.findMany({
      orderBy: { lastPostAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
        _count: { select: { posts: true } },
      },
    });

    return NextResponse.json(topics);
  } catch (error) {
    console.error("FORUM GET TOPICS ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required." }, { status: 400 });
    }

    const topic = await prisma.forumTopic.create({
      data: { title, content, authorId: uid },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    console.error("FORUM CREATE TOPIC ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ADMIN_PIN = "5991";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const { topicId } = await params;
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: {
        author: { select: { id: true, name: true, email: true } },
        posts: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    return NextResponse.json(topic);
  } catch (error) {
    console.error("FORUM GET TOPIC ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const { topicId } = await params;
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { id: true, authorId: true },
    });

    if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

    // Author can delete without PIN; anyone else needs the admin PIN
    if (topic.authorId !== uid) {
      const body = await req.json().catch(() => ({}));
      const pin = String(body.pin || "").trim();
      if (pin !== ADMIN_PIN) {
        return NextResponse.json({ error: "Invalid PIN." }, { status: 403 });
      }
    }

    await prisma.forumTopic.delete({ where: { id: topicId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FORUM DELETE TOPIC ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

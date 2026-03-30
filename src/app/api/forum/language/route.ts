import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ language: "en" });

    const pref = await prisma.userForumLanguage.findUnique({ where: { userId: uid } });
    return NextResponse.json({ language: pref?.language ?? "en" });
  } catch (error) {
    console.error("FORUM GET LANGUAGE ERROR:", error);
    return NextResponse.json({ language: "en" });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const language = String(body.language || "en").trim();

    await prisma.userForumLanguage.upsert({
      where: { userId: uid },
      update: { language },
      create: { userId: uid, language },
    });

    return NextResponse.json({ ok: true, language });
  } catch (error) {
    console.error("FORUM SET LANGUAGE ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

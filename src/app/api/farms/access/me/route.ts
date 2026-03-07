import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    const url = new URL(req.url);
    const farmId = String(url.searchParams.get("farmId") || "").trim();

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    if (!farmId) {
      return NextResponse.json({ error: "farmId is required." }, { status: 400 });
    }

    const access = await prisma.farmUser.findFirst({
      where: {
        farmId,
        userId: uid,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!access) {
      return NextResponse.json({ error: "No access to this farm." }, { status: 403 });
    }

    return NextResponse.json(access);
  } catch (error) {
    console.error("FARM ACCESS ME ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading current access." },
      { status: 500 }
    );
  }
}
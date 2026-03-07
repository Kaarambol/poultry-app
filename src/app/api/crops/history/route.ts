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

    const farmAccess = await prisma.farmUser.findFirst({
      where: {
        farmId,
        userId: uid,
      },
    });

    if (!farmAccess) {
      return NextResponse.json({ error: "No access to this farm." }, { status: 403 });
    }

    const crops = await prisma.crop.findMany({
      where: {
        farmId,
        status: "FINISHED",
      },
      orderBy: {
        finishDate: "desc",
      },
    });

    return NextResponse.json(crops);
  } catch (error) {
    console.error("CROP HISTORY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading crop history." },
      { status: 500 }
    );
  }
}
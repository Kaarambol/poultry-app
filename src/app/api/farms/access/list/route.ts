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
    });

    if (!access) {
      return NextResponse.json({ error: "No access to this farm." }, { status: 403 });
    }

    const items = await prisma.farmUser.findMany({
      where: { farmId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          email: "asc",
        },
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("FARM ACCESS LIST ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading farm access list." },
      { status: 500 }
    );
  }
}
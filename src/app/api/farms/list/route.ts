import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const farms = await prisma.farm.findMany({
      where: {
        farmUsers: {
          some: {
            userId: uid,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(farms);
  } catch (error) {
    console.error("LIST FARMS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading farms." },
      { status: 500 }
    );
  }
}
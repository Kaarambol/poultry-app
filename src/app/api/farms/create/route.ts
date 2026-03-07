import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim();

    if (!name || !code) {
      return NextResponse.json(
        { error: "Farm name and code are required." },
        { status: 400 }
      );
    }

    const farm = await prisma.farm.create({
      data: {
        name,
        code,
        farmUsers: {
          create: {
            userId: uid,
            role: "OWNER",
          },
        },
      },
    });

    return NextResponse.json(farm);
  } catch (error) {
    console.error("CREATE FARM ERROR:", error);
    return NextResponse.json(
      { error: "Server error while creating farm." },
      { status: 500 }
    );
  }
}
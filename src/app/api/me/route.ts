import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, name: true, email: true },
    });

    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error("ME ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const user = await prisma.user.update({
      where: { id: uid },
      data: { name },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error("ME PATCH ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

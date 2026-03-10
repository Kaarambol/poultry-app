import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "id is required." },
        { status: 400 }
      );
    }

    await prisma.farmDocument.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE FARM DOCUMENT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while deleting farm document." },
      { status: 500 }
    );
  }
}
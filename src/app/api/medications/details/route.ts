import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "id is required." },
        { status: 400 }
      );
    }

    const record = await prisma.medicationRecord.findUnique({
      where: { id },
      include: {
        crop: {
          include: {
            farm: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Medication record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("MEDICATION DETAILS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading medication record." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseOptionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const cropId = String(body.cropId || "").trim();
    const finalBirdsSold = parseOptionalInt(body.finalBirdsSold);
    const finalAvgWeightKg = parseOptionalFloat(body.finalAvgWeightKg);
    const finalRevenueGbp = parseOptionalFloat(body.finalRevenueGbp);
    const finalNotes = String(body.finalNotes || "").trim();
    const saleWeightKg = parseOptionalFloat(body.saleWeightKg);
    const acceptWeightKg = parseOptionalFloat(body.acceptWeightKg);

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const updated = await prisma.crop.update({
      where: { id: cropId },
      data: {
        finalBirdsSold,
        finalAvgWeightKg,
        finalRevenueGbp,
        finalNotes: finalNotes || null,
        saleWeightKg,
        acceptWeightKg,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("FINALIZE CROP ERROR:", error);
    return NextResponse.json(
      { error: "Server error while saving final crop numbers." },
      { status: 500 }
    );
  }
}
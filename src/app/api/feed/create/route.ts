import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALLOWED_FEED_PRODUCTS = [
  "STARTER_CRUMB_185",
  "REARER_PELLET_385",
  "GROWER_PELLET_485",
  "FINISHER_PELLET_585",
  "WHEAT",
] as const;

function parseOptionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const cropId = String(body.cropId || "").trim();
    const houseIdRaw = String(body.houseId || "").trim();
    const date = String(body.date || "").trim();
    const feedProduct = String(body.feedProduct || "").trim();
    const ticketNumber = String(body.ticketNumber || "").trim();
    const supplier = String(body.supplier || "").trim();
    const notes = String(body.notes || "").trim();

    const feedKg = Number(body.feedKg || 0);
    const wheatKg = Number(body.wheatKg || 0);
    const feedPricePerTonneGbp = parseOptionalFloat(body.feedPricePerTonneGbp);
    const wheatPricePerTonneGbp = parseOptionalFloat(body.wheatPricePerTonneGbp);

    if (!farmId || !cropId || !date || !feedProduct || !ticketNumber) {
      return NextResponse.json(
        {
          error:
            "farmId, cropId, date, feedProduct and ticketNumber are required.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_FEED_PRODUCTS.includes(
        feedProduct as (typeof ALLOWED_FEED_PRODUCTS)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid feed product." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(feedKg) || feedKg < 0) {
      return NextResponse.json(
        { error: "feedKg must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(wheatKg) || wheatKg < 0) {
      return NextResponse.json(
        { error: "wheatKg must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (feedKg === 0 && wheatKg === 0) {
      return NextResponse.json(
        { error: "At least one of feedKg or wheatKg must be greater than zero." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    if (crop.farmId !== farmId) {
      return NextResponse.json(
        { error: "Selected crop does not belong to selected farm." },
        { status: 400 }
      );
    }

    if (houseIdRaw) {
      const house = await prisma.house.findUnique({
        where: { id: houseIdRaw },
      });

      if (!house || house.farmId !== farmId) {
        return NextResponse.json(
          { error: "Selected house does not belong to selected farm." },
          { status: 400 }
        );
      }
    }

    const record = await prisma.feedRecord.create({
      data: {
        farmId,
        cropId,
        houseId: houseIdRaw || null,
        date: new Date(date),
        feedProduct,
        feedKg,
        wheatKg,
        ticketNumber,
        feedPricePerTonneGbp,
        wheatPricePerTonneGbp,
        supplier: supplier || null,
        notes: notes || null,
      },
      include: {
        house: true,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("CREATE FEED RECORD ERROR:", error);
    return NextResponse.json(
      { error: "Server error while creating feed record." },
      { status: 500 }
    );
  }
}
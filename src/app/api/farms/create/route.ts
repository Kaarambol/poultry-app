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
    const feedContractor = String(body.feedContractor || "").trim() || null;
    const chickenSupplier = String(body.chickenSupplier || "").trim() || null;

    const feedPrice1 =
      body.feedPrice1 === undefined || body.feedPrice1 === null || body.feedPrice1 === ""
        ? null
        : Number(body.feedPrice1);

    const feedPrice2 =
      body.feedPrice2 === undefined || body.feedPrice2 === null || body.feedPrice2 === ""
        ? null
        : Number(body.feedPrice2);

    const feedPrice3 =
      body.feedPrice3 === undefined || body.feedPrice3 === null || body.feedPrice3 === ""
        ? null
        : Number(body.feedPrice3);

    const feedPrice4 =
      body.feedPrice4 === undefined || body.feedPrice4 === null || body.feedPrice4 === ""
        ? null
        : Number(body.feedPrice4);

    const feedPrice5 =
      body.feedPrice5 === undefined || body.feedPrice5 === null || body.feedPrice5 === ""
        ? null
        : Number(body.feedPrice5);

    const wheatPrice =
      body.wheatPrice === undefined || body.wheatPrice === null || body.wheatPrice === ""
        ? null
        : Number(body.wheatPrice);

    const chickenPrice =
      body.chickenPrice === undefined || body.chickenPrice === null || body.chickenPrice === ""
        ? null
        : Number(body.chickenPrice);

    const liveWeightPricePerKg =
      body.liveWeightPricePerKg === undefined ||
      body.liveWeightPricePerKg === null ||
      body.liveWeightPricePerKg === ""
        ? null
        : Number(body.liveWeightPricePerKg);

    if (!name || !code) {
      return NextResponse.json(
        { error: "Farm name and code are required." },
        { status: 400 }
      );
    }

    if (
      [
        feedPrice1,
        feedPrice2,
        feedPrice3,
        feedPrice4,
        feedPrice5,
        wheatPrice,
        chickenPrice,
        liveWeightPricePerKg,
      ].some((value) => value !== null && Number.isNaN(value))
    ) {
      return NextResponse.json(
        { error: "One or more price fields are invalid." },
        { status: 400 }
      );
    }

    const existingFarm = await prisma.farm.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existingFarm) {
      return NextResponse.json(
        { error: "Farm code already exists." },
        { status: 409 }
      );
    }

    const farm = await prisma.farm.create({
      data: {
        name,
        code,
        createdByUserId: uid,
        feedContractor,
        chickenSupplier,
        feedPrice1,
        feedPrice2,
        feedPrice3,
        feedPrice4,
        feedPrice5,
        wheatPrice,
        chickenPrice,
        liveWeightPricePerKg,
        farmUsers: {
          create: {
            userId: uid,
            role: "OWNER",
          },
        },
      },
      include: {
        farmUsers: true,
      },
    });

    return NextResponse.json(farm, { status: 201 });
  } catch (error) {
    console.error("CREATE FARM ERROR:", error);

    return NextResponse.json(
      { error: "Server error while creating farm." },
      { status: 500 }
    );
  }
}
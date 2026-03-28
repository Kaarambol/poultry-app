import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canEditOrDeleteFarm } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{
    farmId: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const { farmId } = await context.params;

    if (!farmId) {
      return NextResponse.json(
        { error: "Farm id is required." },
        { status: 400 }
      );
    }

    const allowed = await canEditOrDeleteFarm(uid, farmId);

    if (!allowed) {
      return NextResponse.json(
        { error: "You can edit only farms created by yourself." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const name = String(body.name || "").trim();
    const code = String(body.code || "").trim();
    const feedContractor = String(body.feedContractor || "").trim() || null;
    const chickenSupplier = String(body.chickenSupplier || "").trim() || null;

    const farmNumber            = String(body.farmNumber            || "").trim() || null;
    const chpCode               = String(body.chpCode               || "").trim() || null;
    const rodentControl         = String(body.rodentControl         || "").trim() || null;
    const disinfectProgramme    = String(body.disinfectProgramme    || "").trim() || null;
    const waterSanitizer        = String(body.waterSanitizer        || "").trim() || null;
    const footDipDisinfectant   = String(body.footDipDisinfectant   || "").trim() || null;
    const cleaningContractor    = String(body.cleaningContractor    || "").trim() || null;
    const vetContractor         = String(body.vetContractor         || "").trim() || null;
    const electricianContractor = String(body.electricianContractor || "").trim() || null;
    const generatorService      = String(body.generatorService      || "").trim() || null;
    const weedkiller            = String(body.weedkiller            || "").trim() || null;
    const security              = String(body.security              || "").trim() || null;

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

    const existingFarm = await prisma.farm.findFirst({
      where: {
        code,
        NOT: {
          id: farmId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingFarm) {
      return NextResponse.json(
        { error: "Farm code already exists." },
        { status: 409 }
      );
    }

    const farm = await prisma.farm.update({
      where: {
        id: farmId,
      },
      data: {
        name,
        code,
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
        farmNumber,
        chpCode,
        rodentControl,
        disinfectProgramme,
        waterSanitizer,
        footDipDisinfectant,
        cleaningContractor,
        vetContractor,
        electricianContractor,
        generatorService,
        weedkiller,
        security,
      },
    });

    return NextResponse.json(farm);
  } catch (error) {
    console.error("UPDATE FARM ERROR:", error);

    return NextResponse.json(
      { error: "Server error while updating farm." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const { farmId } = await context.params;

    if (!farmId) {
      return NextResponse.json(
        { error: "Farm id is required." },
        { status: 400 }
      );
    }

    const allowed = await canEditOrDeleteFarm(uid, farmId);

    if (!allowed) {
      return NextResponse.json(
        { error: "You can delete only farms created by yourself." },
        { status: 403 }
      );
    }

    await prisma.farm.delete({
      where: {
        id: farmId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE FARM ERROR:", error);

    return NextResponse.json(
      { error: "Server error while deleting farm." },
      { status: 500 }
    );
  }
}
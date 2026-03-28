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
      select: {
        id: true,
        name: true,
        code: true,
        createdByUserId: true,
        feedContractor: true,
        chickenSupplier: true,
        feedPrice1: true,
        feedPrice2: true,
        feedPrice3: true,
        feedPrice4: true,
        feedPrice5: true,
        wheatPrice: true,
        chickenPrice: true,
        liveWeightPricePerKg: true,
        farmNumber: true,
        chpCode: true,
        rodentControl: true,
        disinfectProgramme: true,
        waterSanitizer: true,
        footDipDisinfectant: true,
        cleaningContractor: true,
        vetContractor: true,
        electricianContractor: true,
        generatorService: true,
        weedkiller: true,
        security: true,
      },
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
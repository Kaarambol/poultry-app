import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();
    const date = String(url.searchParams.get("date") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const where: {
      cropId: string;
      date?: Date;
    } = { cropId };

    if (date) {
      where.date = new Date(date);
    }

    const records = await prisma.nightCheck.findMany({
      where,
    });

    const totalChecks = records.length;
    const highCo2Count = records.filter((r) => r.co2Ppm !== null && r.co2Ppm > 3000).length;
    const highAmmoniaCount = records.filter(
      (r) => r.ammoniaPpm !== null && r.ammoniaPpm > 20
    ).length;
    const poorLitterCount = records.filter(
      (r) => r.litterScore !== null && r.litterScore >= 4
    ).length;

    const allChecklistOkCount = records.filter(
      (r) =>
        r.windowsOpen &&
        r.fridgeTemp &&
        r.litterSampleTaken &&
        r.fireExtinguisher &&
        r.footDipChange &&
        r.dosatronCheck &&
        r.vitaminAdd &&
        r.vaccination &&
        r.medication &&
        r.pestControlInspection &&
        r.waterSanitizer &&
        r.calibrationWaterMeter &&
        r.calibrationTempProbe &&
        r.calibrationHumidityProbe &&
        r.calibrationWeigher
    ).length;

    return NextResponse.json({
      totalChecks,
      highCo2Count,
      highAmmoniaCount,
      poorLitterCount,
      allChecklistOkCount,
    });
  } catch (error) {
    console.error("NIGHT CHECK SUMMARY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading night check summary." },
      { status: 500 }
    );
  }
}
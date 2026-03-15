import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

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

function parseBoolean(value: unknown) {
  return value === true;
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const incomingCropId = String(body.cropId || "").trim();
    const houseId = String(body.houseId || "").trim();
    const date = String(body.date || "").trim();
    const checkTime = String(body.checkTime || "").trim();
    const checkedByName = String(body.checkedByName || "").trim();

    const humidityPct = parseOptionalFloat(body.humidityPct);
    const co2Ppm = parseOptionalInt(body.co2Ppm);
    const ammoniaPpm = parseOptionalFloat(body.ammoniaPpm);

    const litterScore = parseOptionalInt(body.litterScore);
    const wetAreas = parseBoolean(body.wetAreas);
    const capping = parseBoolean(body.capping);
    const litterNotes = String(body.litterNotes || "").trim();

    const waterSystemOk = parseBoolean(body.waterSystemOk);
    const feedSystemOk = parseBoolean(body.feedSystemOk);
    const ventilationOk = parseBoolean(body.ventilationOk);
    const alarmOk = parseBoolean(body.alarmOk);
    const generatorOk = parseBoolean(body.generatorOk);
    const lightingOk = parseBoolean(body.lightingOk);

    const birdsOk = parseBoolean(body.birdsOk);
    const cropFillOk = parseBoolean(body.cropFillOk);
    const unusualBehaviour = parseBoolean(body.unusualBehaviour);

    const windowsOpen = parseBoolean(body.windowsOpen);
    const fridgeTemp = parseBoolean(body.fridgeTemp);
    const litterSampleTaken = parseBoolean(body.litterSampleTaken);

    const fireExtinguisher = parseBoolean(body.fireExtinguisher);
    const footDipChange = parseBoolean(body.footDipChange);
    const dosatronCheck = parseBoolean(body.dosatronCheck);
    const vitaminAdd = parseBoolean(body.vitaminAdd);
    const vaccination = parseBoolean(body.vaccination);
    const medication = parseBoolean(body.medication);
    const pestControlInspection = parseBoolean(body.pestControlInspection);
    const waterSanitizer = parseBoolean(body.waterSanitizer);

    const calibrationWaterMeter = parseBoolean(body.calibrationWaterMeter);
    const calibrationTempProbe = parseBoolean(body.calibrationTempProbe);
    const calibrationHumidityProbe = parseBoolean(body.calibrationHumidityProbe);
    const calibrationWeigher = parseBoolean(body.calibrationWeigher);

    const comments = String(body.comments || "").trim();

    if (!farmId || !houseId || !date) {
      return NextResponse.json(
        { error: "farmId, houseId and date are required." },
        { status: 400 }
      );
    }

    if (litterScore !== null && (litterScore < 1 || litterScore > 6)) {
      return NextResponse.json(
        { error: "Litter score must be between 1 and 6." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    const nightCheckDate = new Date(date);

    if (Number.isNaN(nightCheckDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid night check date." },
        { status: 400 }
      );
    }

    let cropId = incomingCropId;

    if (!cropId) {
      const activeCrop = await prisma.crop.findFirst({
        where: {
          farmId,
          status: "ACTIVE",
        },
        orderBy: {
          placementDate: "desc",
        },
        select: {
          id: true,
        },
      });

      if (!activeCrop) {
        return NextResponse.json(
          { error: "No active crop found for this farm." },
          { status: 404 }
        );
      }

      cropId = activeCrop.id;
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        placements: {
          where: {
            isActive: true,
          },
          select: {
            houseId: true,
          },
        },
      },
    });

    if (!crop || crop.farmId !== farmId) {
      return NextResponse.json(
        { error: "Selected crop does not belong to selected farm." },
        { status: 400 }
      );
    }

    if (crop.status === "FINISHED") {
      return NextResponse.json(
        { error: "Cannot save night check for a finished crop." },
        { status: 409 }
      );
    }

    const activeHouseIds = new Set(crop.placements.map((p) => p.houseId));

    let targetHouses:
      | Array<{ id: string; name: string; code: string | null; farmId: string }>
      | [] = [];

    if (houseId === "ALL") {
      targetHouses = await prisma.house.findMany({
        where: {
          farmId,
          id: {
            in: Array.from(activeHouseIds),
          },
        },
        select: {
          id: true,
          name: true,
          code: true,
          farmId: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      if (!targetHouses.length) {
        return NextResponse.json(
          { error: "No active houses assigned to this crop." },
          { status: 400 }
        );
      }
    } else {
      const house = await prisma.house.findUnique({
        where: { id: houseId },
        select: {
          id: true,
          name: true,
          code: true,
          farmId: true,
        },
      });

      if (!house || house.farmId !== farmId) {
        return NextResponse.json(
          { error: "Selected house does not belong to selected farm." },
          { status: 400 }
        );
      }

      if (!activeHouseIds.has(house.id)) {
        return NextResponse.json(
          { error: "Selected house is not assigned to this crop." },
          { status: 400 }
        );
      }

      targetHouses = [house];
    }

    const updateData = {
      checkedByUserId: uid,
      checkTime: checkTime || null,
      checkedByName: checkedByName || null,
      humidityPct,
      co2Ppm,
      ammoniaPpm,
      litterScore,
      wetAreas,
      capping,
      litterNotes: litterNotes || null,

      waterSystemOk,
      feedSystemOk,
      ventilationOk,
      alarmOk,
      generatorOk,
      lightingOk,

      birdsOk,
      cropFillOk,
      unusualBehaviour,

      windowsOpen,
      fridgeTemp,
      litterSampleTaken,

      fireExtinguisher,
      footDipChange,
      dosatronCheck,
      vitaminAdd,
      vaccination,
      medication,
      pestControlInspection,
      waterSanitizer,

      calibrationWaterMeter,
      calibrationTempProbe,
      calibrationHumidityProbe,
      calibrationWeigher,

      comments: comments || null,
    };

    const records = await prisma.$transaction(
      targetHouses.map((house) =>
        prisma.nightCheck.upsert({
          where: {
            cropId_houseId_date: {
              cropId,
              houseId: house.id,
              date: nightCheckDate,
            },
          },
          update: updateData,
          create: {
            farmId,
            cropId,
            houseId: house.id,
            date: nightCheckDate,
            ...updateData,
          },
          include: {
            house: true,
          },
        })
      )
    );

    await writeChangeLog({
      farmId,
      userId: uid,
      action: "CREATE_NIGHT_CHECK",
      description:
        houseId === "ALL"
          ? `Saved night check for all houses on ${new Date(nightCheckDate).toLocaleDateString()}.`
          : `Saved night check for ${records[0]?.house?.name || "house"} on ${new Date(
              nightCheckDate
            ).toLocaleDateString()}.`,
    });

    return NextResponse.json(
      {
        ok: true,
        count: records.length,
        records,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE NIGHT CHECK ERROR:", error);

    return NextResponse.json(
      { error: "Server error while saving night check." },
      { status: 500 }
    );
  }
}
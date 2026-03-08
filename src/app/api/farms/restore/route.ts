import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canManageAccess } from "@/lib/permissions";

type BackupPayload = {
  exportedAt?: string;
  version?: number;
  farm?: {
    name?: string;
    code?: string;
    houses?: Array<{
      id?: string;
      name?: string;
      floorAreaM2?: number | null;
    }>;
    crops?: Array<{
      id?: string;
      cropNumber?: string;
      placementDate?: string;
      finishDate?: string | null;
      status?: string;
      breed?: string | null;
      hatchery?: string | null;
      placements?: Array<{
        houseId?: string;
        placementDate?: string;
        hatchery?: string | null;
        flockNumber?: string | null;
        birdsPlaced?: number;
      }>;
      daily?: Array<{
        houseId?: string;
        date?: string;
        mort?: number;
        culls?: number;
        feedKg?: number;
        waterL?: number;
        avgWeightG?: number | null;
        notes?: string | null;
      }>;
      medications?: Array<{
        startDate?: string;
        medicineName?: string;
        supplier?: string | null;
        batchNo?: string | null;
        expireDate?: string | null;
        quantityPurchased?: string | null;
        quantityUsed?: string | null;
        animalIdentity?: string | null;
        housesTreated?: string | null;
        birdsTreated?: number | null;
        finishDate?: string | null;
        withdrawalPeriod?: string | null;
        safeSlaughterDate?: string | null;
        administratorName?: string | null;
        reasonForTreatment?: string | null;
        methodOfTreatment?: string | null;
        dose?: string | null;
        totalMgPcu?: string | null;
        report?: string | null;
        prescription?: string | null;
      }>;
      avaraExports?: Array<{
        stage?: string;
        fileName?: string;
        filePath?: string;
        createdAt?: string;
      }>;
    }>;
  };
};

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function makeRestoredFarmName(name: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${name} (RESTORED ${stamp})`;
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const farmId = String(body.farmId || "").trim();
    const backup = body.backup as BackupPayload | undefined;

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    if (!backup?.farm) {
      return NextResponse.json(
        { error: "Backup payload is missing farm data." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canManageAccess(role)) {
      return NextResponse.json(
        { error: "Only OWNER can restore backup." },
        { status: 403 }
      );
    }

    const sourceFarmName = String(backup.farm.name || "").trim();
    const sourceFarmCode = String(backup.farm.code || "").trim();

    if (!sourceFarmName || !sourceFarmCode) {
      return NextResponse.json(
        { error: "Backup farm name/code is missing." },
        { status: 400 }
      );
    }

    const restoredFarm = await prisma.farm.create({
      data: {
        name: makeRestoredFarmName(sourceFarmName),
        code: `${sourceFarmCode}-RESTORED-${Date.now()}`,
        farmUsers: {
          create: {
            userId: uid,
            role: "OWNER",
          },
        },
      },
    });

    const oldHouseIdToNewHouseId: Record<string, string> = {};

    const backupHouses = Array.isArray(backup.farm.houses) ? backup.farm.houses : [];
    for (const house of backupHouses) {
      const houseName = String(house.name || "").trim();
      if (!houseName) continue;

      const createdHouse = await prisma.house.create({
        data: {
          farmId: restoredFarm.id,
          name: houseName,
          floorAreaM2: Number(house.floorAreaM2 || 0),
        },
      });

      if (house.id) {
        oldHouseIdToNewHouseId[house.id] = createdHouse.id;
      }
    }

    const backupCrops = Array.isArray(backup.farm.crops) ? backup.farm.crops : [];

    for (const crop of backupCrops) {
      const cropNumber = String(crop.cropNumber || "").trim();
      const placementDate = safeDate(crop.placementDate);

      if (!cropNumber || !placementDate) continue;

      const createdCrop = await prisma.crop.create({
        data: {
          farmId: restoredFarm.id,
          cropNumber,
          placementDate,
          finishDate: safeDate(crop.finishDate || null),
          status: String(crop.status || "ACTIVE").trim() || "ACTIVE",
          breed: crop.breed ? String(crop.breed) : null,
          hatchery: crop.hatchery ? String(crop.hatchery) : null,
        },
      });

      const placements = Array.isArray(crop.placements) ? crop.placements : [];
      for (const placement of placements) {
        const newHouseId = placement.houseId ? oldHouseIdToNewHouseId[placement.houseId] : "";
        const placementDateValue = safeDate(placement.placementDate);

        if (!newHouseId || !placementDateValue) continue;

        await prisma.cropHousePlacement.create({
          data: {
            cropId: createdCrop.id,
            houseId: newHouseId,
            placementDate: placementDateValue,
            hatchery: placement.hatchery ? String(placement.hatchery) : null,
            flockNumber: placement.flockNumber ? String(placement.flockNumber) : null,
            birdsPlaced: Number(placement.birdsPlaced || 0),
          },
        });
      }

      const dailyRecords = Array.isArray(crop.daily) ? crop.daily : [];
      for (const record of dailyRecords) {
        const newHouseId = record.houseId ? oldHouseIdToNewHouseId[record.houseId] : "";
        const recordDate = safeDate(record.date);

        if (!newHouseId || !recordDate) continue;

        await prisma.dailyRecord.create({
          data: {
            cropId: createdCrop.id,
            houseId: newHouseId,
            date: recordDate,
            mort: Number(record.mort || 0),
            culls: Number(record.culls || 0),
            feedKg: Number(record.feedKg || 0),
            waterL: Number(record.waterL || 0),
            avgWeightG:
              record.avgWeightG === null || record.avgWeightG === undefined
                ? null
                : Number(record.avgWeightG),
            notes: record.notes ? String(record.notes) : null,
          },
        });
      }

      const medications = Array.isArray(crop.medications) ? crop.medications : [];
      for (const medication of medications) {
        const startDate = safeDate(medication.startDate);
        const medicineName = String(medication.medicineName || "").trim();

        if (!startDate || !medicineName) continue;

        await prisma.medicationRecord.create({
          data: {
            cropId: createdCrop.id,
            startDate,
            medicineName,
            supplier: medication.supplier ? String(medication.supplier) : null,
            batchNo: medication.batchNo ? String(medication.batchNo) : null,
            expireDate: safeDate(medication.expireDate || null),
            quantityPurchased: medication.quantityPurchased
              ? String(medication.quantityPurchased)
              : null,
            quantityUsed: medication.quantityUsed ? String(medication.quantityUsed) : null,
            animalIdentity: medication.animalIdentity ? String(medication.animalIdentity) : null,
            housesTreated: medication.housesTreated ? String(medication.housesTreated) : null,
            birdsTreated:
              medication.birdsTreated === null || medication.birdsTreated === undefined
                ? null
                : Number(medication.birdsTreated),
            finishDate: safeDate(medication.finishDate || null),
            withdrawalPeriod: medication.withdrawalPeriod
              ? String(medication.withdrawalPeriod)
              : null,
            safeSlaughterDate: safeDate(medication.safeSlaughterDate || null),
            administratorName: medication.administratorName
              ? String(medication.administratorName)
              : null,
            reasonForTreatment: medication.reasonForTreatment
              ? String(medication.reasonForTreatment)
              : null,
            methodOfTreatment: medication.methodOfTreatment
              ? String(medication.methodOfTreatment)
              : null,
            dose: medication.dose ? String(medication.dose) : null,
            totalMgPcu: medication.totalMgPcu ? String(medication.totalMgPcu) : null,
            report: medication.report ? String(medication.report) : null,
            prescription: medication.prescription ? String(medication.prescription) : null,
          },
        });
      }

      const exportsList = Array.isArray(crop.avaraExports) ? crop.avaraExports : [];
      for (const exportItem of exportsList) {
        const stage = String(exportItem.stage || "").trim();
        const fileName = String(exportItem.fileName || "").trim();
        const filePath = String(exportItem.filePath || "").trim();

        if (!stage || !fileName || !filePath) continue;

        await prisma.avaraExport.create({
          data: {
            cropId: createdCrop.id,
            stage,
            fileName,
            filePath,
            createdAt: safeDate(exportItem.createdAt || null) || new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      farm: restoredFarm,
    });
  } catch (error) {
    console.error("FARM RESTORE ERROR:", error);
    return NextResponse.json(
      { error: "Server error during restore." },
      { status: 500 }
    );
  }
}
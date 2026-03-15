import { PrismaClient } from "@prisma/client";

type TargetDaySeed = {
  dayNumber: number;
  weightTargetG: number;
  feedTargetG: number;
  waterTargetMl: number;
  temperatureTargetC: number;
  humidityTargetPct: number;
  co2TargetPpm: number;
};

export const ROSS_211_TEMPLATE_DAYS: TargetDaySeed[] = [
  { dayNumber: 1, weightTargetG: 58, feedTargetG: 13, waterTargetMl: 10, temperatureTargetC: 32.5, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 2, weightTargetG: 74, feedTargetG: 16, waterTargetMl: 18, temperatureTargetC: 32.2, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 3, weightTargetG: 91, feedTargetG: 19, waterTargetMl: 25, temperatureTargetC: 31.9, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 4, weightTargetG: 111, feedTargetG: 23, waterTargetMl: 32, temperatureTargetC: 31.6, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 5, weightTargetG: 134, feedTargetG: 26, waterTargetMl: 40, temperatureTargetC: 31.3, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 6, weightTargetG: 160, feedTargetG: 30, waterTargetMl: 50, temperatureTargetC: 31.0, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 7, weightTargetG: 188, feedTargetG: 33, waterTargetMl: 58, temperatureTargetC: 30.7, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 8, weightTargetG: 220, feedTargetG: 42, waterTargetMl: 68, temperatureTargetC: 30.4, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 9, weightTargetG: 254, feedTargetG: 44, waterTargetMl: 80, temperatureTargetC: 30.1, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 10, weightTargetG: 292, feedTargetG: 46, waterTargetMl: 90, temperatureTargetC: 29.8, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 11, weightTargetG: 335, feedTargetG: 51, waterTargetMl: 101, temperatureTargetC: 29.5, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 12, weightTargetG: 383, feedTargetG: 55, waterTargetMl: 113, temperatureTargetC: 29.2, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 13, weightTargetG: 434, feedTargetG: 61, waterTargetMl: 123, temperatureTargetC: 28.9, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 14, weightTargetG: 490, feedTargetG: 63, waterTargetMl: 135, temperatureTargetC: 28.6, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 15, weightTargetG: 549, feedTargetG: 74, waterTargetMl: 145, temperatureTargetC: 28.3, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 16, weightTargetG: 613, feedTargetG: 75, waterTargetMl: 158, temperatureTargetC: 28.0, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 17, weightTargetG: 680, feedTargetG: 82, waterTargetMl: 168, temperatureTargetC: 27.7, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 18, weightTargetG: 750, feedTargetG: 87, waterTargetMl: 180, temperatureTargetC: 27.4, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 19, weightTargetG: 824, feedTargetG: 93, waterTargetMl: 190, temperatureTargetC: 27.1, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 20, weightTargetG: 899, feedTargetG: 99, waterTargetMl: 200, temperatureTargetC: 26.8, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 21, weightTargetG: 975, feedTargetG: 103, waterTargetMl: 212, temperatureTargetC: 26.5, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 22, weightTargetG: 1051, feedTargetG: 110, waterTargetMl: 222, temperatureTargetC: 26.2, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 23, weightTargetG: 1128, feedTargetG: 115, waterTargetMl: 230, temperatureTargetC: 25.9, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 24, weightTargetG: 1206, feedTargetG: 121, waterTargetMl: 238, temperatureTargetC: 25.6, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 25, weightTargetG: 1284, feedTargetG: 127, waterTargetMl: 247, temperatureTargetC: 25.3, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 26, weightTargetG: 1362, feedTargetG: 132, waterTargetMl: 254, temperatureTargetC: 25.0, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 27, weightTargetG: 1446, feedTargetG: 137, waterTargetMl: 262, temperatureTargetC: 24.7, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 28, weightTargetG: 1535, feedTargetG: 143, waterTargetMl: 270, temperatureTargetC: 24.4, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 29, weightTargetG: 1626, feedTargetG: 147, waterTargetMl: 275, temperatureTargetC: 24.1, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 30, weightTargetG: 1718, feedTargetG: 153, waterTargetMl: 281, temperatureTargetC: 23.8, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 31, weightTargetG: 1811, feedTargetG: 157, waterTargetMl: 288, temperatureTargetC: 23.5, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 32, weightTargetG: 1906, feedTargetG: 162, waterTargetMl: 292, temperatureTargetC: 23.2, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 33, weightTargetG: 2001, feedTargetG: 166, waterTargetMl: 299, temperatureTargetC: 22.9, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 34, weightTargetG: 2097, feedTargetG: 171, waterTargetMl: 303, temperatureTargetC: 22.6, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 35, weightTargetG: 2194, feedTargetG: 175, waterTargetMl: 310, temperatureTargetC: 22.3, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 36, weightTargetG: 2291, feedTargetG: 179, waterTargetMl: 315, temperatureTargetC: 22.0, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 37, weightTargetG: 2388, feedTargetG: 183, waterTargetMl: 320, temperatureTargetC: 21.7, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 38, weightTargetG: 2485, feedTargetG: 187, waterTargetMl: 328, temperatureTargetC: 21.4, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 39, weightTargetG: 2583, feedTargetG: 192, waterTargetMl: 333, temperatureTargetC: 21.1, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 40, weightTargetG: 2680, feedTargetG: 196, waterTargetMl: 338, temperatureTargetC: 20.8, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 41, weightTargetG: 2778, feedTargetG: 200, waterTargetMl: 343, temperatureTargetC: 20.5, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 42, weightTargetG: 2874, feedTargetG: 204, waterTargetMl: 348, temperatureTargetC: 20.2, humidityTargetPct: 55, co2TargetPpm: 3000 },
  { dayNumber: 43, weightTargetG: 2971, feedTargetG: 208, waterTargetMl: 353, temperatureTargetC: 19.9, humidityTargetPct: 55, co2TargetPpm: 3000 },
];

export async function ensureFarmDefaultTargetTemplate(
  prisma: PrismaClient,
  farmId: string
) {
  const existing = await prisma.targetProfile.findFirst({
    where: {
      farmId,
      scope: "GLOBAL_TEMPLATE",
    },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.targetProfile.create({
    data: {
      farmId,
      scope: "GLOBAL_TEMPLATE",
      name: "Ross 211 Default Template",
      source: "ROSS_211",
      isDefault: true,
      humidityTargetPct: 55,
      co2TargetPpm: 3000,
      days: {
        create: ROSS_211_TEMPLATE_DAYS.map((day) => ({
          dayNumber: day.dayNumber,
          weightTargetG: day.weightTargetG,
          feedTargetG: day.feedTargetG,
          waterTargetMl: day.waterTargetMl,
          temperatureTargetC: day.temperatureTargetC,
          humidityTargetPct: day.humidityTargetPct,
          co2TargetPpm: day.co2TargetPpm,
        })),
      },
    },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });
}

export async function cloneFarmTemplateToCrop(params: {
  prisma: PrismaClient;
  farmId: string;
  cropId: string;
  cropNumber: string;
}) {
  const { prisma, farmId, cropId, cropNumber } = params;

  const template = await ensureFarmDefaultTargetTemplate(prisma, farmId);

  return prisma.targetProfile.create({
    data: {
      farmId,
      cropId,
      scope: "CROP",
      name: `Crop ${cropNumber} Targets`,
      source: template.source || "ROSS_211",
      isDefault: false,
      humidityTargetPct: template.humidityTargetPct ?? 55,
      co2TargetPpm: template.co2TargetPpm ?? 3000,
      days: {
        create: template.days.map((day) => ({
          dayNumber: day.dayNumber,
          weightTargetG: day.weightTargetG,
          feedTargetG: day.feedTargetG,
          waterTargetMl: day.waterTargetMl,
          temperatureTargetC: day.temperatureTargetC,
          humidityTargetPct: day.humidityTargetPct,
          co2TargetPpm: day.co2TargetPpm,
        })),
      },
    },
    include: {
      days: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });
}
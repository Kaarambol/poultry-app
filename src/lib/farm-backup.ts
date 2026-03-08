import { prisma } from "@/lib/db";

export async function buildFarmBackupPayload(farmId: string) {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    include: {
      houses: {
        orderBy: { name: "asc" },
      },
      crops: {
        orderBy: { placementDate: "desc" },
        include: {
          placements: {
            orderBy: [{ houseId: "asc" }, { placementDate: "asc" }],
          },
          daily: {
            orderBy: [{ houseId: "asc" }, { date: "asc" }],
          },
          medications: {
            orderBy: { startDate: "asc" },
          },
          avaraExports: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      farmUsers: {
        orderBy: { role: "asc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!farm) {
    return null;
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    farm,
  };
}

export function makeWeeklyBackupFileName(farmCode: string) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `weekly-backups/${farmCode}/${stamp}.json`;
}
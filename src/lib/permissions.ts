import { prisma } from "@/lib/db";

export async function getUserRoleOnFarm(userId: string, farmId: string) {
  const access = await prisma.farmUser.findFirst({
    where: {
      userId,
      farmId,
    },
    select: {
      role: true,
    },
  });

  return access?.role || null;
}

export async function isFarmCreator(userId: string, farmId: string) {
  const farm = await prisma.farm.findUnique({
    where: {
      id: farmId,
    },
    select: {
      createdByUserId: true,
    },
  });

  if (!farm) {
    return false;
  }

  return farm.createdByUserId === userId;
}

export async function canEditOrDeleteFarm(userId: string, farmId: string) {
  const [role, isCreator] = await Promise.all([
    getUserRoleOnFarm(userId, farmId),
    isFarmCreator(userId, farmId),
  ]);

  return role === "OWNER" && isCreator;
}

export function canManageAccess(role: string | null) {
  return role === "OWNER";
}

export function canFinishCrop(role: string | null) {
  return role === "OWNER" || role === "MANAGER";
}

export function canOperate(role: string | null) {
  return (
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "ASSISTANT_MANAGER"
  );
}

export function canView(role: string | null) {
  return !!role;
}
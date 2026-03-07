import { prisma } from "@/lib/db";

export async function getUserRoleOnFarm(userId: string, farmId: string) {
  const access = await prisma.farmUser.findFirst({
    where: {
      userId,
      farmId,
    },
  });

  return access?.role || null;
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
import { prisma } from "@/lib/db";

export async function writeChangeLog(params: {
  farmId: string;
  userId: string;
  action: string;
  description: string;
}) {
  try {
    await prisma.changeLog.create({
      data: {
        farmId: params.farmId,
        userId: params.userId,
        action: params.action,
        description: params.description,
      },
    });
  } catch (error) {
    console.error("WRITE CHANGE LOG ERROR:", error);
  }
}
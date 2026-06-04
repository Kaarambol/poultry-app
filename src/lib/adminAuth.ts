import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function isAdmin(req: NextRequest): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return false;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true } });
  return user?.email === adminEmail;
}

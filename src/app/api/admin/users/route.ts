import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function isAdmin(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return false;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true } });
  return user?.email === adminEmail;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  });

  return NextResponse.json(users);
}

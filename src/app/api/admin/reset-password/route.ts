import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

async function isAdmin(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return false;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true } });
  return user?.email === adminEmail;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json();
  const userId = String(body.userId || "");
  const newPassword = String(body.newPassword || "");

  if (!userId || newPassword.length < 6) {
    return NextResponse.json({ error: "userId and newPassword (min 6 chars) required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}

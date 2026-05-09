import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

// TEMPORARY endpoint — delete after use
const SECRET = process.env.TEMP_RESET_SECRET;

export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "TEMP_RESET_SECRET not set." }, { status: 403 });
  }

  const body = await req.json();
  const { secret, email, newPassword } = body;

  if (secret !== SECRET) {
    return NextResponse.json({ error: "Wrong secret." }, { status: 403 });
  }

  if (!email || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "email and newPassword (min 6) required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { email }, data: { password: hashed } });

  return NextResponse.json({ ok: true, message: `Password reset for ${email}.` });
}

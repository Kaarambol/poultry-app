import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIsSuperAdmin } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!(await checkIsSuperAdmin(uid))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { userId } = await context.params;
  const body = await req.json();
  const newPassword = String(body.password || "").trim();

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}

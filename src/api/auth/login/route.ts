import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

  const ok = await verifyPassword(password, user.password);
  if (!ok) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

  const res = NextResponse.json({ ok: true });

  // Prosta sesja: cookie z userId (MVP)
  res.cookies.set("uid", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ isSuperAdmin: false });

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { isSuperAdmin: true },
  });

  return NextResponse.json({ isSuperAdmin: user?.isSuperAdmin ?? false });
}

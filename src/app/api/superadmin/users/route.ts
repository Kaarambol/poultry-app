import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIsSuperAdmin } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!(await checkIsSuperAdmin(uid))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
      farmUsers: {
        select: {
          role: true,
          farm: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  return NextResponse.json(users);
}

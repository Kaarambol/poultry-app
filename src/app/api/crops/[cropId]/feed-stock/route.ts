import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

function parseOptionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ cropId: string }> }
) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { cropId } = await context.params;
    const body = await req.json();

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      select: { id: true, farmId: true },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canOperate(role)) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    }

    const closingFeedStockKg = parseOptionalFloat(body.closingFeedStockKg);
    const closingWheatStockKg = parseOptionalFloat(body.closingWheatStockKg);

    const updated = await prisma.crop.update({
      where: { id: cropId },
      data: {
        closingFeedStockKg: closingFeedStockKg ?? 0,
        closingWheatStockKg: closingWheatStockKg ?? 0,
      },
      select: {
        id: true,
        closingFeedStockKg: true,
        closingWheatStockKg: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("FEED STOCK UPDATE ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { buildFarmBackupPayload, makeWeeklyBackupFileName } from "@/lib/farm-backup";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const farms = await prisma.farm.findMany({
      select: {
        id: true,
        code: true,
      },
      orderBy: { code: "asc" },
    });

    const results: Array<{
      farmId: string;
      code: string;
      ok: boolean;
      pathname?: string;
      error?: string;
    }> = [];

    for (const farm of farms) {
      try {
        const payload = await buildFarmBackupPayload(farm.id);

        if (!payload) {
          results.push({
            farmId: farm.id,
            code: farm.code,
            ok: false,
            error: "Farm not found during backup build.",
          });
          continue;
        }

        const fileName = makeWeeklyBackupFileName(farm.code);

        const blob = await put(
          fileName,
          JSON.stringify(payload, null, 2),
          {
            access: "private",
            contentType: "application/json",
            addRandomSuffix: false,
          }
        );

        results.push({
          farmId: farm.id,
          code: farm.code,
          ok: true,
          pathname: blob.pathname,
        });
      } catch (error) {
        console.error(`WEEKLY BACKUP ERROR FOR FARM ${farm.code}:`, error);
        results.push({
          farmId: farm.id,
          code: farm.code,
          ok: false,
          error: "Backup upload failed.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      totalFarms: farms.length,
      results,
    });
  } catch (error) {
    console.error("WEEKLY CRON BACKUP ERROR:", error);
    return NextResponse.json(
      { error: "Server error during weekly backup cron." },
      { status: 500 }
    );
  }
}
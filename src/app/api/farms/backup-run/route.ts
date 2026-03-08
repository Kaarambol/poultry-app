import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canManageAccess } from "@/lib/permissions";
import { buildFarmBackupPayload, makeWeeklyBackupFileName } from "@/lib/farm-backup";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();
    const farmId = String(body.farmId || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canManageAccess(role)) {
      return NextResponse.json(
        { error: "Only OWNER can run backup." },
        { status: 403 }
      );
    }

    const payload = await buildFarmBackupPayload(farmId);

    if (!payload) {
      return NextResponse.json(
        { error: "Farm not found." },
        { status: 404 }
      );
    }

    const fileName = makeWeeklyBackupFileName(payload.farm.code);

    const blob = await put(
      fileName,
      JSON.stringify(payload, null, 2),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      }
    );

    return NextResponse.json({
      ok: true,
      pathname: blob.pathname,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("RUN BACKUP ERROR:", error);
    return NextResponse.json(
      { error: "Server error while running backup." },
      { status: 500 }
    );
  }
}
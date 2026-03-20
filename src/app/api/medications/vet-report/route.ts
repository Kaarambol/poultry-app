import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const cropId = req.nextUrl.searchParams.get("cropId");
    const houseId = req.nextUrl.searchParams.get("houseId");

    if (!cropId || !houseId) {
      return NextResponse.json({ error: "Missing cropId or houseId" }, { status: 400 });
    }

    // 1. Fetch crop and placement data
    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
        placements: { where: { houseId, isActive: true } }
      }
    });

    if (!crop) return NextResponse.json({ error: "Crop not found" }, { status: 404 });

    // Permissions check
    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canView(role)) return NextResponse.json({ error: "No permission" }, { status: 403 });

    const house = await prisma.house.findUnique({ where: { id: houseId } });
    const placement = crop.placements[0];
    const birdsPlaced = placement?.birdsPlaced || 0;

    // 2. Fetch daily records
    const allRecords = await prisma.dailyRecord.findMany({
      where: { cropId, houseId },
      orderBy: { date: "asc" }
    });

    // Calculate current flock status
    const totalLosses = allRecords.reduce((sum, r) => sum + (r.mort || 0) + (r.culls || 0), 0);
    const birdsAlive = birdsPlaced - totalLosses;

    // Calculate current age
    const startDate = new Date(placement?.placementDate || crop.placementDate);
    const ageDaysToday = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Last 7 entries for the table
    const last7 = allRecords.slice(-7);

    // 3. Building CSV Content (English, Aligned for Excel)
    // Using comma as separator for better Excel compatibility
    let csv = "\ufeff"; // BOM for proper character encoding
    csv += `VETERINARY REPORT (LAST 7 DAYS)\n`;
    csv += `Farm:,${crop.farm.name}\n`;
    csv += `House:,${house?.name || houseId}\n`;
    csv += `Crop Number:,${crop.cropNumber}\n`;
    csv += `Arrival Date:,${startDate.toLocaleDateString('en-GB')}\n`;
    csv += `Birds Placed:,${birdsPlaced}\n`;
    csv += `Current Birds Alive:,${birdsAlive}\n`;
    csv += `Current Age:,${ageDaysToday} days\n\n`;
    
    // Table Header
    csv += "Date,Water (L),Mortality (Dead),Culls (Selection)\n";

    // Table Data - aligned in columns
    last7.forEach(r => {
      const formattedDate = new Date(r.date).toLocaleDateString('en-GB');
      const water = r.waterL || 0;
      const mort = r.mort || 0;
      const culls = r.culls || 0;
      csv += `${formattedDate},${water},${mort},${culls}\n`;
    });

    const responseBody = new TextEncoder().encode(csv);

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Vet-Report-${house?.name || 'house'}.csv"`,
      },
    });

  } catch (error) {
    console.error("VET REPORT ERROR:", error);
    return NextResponse.json({ error: "Server error while generating report." }, { status: 500 });
  }
}
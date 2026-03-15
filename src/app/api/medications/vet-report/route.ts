import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";
import PDFDocument from "pdfkit";

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB");
}

function createPdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    build(doc);
    doc.end();
  });
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const cropId = String(req.nextUrl.searchParams.get("cropId") || "").trim();
    const houseId = String(req.nextUrl.searchParams.get("houseId") || "").trim();

    if (!cropId || !houseId) {
      return NextResponse.json(
        { error: "cropId and houseId are required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
        placements: {
          where: {
            houseId,
            isActive: true,
          },
          orderBy: {
            placementDate: "asc",
          },
        },
      },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this report." },
        { status: 403 }
      );
    }

    const house = await prisma.house.findUnique({
      where: { id: houseId },
      select: {
        id: true,
        name: true,
        code: true,
        farmId: true,
      },
    });

    if (!house || house.farmId !== crop.farmId) {
      return NextResponse.json(
        { error: "House not found for this farm." },
        { status: 404 }
      );
    }

    const birdsPlaced = crop.placements.reduce(
      (sum, placement) => sum + placement.birdsPlaced,
      0
    );

    const firstPlacementDate =
      crop.placements.length > 0
        ? crop.placements[0].placementDate
        : crop.placementDate;

    const allDaily = await prisma.dailyRecord.findMany({
      where: {
        cropId,
        houseId,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        mort: true,
        culls: true,
        waterL: true,
        avgWeightG: true,
      },
    });

    const ageDaysToday =
      Math.floor(
        (new Date().getTime() - new Date(firstPlacementDate).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const last7 = allDaily.slice(-7);

    let birdsAliveRunning = birdsPlaced;
    const aliveMap = new Map<string, number>();

    for (const row of allDaily) {
      const key = new Date(row.date).toISOString().slice(0, 10);
      const losses = row.mort + row.culls;
      birdsAliveRunning -= losses;
      aliveMap.set(key, birdsAliveRunning);
    }

    const reportRows = last7.map((row) => {
      const rowDate = new Date(row.date);
      const ageDays =
        Math.floor(
          (rowDate.getTime() - new Date(firstPlacementDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      const aliveKey = rowDate.toISOString().slice(0, 10);
      const chickensAlive = aliveMap.get(aliveKey) ?? birdsPlaced;

      return {
        date: rowDate,
        ageDays,
        chickensAlive,
        waterL: row.waterL,
        mortality: row.mort + row.culls,
        avgWeightG: row.avgWeightG,
      };
    });

    const pdfBuffer = await createPdfBuffer((doc) => {
      doc.fontSize(18).text("Vet 7 Day Flock Report", { align: "center" });
      doc.moveDown(1);

      doc.fontSize(11);
      doc.text(`Farm: ${crop.farm.name}`);
      doc.text(`Crop: ${crop.cropNumber}`);
      doc.text(`House: ${house.name}${house.code ? ` (${house.code})` : ""}`);
      doc.text(`Placement date: ${formatDate(firstPlacementDate)}`);
      doc.text(`Chickens placed: ${birdsPlaced}`);
      doc.text(`Current flock age: ${ageDaysToday > 0 ? ageDaysToday : 0} day(s)`);
      doc.moveDown(1);

      doc.fontSize(13).text("Last days summary");
      doc.moveDown(0.5);

      const startX = 40;
      const col = {
        date: 40,
        age: 120,
        alive: 175,
        water: 280,
        mort: 375,
        weight: 455,
      };

      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Date", col.date, doc.y);
      doc.text("Age", col.age, doc.y);
      doc.text("Alive", col.alive, doc.y);
      doc.text("Water L", col.water, doc.y);
      doc.text("Mortality", col.mort, doc.y);
      doc.text("Weight g", col.weight, doc.y);
      doc.moveDown(0.5);

      doc.font("Helvetica");
      let y = doc.y;

      if (reportRows.length === 0) {
        doc.text("No daily records available yet for this house.", startX, y);
      } else {
        for (const row of reportRows) {
          if (y > 760) {
            doc.addPage();
            y = 40;
          }

          doc.text(formatDate(row.date), col.date, y);
          doc.text(String(row.ageDays), col.age, y);
          doc.text(String(row.chickensAlive), col.alive, y);
          doc.text(
            row.waterL !== null && row.waterL !== undefined
              ? Number(row.waterL).toFixed(2)
              : "-",
            col.water,
            y
          );
          doc.text(String(row.mortality), col.mort, y);
          doc.text(
            row.avgWeightG !== null && row.avgWeightG !== undefined
              ? Number(row.avgWeightG).toFixed(2)
              : "-",
            col.weight,
            y
          );

          y += 22;
        }
      }

      doc.moveDown(2);
      doc.fontSize(9).fillColor("gray");
      doc.text(
        "Generated automatically from daily records for veterinary review.",
        40,
        Math.max(y + 20, doc.y)
      );
    });

    const safeHouseName = `${house.name}${house.code ? `-${house.code}` : ""}`
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vet-report-${crop.cropNumber}-${safeHouseName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("VET REPORT PDF ERROR:", error);

    return NextResponse.json(
      { error: "Server error while generating vet PDF." },
      { status: 500 }
    );
  }
}
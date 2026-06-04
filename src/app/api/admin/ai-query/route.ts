import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

async function isAdmin(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return false;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true } });
  return user?.email === adminEmail;
}

const DB_SCHEMA = `
PostgreSQL database schema for a poultry farm management system:

TABLE Farm (id, name, code, feedContractor, chickenSupplier, farmNumber, chpCode)
TABLE User (id, email, name)
TABLE UserFarmAccess (id, userId, farmId, role) -- role: OWNER/MANAGER/VIEWER
TABLE House (id, farmId, name, code, floorAreaM2, usableAreaM2, defaultCapacityBirds, defaultNippleCount, defaultFeederPanCount)
TABLE Crop (id, farmId, cropNumber, placementDate, finishDate, breed, hatchery, status)
  -- status: ACTIVE | FINISHED
  -- NOTE: Crop has NO birdsPlaced column. To get total birds placed, SUM(birdsPlaced) FROM CropHousePlacement WHERE cropId = crop.id
TABLE CropHousePlacement (id, cropId, houseId, placementDate, birdsPlaced, thinDate, thinBirds, thinWeightG, thin2Date, thin2Birds, clearDate, clearBirds, clearWeightG)
  -- birdsPlaced here is the number of birds placed in that specific house for that crop
TABLE DailyRecord (id, cropId, houseId, date, birdsTotal, mort, culls, feedKg, waterL, avgWeightG, ammoniaPpm, litterScore, co2MaxPpm, temperatureMinC, temperatureMaxC)
TABLE FeedRecord (id, cropId, houseId, date, feedType, feedKg, feedPricePerTonneGbp)
TABLE MedicationRecord (id, cropId, houseId, date, product, doseDescription)
TABLE NightCheck (id, cropId, houseId, date, mort, notes)

KEY RELATIONSHIPS:
- Farm has many Houses, Crops
- Crop has many CropHousePlacements, DailyRecords, FeedRecords
- DailyRecord.mort + DailyRecord.culls = daily losses per house

IMPORTANT NOTES:
- 3-day mortality = SUM(mort + culls) for days 0-3 from placementDate
- To find age at record: date - CropHousePlacement.placementDate
- mortalityPct = totalLosses / birdsPlaced * 100
- Farm names and codes can help identify company groups (e.g. "Avara", "2 Sisters")
- Always use lowercase table names in queries (Prisma uses camelCase but raw SQL uses snake_case? No — use exact table names with double quotes if needed)
- Use standard PostgreSQL syntax
- Only SELECT statements allowed

CALCULATED METRICS (must be computed in SQL):
- EPEF (European Production Efficiency Factor):
  EPEF = (livability_pct * avg_live_weight_kg * 100) / (FCR * age_days * 10)
  Where:
    livability_pct = (chp.clearBirds::float / chp.birdsPlaced) * 100
    avg_live_weight_kg = chp.clearWeightG / 1000.0
    FCR = SUM(dr.feedKg) / (chp.clearBirds * chp.clearWeightG / 1000.0)   -- total feed / total live weight out
    age_days = EXTRACT(DAY FROM (chp.clearDate - chp.placementDate))
  Only calculate EPEF for placements where clearDate IS NOT NULL AND clearBirds > 0 AND clearWeightG > 0
- FCR (Feed Conversion Ratio) = total feed kg consumed / total live weight produced kg
- Average daily gain (ADG) g = clearWeightG / age_days
`;

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { question } = await req.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  // Step 1: Ask Claude to generate SQL
  let sql = "";
  try {
    const sqlResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a SQL expert for a PostgreSQL poultry farm database. Generate a single SELECT SQL query to answer this question.

${DB_SCHEMA}

Question: ${question}

Rules:
- Return ONLY the raw SQL query, no explanation, no markdown, no backticks
- Only SELECT statements (no INSERT/UPDATE/DELETE/DROP)
- Use double quotes for table and column names that match the Prisma schema exactly (e.g. "Farm", "DailyRecord", "cropId")
- Limit results to 500 rows maximum using LIMIT 500
- For date calculations use age() or date arithmetic
- If question is unclear or cannot be answered with this schema, return: SELECT 'Cannot answer this question with available data' AS message`,
        },
      ],
    });

    sql = (sqlResponse.content[0] as { text: string }).text.trim();

    // Safety: strip any markdown fences if model added them anyway
    sql = sql.replace(/^```sql\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    // Block any non-SELECT statements
    const firstWord = sql.split(/\s+/)[0].toUpperCase();
    if (!["SELECT", "WITH"].includes(firstWord)) {
      return NextResponse.json({ error: "Only SELECT queries are allowed.", sql }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: `AI error: ${(e as Error).message}` }, { status: 500 });
  }

  // Step 2: Execute the SQL
  try {
    const rows = await prisma.$queryRawUnsafe(sql) as Record<string, unknown>[];

    // Serialize BigInt values
    const serialized = JSON.parse(
      JSON.stringify(rows, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );

    return NextResponse.json({ sql, rows: serialized, count: serialized.length });
  } catch (e) {
    return NextResponse.json({ error: `SQL error: ${(e as Error).message}`, sql }, { status: 400 });
  }
}

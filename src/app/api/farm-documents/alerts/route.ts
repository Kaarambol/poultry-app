import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function daysUntil(target: Date) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  return Math.ceil(
    (targetDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const farmId = String(url.searchParams.get("farmId") || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const documents = await prisma.farmDocument.findMany({
      where: { farmId },
      orderBy: [
        { expiryDate: "asc" },
        { nextReviewDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    const alerts = documents.flatMap((doc) => {
      const out: Array<{
        id: string;
        title: string;
        documentType: string;
        kind: "EXPIRY" | "REVIEW";
        severity: "SOON" | "OVERDUE";
        targetDate: string;
        days: number;
        status: string;
      }> = [];

      if (doc.expiryDate) {
        const d = daysUntil(doc.expiryDate);
        if (d < 0) {
          out.push({
            id: doc.id,
            title: doc.title,
            documentType: doc.documentType,
            kind: "EXPIRY",
            severity: "OVERDUE",
            targetDate: doc.expiryDate.toISOString(),
            days: d,
            status: doc.status,
          });
        } else if (d <= 7) {
          out.push({
            id: doc.id,
            title: doc.title,
            documentType: doc.documentType,
            kind: "EXPIRY",
            severity: "SOON",
            targetDate: doc.expiryDate.toISOString(),
            days: d,
            status: doc.status,
          });
        }
      }

      if (doc.nextReviewDate) {
        const d = daysUntil(doc.nextReviewDate);
        if (d < 0) {
          out.push({
            id: doc.id,
            title: doc.title,
            documentType: doc.documentType,
            kind: "REVIEW",
            severity: "OVERDUE",
            targetDate: doc.nextReviewDate.toISOString(),
            days: d,
            status: doc.status,
          });
        } else if (d <= 7) {
          out.push({
            id: doc.id,
            title: doc.title,
            documentType: doc.documentType,
            kind: "REVIEW",
            severity: "SOON",
            targetDate: doc.nextReviewDate.toISOString(),
            days: d,
            status: doc.status,
          });
        }
      }

      return out;
    });

    alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "OVERDUE" ? -1 : 1;
      }
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

    return NextResponse.json({
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("FARM DOCUMENT ALERTS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading document alerts." },
      { status: 500 }
    );
  }
}
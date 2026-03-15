import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

function daysDiff(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const farmId = String(req.nextUrl.searchParams.get("farmId") || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view document alerts." },
        { status: 403 }
      );
    }

    const documents = await prisma.farmDocument.findMany({
      where: {
        farmId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        farmId: true,
        title: true,
        documentType: true,
        expiryDate: true,
        nextReviewDate: true,
      },
      orderBy: {
        title: "asc",
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts = documents.flatMap((doc) => {
      const items: Array<{
        id: string;
        farmId: string;
        title: string;
        documentType: string;
        kind: "EXPIRY" | "REVIEW";
        severity: "SOON" | "OVERDUE";
        targetDate: Date;
        daysLeft: number;
      }> = [];

      if (doc.expiryDate) {
        const expiry = new Date(doc.expiryDate);
        expiry.setHours(0, 0, 0, 0);

        const diff = daysDiff(today, expiry);

        if (diff < 0) {
          items.push({
            id: doc.id,
            farmId: doc.farmId,
            title: doc.title,
            documentType: doc.documentType,
            kind: "EXPIRY",
            severity: "OVERDUE",
            targetDate: expiry,
            daysLeft: diff,
          });
        } else if (diff <= 7) {
          items.push({
            id: doc.id,
            farmId: doc.farmId,
            title: doc.title,
            documentType: doc.documentType,
            kind: "EXPIRY",
            severity: "SOON",
            targetDate: expiry,
            daysLeft: diff,
          });
        }
      }

      if (doc.nextReviewDate) {
        const review = new Date(doc.nextReviewDate);
        review.setHours(0, 0, 0, 0);

        const diff = daysDiff(today, review);

        if (diff < 0) {
          items.push({
            id: doc.id,
            farmId: doc.farmId,
            title: doc.title,
            documentType: doc.documentType,
            kind: "REVIEW",
            severity: "OVERDUE",
            targetDate: review,
            daysLeft: diff,
          });
        } else if (diff <= 7) {
          items.push({
            id: doc.id,
            farmId: doc.farmId,
            title: doc.title,
            documentType: doc.documentType,
            kind: "REVIEW",
            severity: "SOON",
            targetDate: review,
            daysLeft: diff,
          });
        }
      }

      return items;
    });

    alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "OVERDUE" ? -1 : 1;
      }
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("FARM DOCUMENT ALERTS ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading farm document alerts." },
      { status: 500 }
    );
  }
}
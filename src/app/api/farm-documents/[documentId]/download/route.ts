import { prisma } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { documentId } = await context.params;

    const doc = await prisma.farmDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || !doc.fileUrl) {
      return new NextResponse("Document not found", { status: 404 });
    }

    return NextResponse.redirect(new URL(doc.fileUrl));

  } catch (error) {
    console.error("Download error:", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
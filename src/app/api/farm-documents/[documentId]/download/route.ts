import { prisma } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";

// Definiujemy typ dla parametrów zgodnie z wymogami nowego Next.js
type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(
  request: NextRequest, // Zmieniamy na NextRequest dla lepszej kompatybilności
  context: RouteContext
) {
  try {
    // Rozpakowujemy params, ponieważ są teraz Obietnicą
    const { documentId } = await context.params;

    const doc = await prisma.farmDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || !doc.fileUrl) {
      return new NextResponse("Dokument nie istnieje", { status: 404 });
    }

    // Przekierowanie do pliku
    return NextResponse.redirect(new URL(doc.fileUrl));
    
  } catch (error) {
    console.error("Błąd pobierania:", error);
    return new NextResponse("Błąd serwera", { status: 500 });
  }
}
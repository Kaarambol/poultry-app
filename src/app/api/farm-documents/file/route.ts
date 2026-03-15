import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fileUrl = String(url.searchParams.get("url") || "").trim();
    const download = url.searchParams.get("download") === "1";

    if (!fileUrl) {
      return NextResponse.json(
        { error: "File URL is required." },
        { status: 400 }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN." },
        { status: 500 }
      );
    }

    const result = await get(fileUrl, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json(
        { error: "File not found." },
        { status: 404 }
      );
    }

    const headers = new Headers();

    if (result.blob.contentType) {
      headers.set("Content-Type", result.blob.contentType);
    } else {
      headers.set("Content-Type", "application/octet-stream");
    }

    headers.set("Cache-Control", "private, no-store");

    const disposition = download
      ? result.blob.downloadUrl
        ? "attachment"
        : "attachment"
      : "inline";

    const filenameMatch =
      /filename="?([^"]+)"?/i.exec(result.blob.contentDisposition || "");
    const filename = filenameMatch?.[1] || "document";

    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${filename}"`
    );

    return new NextResponse(result.stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("GET FARM DOCUMENT FILE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while retrieving file." },
      { status: 500 }
    );
  }
}
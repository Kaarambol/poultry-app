import { put } from "@vercel/blob";

export async function saveFarmDocumentFile(params: {
  farmId: string;
  file: File;
}) {
  const { farmId, file } = params;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN.");
  }

  const timestamp = Date.now();

  const safeName = (file.name || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  const pathname = `farm-documents/${farmId}/${timestamp}-${safeName}`;

  const blob = await put(pathname, file, {
    access: "private",
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return {
    fileUrl: blob.url,           // techniczny URL
    blobPath: blob.pathname,     // NAJWAŻNIEJSZE do signed URL
    originalFileName: file.name || "document",
    storedFileName: blob.pathname,
    mimeType: file.type || "application/octet-stream",
  };
}
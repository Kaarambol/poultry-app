import { put } from "@vercel/blob";

export async function saveFarmDocumentFile(params: {
  farmId: string;
  file: File;
}) {
  const { farmId, file } = params;

  const timestamp = Date.now();
  const safeName = (file.name || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  const pathname = `farm-documents/${farmId}/${timestamp}-${safeName}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return {
    fileUrl: blob.url,
    originalFileName: file.name || "document",
    storedFileName: pathname,
    mimeType: file.type || "application/octet-stream",
  };
}
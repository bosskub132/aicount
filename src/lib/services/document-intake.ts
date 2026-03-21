import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateUploadFile(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large: ${file.name}`);
  }
  if (file.size < 128) {
    throw new Error(`File too small or empty: ${file.name}`);
  }
}

export async function fileToBuffer(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function isPasswordProtectedPdf(buffer: Buffer) {
  // Best-effort detection. Most encrypted PDFs include /Encrypt object.
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("latin1");
  return sample.includes("/Encrypt");
}

export async function persistUploadFile({
  tenantId,
  file,
  buffer,
  batchId,
}: {
  tenantId: string;
  file: File;
  buffer: Buffer;
  batchId?: string;
}) {
  const dateBucket = new Date().toISOString().slice(0, 10);
  const baseDir = path.join(process.cwd(), "public", "generated", "uploads", tenantId, dateBucket);
  const targetDir = batchId ? path.join(baseDir, batchId) : baseDir;
  await fs.mkdir(targetDir, { recursive: true });

  const safeName = file.name.replace(/[^\w.\-() ]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const fullPath = path.join(targetDir, filename);
  await fs.writeFile(fullPath, buffer);

  return {
    filePath: fullPath,
    publicUrl: `/generated/uploads/${tenantId}/${dateBucket}${batchId ? `/${batchId}` : ""}/${filename}`,
  };
}


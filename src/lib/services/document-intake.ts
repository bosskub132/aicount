import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const BUCKET_NAME = "documents";

function getStorageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
  const supabase = getStorageClient();
  const dateBucket = new Date().toISOString().slice(0, 10);
  const safeName = file.name.replace(/[^\w.\-() ]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const storagePath = `${tenantId}/${dateBucket}${batchId ? `/${batchId}` : ""}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
  };
}

/** Download a file from Supabase Storage by its public URL or storage path. */
export async function downloadStorageFile(fileUrl: string): Promise<Buffer> {
  // If it's a full Supabase public URL, extract the storage path
  const bucketPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
  let storagePath: string;

  if (fileUrl.includes(bucketPrefix)) {
    storagePath = fileUrl.split(bucketPrefix)[1];
  } else if (fileUrl.startsWith("/")) {
    // Legacy local path — won't work in production
    throw new Error(`Local file paths are not supported in production: ${fileUrl}`);
  } else {
    storagePath = fileUrl;
  }

  const supabase = getStorageClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message || "No data"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

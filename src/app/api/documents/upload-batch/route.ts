import { NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, profiles, tenants } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  fileToBuffer,
  isPasswordProtectedPdf,
  persistUploadFile,
  sha256,
  validateUploadFile,
} from "@/lib/services/document-intake";
import {
  ensureRole,
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin", "maker"])) return forbidden("Only maker/admin can upload");

    const formData = await request.formData();
    const files = formData.getAll("files");
    const tenantId = String(formData.get("tenantId") || "");
    const uploadedBy = ctx.userId;
    const batchId = crypto.randomUUID();

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, tenantId)) return forbidden("Cross-tenant access denied");
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workspace tenant. Please set a valid tenant UUID in Workspace selector.",
        },
        { status: 400 }
      );
    }
    await db
      .insert(profiles)
      .values({
        id: ctx.userId,
        email: ctx.userEmail || `${ctx.userId}@local.invalid`,
      })
      .onConflictDoNothing();
    if (!files.length) {
      return NextResponse.json({ success: false, error: "files are required" }, { status: 400 });
    }

    const acceptedFiles = files.filter((f): f is File => f instanceof File);
    const results: Array<{ id: string; status: string; fileUrl: string | null; isDuplicate: boolean }> = [];
    const duplicateFiles: string[] = [];
    const seenHashes = new Map<string, boolean>();

    for (const file of acceptedFiles) {
      validateUploadFile(file);
      const buffer = await fileToBuffer(file);
      if (file.type === "application/pdf" && isPasswordProtectedPdf(buffer)) {
        continue;
      }
      const fileHash = sha256(buffer);

      // Check for duplicates (within batch and in database) but still allow upload
      let isDuplicate = false;
      if (seenHashes.has(fileHash)) {
        isDuplicate = true;
      } else {
        const [existing] = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.tenantId, tenantId), eq(documents.fileHash, fileHash)))
          .limit(1);
        if (existing) {
          isDuplicate = true;
        }
      }
      seenHashes.set(fileHash, true);

      if (isDuplicate) {
        duplicateFiles.push(file.name);
      }

      const stored = await persistUploadFile({ tenantId, file, buffer, batchId });

      const [created] = await db
        .insert(documents)
        .values({
          tenantId,
          uploadedBy,
          intakeSource: "FRONTEND_UPLOAD",
          fileUrl: stored.publicUrl,
          fileHash,
          batchId,
          status: "OCR_PROCESSING",
          ocrRaw: {
            sourceFileName: file.name,
            sourceMimeType: file.type,
            uploadSizeBytes: file.size,
            isDuplicate,
          },
        })
        .returning({ id: documents.id, status: documents.status, fileUrl: documents.fileUrl });

      results.push({ ...created, isDuplicate });
      await inngest.send({
        name: "document/uploaded",
        data: { documentId: created.id, tenantId },
      });
    }

    await writeAuditLog({
      tenantId,
      userId: ctx.userId,
      action: "document.batch_uploaded",
      entityType: "document_batch",
      metadata: {
        batchId,
        acceptedCount: results.length,
        fileCount: acceptedFiles.length,
        duplicateFiles,
      },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          batchId,
          acceptedCount: results.length,
          duplicateFiles,
          documents: results,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[documents/upload-batch POST]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Batch upload failed",
      },
      { status: 500 }
    );
  }
}

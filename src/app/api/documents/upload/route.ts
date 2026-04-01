import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
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
  getRequestContext,
  forbidden,
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
    const file = formData.get("file");
    const tenantId = String(formData.get("tenantId") || "");
    const uploadedBy = ctx.userId;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }
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

    // Ensure FK target exists for uploaded_by before inserting the document.
    await db
      .insert(profiles)
      .values({
        id: ctx.userId,
        email: ctx.userEmail || `${ctx.userId}@local.invalid`,
        role: ctx.role,
      })
      .onConflictDoNothing();

    validateUploadFile(file);
    const buffer = await fileToBuffer(file);
    if (file.type === "application/pdf" && isPasswordProtectedPdf(buffer)) {
      return NextResponse.json(
        { success: false, error: "Password-protected PDF is not supported" },
        { status: 422 }
      );
    }
    const fileHash = sha256(buffer);

    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.fileHash, fileHash)))
      .limit(1);

    const isDuplicate = !!existing;

    const stored = await persistUploadFile({ tenantId, file, buffer });

    const [created] = await db
      .insert(documents)
      .values({
        tenantId,
        uploadedBy,
        intakeSource: "FRONTEND_UPLOAD",
        fileUrl: stored.publicUrl,
        fileHash,
        status: "OCR_PROCESSING",
        ocrRaw: {
          sourceFileName: file.name,
          sourceMimeType: file.type,
          uploadSizeBytes: file.size,
          isDuplicate,
        },
      })
      .returning({ id: documents.id, status: documents.status, fileUrl: documents.fileUrl });

    // Phase 6C: Record file-hash duplicate candidates
    if (isDuplicate && existing) {
      try {
        const { insertDuplicateCandidate } = await import(
          "@/lib/db/queries/duplicates"
        );
        await insertDuplicateCandidate(
          tenantId,
          created.id,
          existing.id,
          "file_hash",
          1.0,
          { reason: "Identical file content (SHA-256 match)" }
        );
      } catch {
        // Non-blocking: duplicate recording failure must not affect upload
      }
    }

    await inngest.send({
      name: "document/uploaded",
      data: {
        documentId: created.id,
        tenantId,
      },
    });

    await writeAuditLog({
      tenantId,
      userId: ctx.userId,
      action: "document.uploaded",
      entityType: "document",
      entityId: created.id,
      metadata: { fileName: file.name, mimeType: file.type, size: file.size },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({ success: true, data: { ...created, isDuplicate } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}


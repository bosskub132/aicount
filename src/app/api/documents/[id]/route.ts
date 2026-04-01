/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  ensureRole,
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { isDocumentMonthLocked } from "@/lib/services/period-lock";
import { learnFromCorrections } from "@/lib/services/extraction/rules/rule-learner";
import type { SuggestionOutcome, DuplicateOutcome } from "@/lib/services/suggestions/types";

type PatchBody = {
  tenantId: string;
  issuerTaxId?: string | null;
  issuerName?: string | null;
  issuerBranch?: string | null;
  documentNumber?: string | null;
  documentDate?: string | null;
  subtotal?: number | null;
  vatAmount?: number | null;
  whtAmount?: number | null;
  grandTotal?: number | null;
  journalType?: "RV" | "SV" | "PV" | "PurV" | "JV" | null;
  direction?: "REVENUE" | "EXPENSE" | null;
  docType?:
    | "RECEIPT"
    | "INVOICE"
    | "PO"
    | "CREDIT_NOTE"
    | "DEBIT_NOTE"
    | "OTHER"
    | null;
  customerTaxId?: string | null;
  discountAmount?: number | null;
  referencePo?: string | null;
  creditDueDate?: string | null;
  extractionStatus?: string;
  ocrRaw?: Record<string, unknown> | null;
  suggestionOutcomes?: { id: string; status: string; finalValue?: string }[];
  duplicateOutcomes?: { id: string; status: string }[];
  status?:
    | "DRAFT"
    | "OCR_PROCESSING"
    | "QUERY"
    | "ACTION_REQUIRED"
    | "PENDING_APPROVAL"
    | "REJECTED"
    | "APPROVED"
    | "EXPORTED"
    | "VOID";
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id } = await context.params;
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
      with: { journalLines: true },
    });
    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }
    if (!ensureTenantScope(ctx.tenantId, doc.tenantId)) return forbidden("Cross-tenant access denied");
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("[GET /api/documents/:id]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin", "maker", "checker"])) return forbidden("Role not allowed");

    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;

    if (!body.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const [existing] = await db
      .select({
        id: documents.id,
        version: documents.version,
        issuerTaxId: documents.issuerTaxId,
        issuerName: documents.issuerName,
        documentNumber: documents.documentNumber,
        documentDate: documents.documentDate,
        subtotal: documents.subtotal,
        vatAmount: documents.vatAmount,
        grandTotal: documents.grandTotal,
        status: documents.status,
        ocrRaw: documents.ocrRaw,
      })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }
    const locked = await isDocumentMonthLocked(body.tenantId, existing.documentDate);
    if (locked && ctx.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Document period is locked. Only admin can edit." },
        { status: 409 }
      );
    }

    const currentRaw = (existing.ocrRaw as any) || {};
    const undoHistory = Array.isArray(currentRaw.undoHistory) ? currentRaw.undoHistory : [];
    undoHistory.push({
      issuerTaxId: existing.issuerTaxId,
      issuerName: existing.issuerName,
      documentNumber: existing.documentNumber,
      documentDate: existing.documentDate,
      subtotal: existing.subtotal,
      vatAmount: existing.vatAmount,
      grandTotal: existing.grandTotal,
      status: existing.status,
      capturedAt: new Date().toISOString(),
      capturedBy: ctx.userId,
    });

    const [updated] = await db
      .update(documents)
      .set({
        issuerTaxId: body.issuerTaxId,
        issuerName: body.issuerName,
        issuerBranch: body.issuerBranch,
        documentNumber: body.documentNumber,
        documentDate: body.documentDate ? new Date(body.documentDate).toISOString().slice(0, 10) : null,
        subtotal: body.subtotal != null ? String(body.subtotal) : null,
        vatAmount: body.vatAmount != null ? String(body.vatAmount) : null,
        whtAmount: body.whtAmount != null ? String(body.whtAmount) : null,
        grandTotal: body.grandTotal != null ? String(body.grandTotal) : null,
        ...(body.customerTaxId !== undefined && { customerTaxId: body.customerTaxId }),
        ...(body.discountAmount !== undefined && { discountAmount: body.discountAmount?.toString() }),
        ...(body.referencePo !== undefined && { referencePo: body.referencePo }),
        ...(body.creditDueDate !== undefined && { creditDueDate: body.creditDueDate }),
        ...(body.extractionStatus !== undefined && { extractionStatus: body.extractionStatus }),
        journalType: body.journalType ?? null,
        direction: body.direction ?? null,
        docType: body.docType ?? null,
        ocrRaw: { ...(body.ocrRaw ?? currentRaw ?? {}), undoHistory },
        status: body.status ?? "ACTION_REQUIRED",
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning({
        id: documents.id,
        status: documents.status,
        version: documents.version,
      });

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.updated",
      entityType: "document",
      entityId: id,
      metadata: { patchedFields: Object.keys(body).filter((k) => k !== "tenantId") },
      ipAddress: ctx.ipAddress,
    });

    // Build map of edited fields for rule learning
    const editedFields: Record<string, unknown> = {};
    if (body.issuerName !== undefined) editedFields.issuerName = body.issuerName;
    if (body.issuerTaxId !== undefined) editedFields.issuerTaxId = body.issuerTaxId;
    if (body.issuerBranch !== undefined) editedFields.issuerBranch = body.issuerBranch;
    if (body.documentNumber !== undefined) editedFields.documentNumber = body.documentNumber;
    if (body.documentDate !== undefined) editedFields.documentDate = body.documentDate;
    if (body.subtotal !== undefined) editedFields.subtotal = body.subtotal;
    if (body.vatAmount !== undefined) editedFields.vatAmount = body.vatAmount;
    if (body.grandTotal !== undefined) editedFields.grandTotal = body.grandTotal;
    if (body.customerTaxId !== undefined) editedFields.customerTaxId = body.customerTaxId;
    if (body.discountAmount !== undefined) editedFields.discountAmount = body.discountAmount;
    if (body.referencePo !== undefined) editedFields.referencePo = body.referencePo;

    // Trigger rule learning in background (don't block response)
    const existingOcrRaw = existing.ocrRaw as Record<string, unknown> | null;
    if (existingOcrRaw && Object.keys(editedFields).length > 0) {
      learnFromCorrections(ctx.tenantId, existingOcrRaw, editedFields)
        .catch((err) => console.error("[Rule Learning] Failed:", err));
    }

    if (body.suggestionOutcomes?.length || body.duplicateOutcomes?.length) {
      const { processBatchOutcomes } = await import(
        "@/lib/services/suggestions/tracking"
      );
      await processBatchOutcomes(
        (body.suggestionOutcomes ?? []) as SuggestionOutcome[],
        (body.duplicateOutcomes ?? []) as DuplicateOutcome[]
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Patch failed" },
      { status: 500 }
    );
  }
}


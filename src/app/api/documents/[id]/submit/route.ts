/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, tenants } from "@/lib/db/schema";
import { replaceJournalLines } from "@/lib/db/queries/documents";
import { classifyTransaction } from "@/lib/services/classification";
import { buildAutoJournalEntries, canPostBalanced } from "@/lib/services/tax-gl-mapping";
import { detectWht } from "@/lib/services/wht-pdf";
import { isDocumentMonthLocked } from "@/lib/services/period-lock";
import {
  ensureRole,
  ensureTenantScope,
  forbidden,
  getRequestContext,
  resolveUserRole,
  unauthorized,
} from "@/lib/api/request-context";
import { writeAuditLog } from "@/lib/services/audit";
import { inngest } from "@/lib/inngest/client";

type SubmitBody = {
  tenantId: string;
  billType?: string | null;
  deptCode?: string | null;
  ocrRaw?: Record<string, unknown>;
  overrideLockedPeriod?: boolean;
  expectedVersion?: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { id } = await context.params;
    const body = (await request.json()) as SubmitBody;

    if (!body?.tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }
    if (!ensureTenantScope(ctx.tenantId, body.tenantId)) return forbidden("Cross-tenant access denied");

    const realRole = await resolveUserRole(ctx.userId, body.tenantId);
    if (!ensureRole(realRole, ["admin", "maker"])) {
      return forbidden("Only maker or admin can submit documents for approval (checker reviews separately).");
    }

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, body.tenantId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }
    if (body.expectedVersion != null && body.expectedVersion !== doc.version) {
      return NextResponse.json(
        { success: false, error: "Document changed by another user. Refresh and retry." },
        { status: 409 }
      );
    }

    const locked = await isDocumentMonthLocked(body.tenantId, doc.documentDate);
    if (locked && !(ctx.role === "admin" && body.overrideLockedPeriod)) {
      return NextResponse.json(
        { success: false, error: "Document period is locked. Admin override required." },
        { status: 409 }
      );
    }

    const nextOcrRaw = (body.ocrRaw as Record<string, unknown>) ?? ((doc.ocrRaw as Record<string, unknown>) || {});

    const [tenant] = await db
      .select({ taxId: tenants.taxId })
      .from(tenants)
      .where(eq(tenants.id, body.tenantId))
      .limit(1);

    const classified = classifyTransaction({
      tenantTaxId: tenant?.taxId || "",
      issuerTaxId: doc.issuerTaxId,
      extractedData: nextOcrRaw as Record<string, any>,
      billType: body.billType || undefined,
    });

    const amount = Number(doc.grandTotal || 0);
    const vatAmount = Number(doc.vatAmount || 0);

    const lineItems = (nextOcrRaw as any)?.line_items_pricing?.line_items || (nextOcrRaw as any)?.line_items || [];
    const lineItemsText = Array.isArray(lineItems)
      ? lineItems.map((it: any) => (typeof it === "string" ? it : it?.description || it?.name || "")).join(" ")
      : "";
    const wht = detectWht({ lineItemsText, subtotal: Number(doc.subtotal || 0) });

    const autoJournal = await buildAutoJournalEntries({
      tenantId: body.tenantId,
      journalType: classified.journalType,
      direction: classified.direction as "REVENUE" | "EXPENSE",
      ocrRaw: nextOcrRaw,
      amount,
      vatAmount,
      whtAmount: wht.applicable ? wht.amount : 0,
      issuerTaxId: doc.issuerTaxId,
      deptCode: body.deptCode || undefined,
    });

    if (!canPostBalanced(autoJournal.entries)) {
      return NextResponse.json(
        { success: false, error: "Generated journal entries are unbalanced" },
        { status: 422 }
      );
    }

    await replaceJournalLines(doc.id, autoJournal.entries);

    await db
      .update(documents)
      .set({
        status: "PENDING_APPROVAL",
        direction: classified.direction as any,
        journalType: classified.journalType as any,
        docType: classified.docType as any,
        ocrRaw: nextOcrRaw,
        currency: String((nextOcrRaw as any)?.amounts?.currency || doc.currency || "THB"),
        exchangeRate:
          (nextOcrRaw as any)?.amounts?.currency &&
          String((nextOcrRaw as any)?.amounts?.currency) !== "THB"
            ? String(Number((nextOcrRaw as any)?.amounts?.exchange_rate || doc.exchangeRate || 1))
            : doc.exchangeRate,
        version: doc.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));

    await inngest.send({
      name: "document/pending_approval",
      data: {
        tenantId: body.tenantId,
        documentId: doc.id,
        makerUserId: ctx.userId,
      },
    });

    await writeAuditLog({
      tenantId: body.tenantId,
      userId: ctx.userId,
      action: "document.submitted",
      entityType: "document",
      entityId: doc.id,
      metadata: { mappingSource: autoJournal.mappingSource },
      ipAddress: ctx.ipAddress,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        status: "PENDING_APPROVAL",
        journalType: classified.journalType,
        mappingSource: autoJournal.mappingSource,
        requiresManualReview: autoJournal.requiresManualReview,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Submit failed" },
      { status: 500 }
    );
  }
}


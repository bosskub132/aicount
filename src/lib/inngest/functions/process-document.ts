/* eslint-disable @typescript-eslint/no-explicit-any */
import { inngest } from "../client";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, tenants } from "@/lib/db/schema";
import { replaceJournalLines } from "@/lib/db/queries/documents";
import { classifyTransaction } from "@/lib/services/classification";
import { extractBillData } from "@/lib/services/ocr";
import { buildAutoJournalEntries, canPostBalanced } from "@/lib/services/tax-gl-mapping";
import { detectWht } from "@/lib/services/wht-pdf";
import { downloadStorageFile } from "@/lib/services/document-intake";

export const processDocument = inngest.createFunction(
  { id: "process-document", retries: 3 },
  { event: "document/uploaded" },
  async ({ event, step }) => {
    const { documentId, tenantId } = event.data as {
      documentId: string;
      tenantId: string;
    };

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
      .limit(1);

    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }
    if (!doc.fileUrl) {
      throw new Error(`Document ${documentId} has no fileUrl`);
    }

    const [tenant] = await db
      .select({ taxId: tenants.taxId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const tenantTaxId = tenant?.taxId || "";

    const imageBuffer = await downloadStorageFile(doc.fileUrl);
    const mimeType = String((doc.ocrRaw as any)?.sourceMimeType || "image/jpeg");

    // Step 1: OCR extraction via Claude
    const ocrResult = await step.run("ocr-extract", async () => {
      return await extractBillData(imageBuffer, mimeType);
    });

    // Step 2: Mathematical validation (subtotal + VAT = grand total)
    const validation = await step.run("validate-math", async () => {
      return ocrResult.validation?.amount_equation || { isValid: false };
    });

    // Step 3: Classify document (direction, doc_type, journal_type)
    const classification = await step.run("classify", async () => {
      return classifyTransaction({
        tenantTaxId: tenantTaxId,
        issuerTaxId: ocrResult?.issuer?.tax_id || doc.issuerTaxId,
        extractedData: ocrResult,
      });
    });

    // Step 4: Tax & GL Mapping (detect WHT first, then pass to journal builder)
    const taxGl = await step.run("tax-gl-mapping", async () => {
      const lineItemsText = Array.isArray(ocrResult?.line_items)
        ? ocrResult.line_items
            .map((it: any) => (typeof it === "string" ? it : it?.description || it?.name || ""))
            .join(" ")
        : "";
      const wht = detectWht({
        lineItemsText,
        subtotal: ocrResult?.amounts?.net_amount_ex_vat ?? doc.subtotal,
      });

      const mapped = await buildAutoJournalEntries({
        tenantId,
        journalType: classification.journalType,
        direction: classification.direction as "REVENUE" | "EXPENSE",
        ocrRaw: ocrResult,
        amount: ocrResult?.amounts?.total_amount ?? doc.grandTotal,
        vatAmount: ocrResult?.amounts?.vat_amount ?? doc.vatAmount,
        whtAmount: wht.applicable ? wht.amount : 0,
        issuerTaxId: ocrResult?.issuer?.tax_id || doc.issuerTaxId,
      });

      return { mapped, wht };
    });

    await step.run("persist-results", async () => {
      const rawEntries = Array.isArray(taxGl.mapped.entries) ? taxGl.mapped.entries : [];
      const mappedEntries = rawEntries.flatMap((entry: any) => {
        if (
          entry &&
          typeof entry === "object" &&
          typeof entry.accountCode === "string" &&
          typeof entry.debit === "number" &&
          typeof entry.credit === "number"
        ) {
          return [
            {
              accountCode: entry.accountCode,
              deptCode: entry.deptCode ?? "",
              debit: entry.debit,
              credit: entry.credit,
              description: entry.description ?? "",
            },
          ];
        }
        return [];
      });

      const balanced = canPostBalanced(mappedEntries);
      const nextStatus =
        ocrResult?.processing?.low_quality || ocrResult?.processing?.needs_rotation_review
          ? "QUERY"
          : classification.pendingMatch || !balanced || taxGl.mapped.requiresManualReview
            ? "ACTION_REQUIRED"
            : "PENDING_APPROVAL";

      await db
        .update(documents)
        .set({
          issuerTaxId: ocrResult?.issuer?.tax_id ?? doc.issuerTaxId,
          issuerName: ocrResult?.issuer?.name ?? doc.issuerName,
          documentNumber: ocrResult?.document?.invoice_number ?? doc.documentNumber,
          documentDate: ocrResult?.document?.issue_date ?? doc.documentDate,
          subtotal: String(ocrResult?.amounts?.net_amount_ex_vat ?? doc.subtotal ?? 0),
          vatAmount: String(ocrResult?.amounts?.vat_amount ?? doc.vatAmount ?? 0),
          grandTotal: String(ocrResult?.amounts?.total_amount ?? doc.grandTotal ?? 0),
          confidenceScore: String(ocrResult?.confidence?.weighted ?? 0),
          direction: (classification.direction as any) || doc.direction,
          docType: (classification.docType || doc.docType || "OTHER") as any,
          journalType: (classification.journalType as any) || doc.journalType,
          status: nextStatus as any,
          ocrRaw: {
            ...ocrResult,
            wht: taxGl.wht.applicable
              ? { rate: taxGl.wht.rate, amount: taxGl.wht.amount, reason: taxGl.wht.reason }
              : undefined,
          },
          whtAmount: taxGl.wht.applicable ? String(taxGl.wht.amount) : doc.whtAmount,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));

      await replaceJournalLines(doc.id, mappedEntries);
    });

    // Step 5: Notify frontend via SSE
    await step.run("notify", async () => {
      // TODO: Send SSE event for document status update
    });

    return {
      documentId,
      tenantId,
      status: "processed",
      preview: {
        confidence: ocrResult?.confidence?.weighted ?? (validation?.isValid ? 0.95 : 0.4),
        journalType: classification.journalType,
        hasRaw: Boolean(ocrResult),
      },
    };
  }
);

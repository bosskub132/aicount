/* eslint-disable @typescript-eslint/no-explicit-any */
import { inngest } from "../client";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, tenants } from "@/lib/db/schema";
import { replaceJournalLines } from "@/lib/db/queries/documents";
import { classifyTransaction } from "@/lib/services/classification";
import { extractBillData, extractRawTextGoogleVision } from "@/lib/services/ocr";
import { extractDocument } from "@/lib/services/extraction/pipeline";
import type { ExtractionResult } from "@/lib/services/extraction/types";
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

    const USE_NEW_PIPELINE = process.env.USE_NEW_EXTRACTION_PIPELINE !== "false";

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

    // ---------- NEW PIPELINE ----------
    if (USE_NEW_PIPELINE) {
      // Step 1: OCR raw text via Google Vision
      const gvResult = await step.run("ocr-raw-text", async () => {
        return await extractRawTextGoogleVision(imageBuffer, mimeType);
      });

      // Step 2: Three-tier structured extraction
      const imageBase64 = imageBuffer.toString("base64");
      const extraction = await step.run("extract-structured", async () => {
        try {
          const result: ExtractionResult = await extractDocument(
            gvResult.rawText,
            tenantId,
            imageBase64,
            mimeType
          );
          return { success: true as const, result };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown extraction error";
          return { success: false as const, error: message };
        }
      });

      // If extraction failed, mark document and return early
      if (!extraction.success) {
        await step.run("persist-extraction-failure", async () => {
          await db
            .update(documents)
            .set({
              status: "QUERY" as any,
              extractionStatus: "failed",
              extractionFailureReason: extraction.error,
              updatedAt: new Date(),
            })
            .where(eq(documents.id, doc.id));
        });

        return {
          documentId,
          tenantId,
          status: "extraction_failed",
          error: extraction.error,
        };
      }

      // Step 3: Classify document using extraction data
      const classification = await step.run("classify", async () => {
        return classifyTransaction({
          tenantTaxId: tenantTaxId,
          issuerTaxId: extraction.result.data.issuer.tax_id,
          extractedData: extraction.result.data as unknown as Record<string, any>,
          billType: extraction.result.data.document.document_type,
        });
      });

      // Step 4: Tax & GL Mapping
      const taxGl = await step.run("tax-gl-mapping", async () => {
        const lineItemsText = extraction.result.data.line_items
          .map((it) => it.description || "")
          .join(" ");
        const wht = detectWht({
          lineItemsText,
          subtotal: extraction.result.data.amounts.net_amount_ex_vat ?? doc.subtotal,
        });

        const mapped = await buildAutoJournalEntries({
          tenantId,
          journalType: classification.journalType,
          direction: classification.direction as "REVENUE" | "EXPENSE",
          ocrRaw: extraction.result.data as unknown as Record<string, any>,
          amount: extraction.result.data.amounts.total_amount ?? doc.grandTotal,
          vatAmount: extraction.result.data.amounts.vat_amount ?? doc.vatAmount,
          whtAmount: wht.applicable ? wht.amount : 0,
          issuerTaxId: extraction.result.data.issuer.tax_id || doc.issuerTaxId,
        });

        return { mapped, wht };
      });

      // Persist results
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
          extraction.result.data.confidence.weighted < 0.5
            ? "QUERY"
            : classification.pendingMatch || !balanced || !extraction.result.validation.overallValid
              ? "ACTION_REQUIRED"
              : "PENDING_APPROVAL";

        await db
          .update(documents)
          .set({
            issuerTaxId: extraction.result.data.issuer.tax_id ?? doc.issuerTaxId,
            issuerName: extraction.result.data.issuer.name ?? doc.issuerName,
            issuerBranch: extraction.result.data.issuer.branch_id || null,
            documentNumber: extraction.result.data.document.invoice_number ?? doc.documentNumber,
            documentDate: extraction.result.data.document.issue_date ?? doc.documentDate,
            subtotal: String(extraction.result.data.amounts.net_amount_ex_vat ?? doc.subtotal ?? 0),
            vatAmount: String(extraction.result.data.amounts.vat_amount ?? doc.vatAmount ?? 0),
            grandTotal: String(extraction.result.data.amounts.total_amount ?? doc.grandTotal ?? 0),
            confidenceScore: String(extraction.result.data.confidence.weighted ?? 0),
            direction: (classification.direction as any) || doc.direction,
            docType: (classification.docType || doc.docType || "OTHER") as any,
            journalType: (classification.journalType as any) || doc.journalType,
            status: nextStatus as any,
            customerTaxId: extraction.result.data.customer.tax_id,
            discountAmount: String(extraction.result.data.amounts.discount_amount ?? 0),
            referencePo: extraction.result.data.document.reference_po,
            creditDueDate: extraction.result.data.document.credit_due_date,
            extractionStatus: "completed",
            ocrRaw: {
              ...extraction.result.data,
              meta: { provider: gvResult.provider, mime_type: mimeType },
              ocr_version: `pipeline-v1-tier${extraction.result.tierUsed}`,
              processing: {
                ocr_tier_used: extraction.result.tierUsed,
                early_terminated: false,
                low_quality: extraction.result.data.confidence.weighted < 0.5,
                needs_rotation_review: false,
              },
              validation: {
                amount_equation: {
                  isValid: extraction.result.validation.overallValid,
                  tolerance: 1.0,
                },
                raw_text_excerpt: gvResult.rawText.substring(0, 500),
              },
              extraction_debug: {
                tier_used: extraction.result.tierUsed,
                escalation_reasons: extraction.result.escalationReasons,
                cost_usd: extraction.result.totalCostUsd,
              },
              wht: taxGl.wht.applicable
                ? { rate: taxGl.wht.rate, amount: taxGl.wht.amount, reason: taxGl.wht.reason }
                : undefined,
            },
            whtAmount: taxGl.wht.applicable ? String(taxGl.wht.amount) : doc.whtAmount,
            whtIncomeType: taxGl.wht.applicable ? taxGl.wht.incomeType : null,
            whtRate: taxGl.wht.applicable ? String(taxGl.wht.rate) : null,
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
          confidence: extraction.result.data.confidence.weighted,
          journalType: classification.journalType,
          hasRaw: true,
          tierUsed: extraction.result.tierUsed,
          costUsd: extraction.result.totalCostUsd,
        },
      };
    }

    // ---------- OLD PIPELINE (fallback) ----------
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
          issuerBranch: ocrResult?.issuer?.branch_id || null,
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
          whtIncomeType: taxGl.wht.applicable ? taxGl.wht.incomeType : null,
          whtRate: taxGl.wht.applicable ? String(taxGl.wht.rate) : null,
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

import { and, eq, isNull } from "drizzle-orm";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";

import { db } from "@/lib/db";
import {
  documents,
  tenants,
  vendors,
  whtCertificates,
} from "@/lib/db/schema";
import { getRetentionPolicy } from "@/lib/db/queries/report-retention";
import { generateWhtCertificateNumber } from "./wht-certificate-number";
import {
  WhtCertificatePdf,
  type WhtCertificateData,
} from "./wht-certificate-pdf";
import {
  getWhtFormType,
  WHT_INCOME_TYPES_PND3,
  WHT_INCOME_TYPES_PND53,
} from "./wht-form-routing";

// ── Types ───────────────────────────────────────────────────────────────────

interface GenerateCertificateInput {
  tenantId: string;
  documentId: string;
  paymentId?: string;
  incomeType?: string; // override
  whtRate?: number; // override
  issuedBy: string; // userId
}

interface GenerateCertificateResult {
  certificateId: string;
  certificateNo: string;
  pdfUrl: string;
}

// ── Supabase Storage Client ─────────────────────────────────────────────────

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables for storage");
  }
  return createClient(url, serviceKey);
}

const STORAGE_BUCKET = "wht-certificates";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the income section code from an income type string and form type.
 * Falls back to a generic "other income" section.
 */
function resolveIncomeSection(
  incomeType: string,
  formType: "pnd3" | "pnd53" | "pp36"
): string {
  if (formType === "pnd3") {
    const entry = WHT_INCOME_TYPES_PND3[incomeType];
    return entry?.section ?? "40(8)";
  }
  if (formType === "pnd53") {
    const entry = WHT_INCOME_TYPES_PND53[incomeType];
    return entry?.type ?? "8";
  }
  // pp36 — non-resident, default to "other"
  return "8";
}

/**
 * Compute an expiration date from the WHT retention policy.
 */
function computeExpiresAt(
  retentionValue: number,
  retentionUnit: string
): Date {
  const now = new Date();
  if (retentionUnit === "years") {
    return new Date(
      now.getFullYear() + retentionValue,
      now.getMonth(),
      now.getDate()
    );
  }
  if (retentionUnit === "months") {
    return new Date(
      now.getFullYear(),
      now.getMonth() + retentionValue,
      now.getDate()
    );
  }
  // Default: treat as days
  const ms = retentionValue * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

// ── generateCertificate ─────────────────────────────────────────────────────

export async function generateCertificate(
  input: GenerateCertificateInput
): Promise<GenerateCertificateResult> {
  const { tenantId, documentId, paymentId, issuedBy } = input;

  // 1. Load document — verify tenant ownership and WHT amount
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
    .limit(1);

  if (!doc) {
    throw new Error("Document not found or does not belong to this tenant");
  }

  const docWhtAmount = Number(doc.whtAmount || 0);
  if (docWhtAmount <= 0) {
    throw new Error("Document has no WHT amount — cannot issue certificate");
  }

  // 2. Load tenant for payer info
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (!tenant.address) {
    throw new Error(
      "Please complete your company address in Settings > Workspace"
    );
  }

  // 3. Try to match vendor by issuerTaxId (may not exist)
  let vendor: (typeof vendors.$inferSelect) | null = null;
  if (doc.issuerTaxId) {
    const [found] = await db
      .select()
      .from(vendors)
      .where(
        and(
          eq(vendors.tenantId, tenantId),
          eq(vendors.taxId, doc.issuerTaxId)
        )
      )
      .limit(1);
    vendor = found ?? null;
  }

  // 4. Determine form type
  const formType: "pnd3" | "pnd53" = vendor
    ? (getWhtFormType({
        vendorType: vendor.vendorType as "individual" | "company",
        isNonResident: vendor.isNonResident,
      }) as "pnd3" | "pnd53")
    : "pnd53";

  // 5. Check for existing active certificate on this document
  const [existingCert] = await db
    .select({ certificateNo: whtCertificates.certificateNo })
    .from(whtCertificates)
    .where(
      and(
        eq(whtCertificates.tenantId, tenantId),
        eq(whtCertificates.documentId, documentId),
        isNull(whtCertificates.voidedAt),
        isNull(whtCertificates.deletedAt)
      )
    )
    .limit(1);

  if (existingCert) {
    throw new Error(
      `Document already has certificate ${existingCert.certificateNo}. Void it first to reissue.`
    );
  }

  // Resolve income type and rate (use overrides or document values)
  const incomeType =
    input.incomeType || doc.whtIncomeType || "ค่าบริการ/จ้างทำของ";
  const whtRate = input.whtRate ?? Number(doc.whtRate || 3);
  const incomeSection = resolveIncomeSection(incomeType, formType);
  const paymentDate =
    doc.documentDate || new Date().toISOString().slice(0, 10);
  const amountPaid = Number(doc.grandTotal || doc.subtotal || 0);
  const issuedAt = new Date().toISOString();

  // 6. Transaction: number, render, upload, insert
  const result = await db.transaction(async (tx) => {
    // 6a. Generate certificate number
    const certificateNo = await generateWhtCertificateNumber(tx, tenantId);

    // 6b. Build certificate data snapshot
    const certData: WhtCertificateData = {
      certificateNo,
      formType,
      payerName: tenant.name,
      payerTaxId: tenant.taxId,
      payerBranch: tenant.branchNumber || "00000",
      payerAddress: tenant.address || undefined,
      payeeName: vendor?.name || doc.issuerName || "Unknown",
      payeeTaxId: vendor?.taxId || doc.issuerTaxId || "0000000000000",
      payeeBranch: vendor?.branchNumber || doc.issuerBranch || "00000",
      payeeAddress: vendor?.address || undefined,
      incomeType,
      incomeSection,
      paymentDate,
      amountPaid,
      whtRate,
      whtAmount: docWhtAmount,
      issuedAt,
    };

    // 6c. Render PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @react-pdf/renderer type mismatch
    const pdfElement: any = createElement(WhtCertificatePdf, { data: certData });
    const pdfBuffer = await renderToBuffer(pdfElement);

    // 6d. Upload to Supabase Storage
    const storagePath = `${tenantId}/wht-certificates/${certificateNo}.pdf`;
    const supabase = getStorageClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 6e. Compute expires_at from retention policy
    const retention = await getRetentionPolicy(tenantId);
    const expiresAt = computeExpiresAt(
      retention.whtRetentionValue,
      retention.whtRetentionUnit
    );

    // 6f. Insert whtCertificates row
    const [cert] = await tx
      .insert(whtCertificates)
      .values({
        tenantId,
        certificateNo,
        documentId,
        paymentId: paymentId || null,
        vendorId: vendor?.id || null,
        formType,
        payeeName: certData.payeeName,
        payeeTaxId: certData.payeeTaxId,
        payeeBranch: certData.payeeBranch,
        payeeAddress: certData.payeeAddress || null,
        payerName: certData.payerName,
        payerTaxId: certData.payerTaxId,
        payerAddress: certData.payerAddress || null,
        payerBranch: certData.payerBranch,
        incomeType,
        incomeSection,
        paymentDate,
        amountPaid: String(amountPaid),
        whtRate: String(whtRate),
        whtAmount: String(docWhtAmount),
        pdfStoragePath: storagePath,
        pdfSizeBytes: pdfBuffer.length,
        issuedBy,
        expiresAt,
      })
      .returning({ id: whtCertificates.id });

    return { certificateId: cert.id, certificateNo, storagePath };
  });

  // 7. Generate signed URL (1 hour)
  const supabase = getStorageClient();
  const { data: signedData, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(result.storagePath, 3600);

  if (signError || !signedData?.signedUrl) {
    throw new Error("Failed to generate signed URL for certificate PDF");
  }

  // 8. Return result
  return {
    certificateId: result.certificateId,
    certificateNo: result.certificateNo,
    pdfUrl: signedData.signedUrl,
  };
}

// ── voidCertificate ─────────────────────────────────────────────────────────

export async function voidCertificate(
  tenantId: string,
  certificateId: string,
  reason: string,
  userId: string
): Promise<void> {
  // 1. Load certificate — verify tenant and not already voided
  const [cert] = await db
    .select()
    .from(whtCertificates)
    .where(
      and(
        eq(whtCertificates.id, certificateId),
        eq(whtCertificates.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!cert) {
    throw new Error("Certificate not found or does not belong to this tenant");
  }

  if (cert.voidedAt) {
    throw new Error("Certificate is already voided");
  }

  // 2. Build voided PDF data from the existing certificate record
  const certData: WhtCertificateData = {
    certificateNo: cert.certificateNo,
    formType: cert.formType as "pnd3" | "pnd53",
    payerName: cert.payerName,
    payerTaxId: cert.payerTaxId,
    payerBranch: cert.payerBranch || "00000",
    payerAddress: cert.payerAddress || undefined,
    payeeName: cert.payeeName,
    payeeTaxId: cert.payeeTaxId,
    payeeBranch: cert.payeeBranch || "00000",
    payeeAddress: cert.payeeAddress || undefined,
    incomeType: cert.incomeType,
    incomeSection: cert.incomeSection,
    paymentDate: cert.paymentDate,
    amountPaid: Number(cert.amountPaid),
    whtRate: Number(cert.whtRate),
    whtAmount: Number(cert.whtAmount),
    issuedAt: cert.issuedAt.toISOString(),
    isVoided: true,
  };

  // 3. Re-render PDF with voided watermark
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @react-pdf/renderer type mismatch
  const voidPdfElement: any = createElement(WhtCertificatePdf, { data: certData });
  const pdfBuffer = await renderToBuffer(voidPdfElement);

  // 4. Overwrite at the same storage path
  if (cert.pdfStoragePath) {
    const supabase = getStorageClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(cert.pdfStoragePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
  }

  // 5. Update the record
  await db
    .update(whtCertificates)
    .set({
      voidedAt: new Date(),
      voidedBy: userId,
      voidReason: reason,
      pdfSizeBytes: pdfBuffer.length,
      updatedAt: new Date(),
    })
    .where(eq(whtCertificates.id, certificateId));
}

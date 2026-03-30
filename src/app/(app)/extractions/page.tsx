/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Save,
  Send,
  Undo2,
  User,
  FileText,
  DollarSign,
  Package,
  BookOpen,
  Code,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { useDocument } from "@/lib/hooks/use-documents";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { DocumentImageViewer } from "@/components/document-image-viewer";
import { ConfidenceBar } from "@/components/confidence-bar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Button } from "@/components/button";
import { Badge, StatusBadge } from "@/components/badge";
import { Skeleton } from "@/components/skeleton";
import { compareBuyerName } from "@/lib/services/buyer-name-matcher";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DOC_TYPE_OPTIONS = [
  { value: "RECEIPT", label: "Receipt" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PO", label: "Purchase Order" },
  { value: "CREDIT_NOTE", label: "Credit Note" },
  { value: "DEBIT_NOTE", label: "Debit Note" },
  { value: "OTHER", label: "Other" },
];

const DIRECTION_OPTIONS = [
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
];

const JOURNAL_TYPE_OPTIONS = [
  { value: "RV", label: "RV - Revenue Voucher" },
  { value: "SV", label: "SV - Sales Voucher" },
  { value: "PV", label: "PV - Payment Voucher" },
  { value: "PurV", label: "PurV - Purchase Voucher" },
  { value: "JV", label: "JV - Journal Voucher" },
];

const EDITABLE_STATUSES = ["ACTION_REQUIRED", "DRAFT", "QUERY", "REJECTED"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number | string | null | undefined, currency = "THB") {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return null;
  const symbol = currency === "THB" ? "\u0E3F" : currency + " ";
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeConfidence(raw: number): number {
  return raw > 1 ? raw / 100 : raw;
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-[var(--border)] last:border-b-0">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 hover:bg-[var(--muted)] select-none list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-semibold text-[var(--foreground)]">{title}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-4">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  Field wrapper                                                      */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <label className="mb-1 block text-[13px] font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Line Items Table                                                   */
/* ------------------------------------------------------------------ */

function LineItemsTable({ items, currency }: { items: any[]; currency: string }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-[var(--muted-foreground)]">
        <Package className="h-5 w-5" />
        <span className="text-sm">No line items extracted</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
            <th className="w-10 px-3 py-2 text-center font-medium">#</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Unit Price</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const desc = typeof item === "string" ? item : item?.description || item?.name || "-";
            const qty = item?.quantity ?? item?.qty ?? "";
            const unitPrice = item?.unit_price ?? item?.price ?? "";
            const total = item?.total ?? item?.amount ?? "";
            return (
              <tr key={idx} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-center text-[var(--muted-foreground)]">{idx + 1}</td>
                <td className="px-3 py-2 text-[var(--foreground)]">{desc}</td>
                <td className="px-3 py-2 text-right text-[var(--foreground)]">{qty}</td>
                <td className="px-3 py-2 text-right text-[var(--foreground)]">
                  {unitPrice !== "" ? formatCurrency(unitPrice, currency) || unitPrice : "-"}
                </td>
                <td className="px-3 py-2 text-right font-medium text-[var(--foreground)]">
                  {total !== "" ? formatCurrency(total, currency) || total : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Journal Entries (auto-generated, read-only)                        */
/* ------------------------------------------------------------------ */

function JournalEntries({ doc }: { doc: any }) {
  const ocr = doc.ocrRaw || {};
  const currency = doc.currency || ocr.amounts?.currency || "THB";
  const grandTotal = doc.grandTotal || ocr.amounts?.total_amount;
  const vatAmount = doc.vatAmount || ocr.amounts?.vat_amount;
  const subtotal = doc.subtotal || ocr.amounts?.net_amount_ex_vat;
  const direction = doc.direction;
  const journalType = doc.journalType;

  if (!grandTotal) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-[var(--muted-foreground)]">
        <BookOpen className="h-5 w-5" />
        <span className="text-sm">No journal entries generated</span>
      </div>
    );
  }

  const entries: { account: string; debit: string; credit: string }[] = [];
  if (direction === "EXPENSE") {
    entries.push({ account: "Expense", debit: formatCurrency(subtotal || grandTotal, currency) || "-", credit: "-" });
    if (vatAmount && Number(vatAmount) > 0) {
      entries.push({ account: "Input VAT", debit: formatCurrency(vatAmount, currency) || "-", credit: "-" });
    }
    entries.push({ account: "Accounts Payable", debit: "-", credit: formatCurrency(grandTotal, currency) || "-" });
  } else {
    entries.push({ account: "Accounts Receivable", debit: formatCurrency(grandTotal, currency) || "-", credit: "-" });
    if (vatAmount && Number(vatAmount) > 0) {
      entries.push({ account: "Output VAT", debit: "-", credit: formatCurrency(vatAmount, currency) || "-" });
    }
    entries.push({ account: "Revenue", debit: "-", credit: formatCurrency(subtotal || grandTotal, currency) || "-" });
  }

  return (
    <div>
      {journalType && (
        <Badge className="mb-2">{journalType}</Badge>
      )}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-[var(--foreground)]">{e.account}</td>
                <td className="px-3 py-2 text-right text-[var(--foreground)]">{e.debit}</td>
                <td className="px-3 py-2 text-right text-[var(--foreground)]">{e.credit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Extraction Content                                            */
/* ------------------------------------------------------------------ */

function ExtractionsContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const { data: doc, isLoading, refetch } = useDocument(docId);
  const toast = useToast();

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tenantName, setTenantName] = useState("");

  const hasEdits = Object.keys(editValues).length > 0;

  /* Derived data from document */
  const ocr = doc?.ocrRaw || {};
  const rawScore = doc?.confidenceScore ? Number(doc.confidenceScore) : (ocr.confidence?.weighted ?? 0);
  const confidence = normalizeConfidence(rawScore);
  const currency = doc?.currency || ocr.amounts?.currency || "THB";
  const lineItems = ocr.line_items || [];
  const canEdit = doc ? EDITABLE_STATUSES.includes(doc.status) : false;

  /* ---- fetch tenant name for buyer mismatch check ---- */
  useEffect(() => {
    const tid = getWorkspaceTenantId();
    if (!tid) return;
    fetch(`/api/tenants/${tid}`, { headers: { "x-tenant-id": tid } })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTenantName(json.data?.name || "");
      })
      .catch(() => {});
  }, []);

  const buyerName = ocr.customer?.name || null;
  const buyerCheck = compareBuyerName(buyerName, tenantName);

  const issuerName = doc?.issuerName || ocr.issuer?.name || "Unknown";
  const docNumber = doc?.documentNumber || ocr.document?.invoice_number || "No Number";

  /* ---- field value helper: edited value takes precedence ---- */
  const val = useCallback(
    (key: string, fallback: any) => {
      if (key in editValues) return editValues[key];
      return fallback ?? "";
    },
    [editValues],
  );

  const onFieldChange = useCallback((key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ---- API actions ---- */
  const tenantId = getWorkspaceTenantId();

  async function saveDraft() {
    if (!doc) return;
    setSaving(true);
    try {
      const updatedOcrRaw = { ...ocr };
      if ("issuerName" in editValues || "issuerTaxId" in editValues || "issuerBranch" in editValues || "issuerAddress" in editValues) {
        updatedOcrRaw.issuer = {
          ...updatedOcrRaw.issuer,
          name: editValues.issuerName ?? updatedOcrRaw.issuer?.name,
          tax_id: editValues.issuerTaxId ?? updatedOcrRaw.issuer?.tax_id,
          branch_id: editValues.issuerBranch ?? updatedOcrRaw.issuer?.branch_id,
          address: editValues.issuerAddress ?? updatedOcrRaw.issuer?.address,
        };
      }
      if ("documentNumber" in editValues || "documentDate" in editValues) {
        updatedOcrRaw.document = {
          ...updatedOcrRaw.document,
          invoice_number: editValues.documentNumber ?? updatedOcrRaw.document?.invoice_number,
          issue_date: editValues.documentDate ?? updatedOcrRaw.document?.issue_date,
        };
      }
      if ("subtotal" in editValues || "vatAmount" in editValues || "grandTotal" in editValues || "whtAmount" in editValues) {
        updatedOcrRaw.amounts = {
          ...updatedOcrRaw.amounts,
          net_amount_ex_vat: editValues.subtotal ? Number(editValues.subtotal) : updatedOcrRaw.amounts?.net_amount_ex_vat,
          vat_amount: editValues.vatAmount ? Number(editValues.vatAmount) : updatedOcrRaw.amounts?.vat_amount,
          total_amount: editValues.grandTotal ? Number(editValues.grandTotal) : updatedOcrRaw.amounts?.total_amount,
          wht_amount: editValues.whtAmount ? Number(editValues.whtAmount) : updatedOcrRaw.amounts?.wht_amount,
          currency: editValues.currency ?? updatedOcrRaw.amounts?.currency,
        };
      }

      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({
          tenantId,
          issuerName: editValues.issuerName ?? doc.issuerName ?? null,
          issuerTaxId: editValues.issuerTaxId ?? doc.issuerTaxId ?? null,
          documentNumber: editValues.documentNumber ?? doc.documentNumber ?? null,
          documentDate: editValues.documentDate ?? doc.documentDate ?? null,
          subtotal: editValues.subtotal ? Number(editValues.subtotal) : doc.subtotal ? Number(doc.subtotal) : null,
          vatAmount: editValues.vatAmount ? Number(editValues.vatAmount) : doc.vatAmount ? Number(doc.vatAmount) : null,
          grandTotal: editValues.grandTotal ? Number(editValues.grandTotal) : doc.grandTotal ? Number(doc.grandTotal) : null,
          whtAmount: editValues.whtAmount ? Number(editValues.whtAmount) : doc.whtAmount ? Number(doc.whtAmount) : null,
          direction: editValues.direction ?? doc.direction ?? null,
          journalType: editValues.journalType ?? doc.journalType ?? null,
          docType: editValues.docType ?? doc.docType ?? null,
          currency: editValues.currency ?? doc.currency ?? null,
          ocrRaw: updatedOcrRaw,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Draft saved successfully");
      setEditValues({});
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    if (!doc) return;
    // Save first if there are edits
    if (hasEdits) {
      await saveDraft();
    }
    try {
      const res = await fetch(`/api/documents/${doc.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Submitted for approval");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    }
  }

  async function revertChanges() {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Changes reverted");
      setEditValues({});
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revert failed");
    }
  }

  /* ---- Loading skeleton ---- */
  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton variant="text" width="280px" height="20px" />
        <div className="flex flex-1 gap-6">
          <div className="w-[40%]">
            <Skeleton variant="rect" height="100%" />
          </div>
          <div className="flex w-[60%] flex-col gap-3">
            <Skeleton variant="rect" height="40px" />
            <Skeleton variant="rect" height="200px" />
            <Skeleton variant="rect" height="200px" />
            <Skeleton variant="rect" height="120px" />
          </div>
        </div>
      </div>
    );
  }

  /* ---- No document selected ---- */
  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]">
        <FileText className="h-12 w-12" />
        <p className="text-sm">
          {docId ? "Document not found" : "No document selected. Pass ?docId= in the URL."}
        </p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar: breadcrumbs + actions */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-3">
        <Breadcrumbs
          items={[
            { label: "Documents", href: "/documents" },
            { label: `${issuerName} \u2014 ${docNumber}` },
          ]}
        />
        <div className="flex items-center gap-2">
          <StatusBadge status={doc.status} />
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Undo2 className="h-4 w-4" />}
                onClick={revertChanges}
              >
                Revert
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Save className="h-4 w-4" />}
                loading={saving}
                onClick={saveDraft}
                disabled={!hasEdits}
              >
                Save Draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={submitForApproval}
              >
                Submit for Approval
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Document Image (~40%) */}
        <div className="w-[40%] border-r border-[var(--border)]">
          {doc.fileUrl ? (
            <DocumentImageViewer src={doc.fileUrl} alt={`${issuerName} - ${docNumber}`} />
          ) : (
            <div className="flex h-full items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
              No image available
            </div>
          )}
        </div>

        {/* Right: Editable fields (~60%) */}
        <div className="w-[60%] overflow-y-auto">
          {/* Confidence bar at top */}
          <div className="border-b border-[var(--border)] px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Overall Confidence</span>
              <div className="w-48">
                <ConfidenceBar score={confidence} size="md" showLabel />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div>
            {/* --- Issuer Information --- */}
            <Section
              icon={<User className="h-4 w-4 text-[var(--muted-foreground)]" />}
              title="Issuer Information"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Field label="Issuer Name / \u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E2D\u0E2D\u0E01">
                  {canEdit ? (
                    <Input
                      value={val("issuerName", doc.issuerName || ocr.issuer?.name)}
                      onChange={(e) => onFieldChange("issuerName", e.target.value)}
                      placeholder="Issuer name"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.issuerName || ocr.issuer?.name || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Tax ID / \u0E40\u0E25\u0E02\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E15\u0E31\u0E27\u0E1C\u0E39\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E20\u0E32\u0E29\u0E35">
                  {canEdit ? (
                    <Input
                      value={val("issuerTaxId", doc.issuerTaxId || ocr.issuer?.tax_id)}
                      onChange={(e) => onFieldChange("issuerTaxId", e.target.value)}
                      placeholder="Tax ID"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.issuerTaxId || ocr.issuer?.tax_id || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Branch / \u0E2A\u0E32\u0E02\u0E32">
                  {canEdit ? (
                    <Input
                      value={val("issuerBranch", ocr.issuer?.branch_id || ocr.issuer?.branch)}
                      onChange={(e) => onFieldChange("issuerBranch", e.target.value)}
                      placeholder="Branch"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {ocr.issuer?.branch_id || ocr.issuer?.branch || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Address / \u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48">
                  {canEdit ? (
                    <Input
                      value={val("issuerAddress", ocr.issuer?.address)}
                      onChange={(e) => onFieldChange("issuerAddress", e.target.value)}
                      placeholder="Address"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {ocr.issuer?.address || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
              </div>
            </Section>

            {/* --- Buyer Name Mismatch Alert --- */}
            {!buyerCheck.match && (
              <div className="mx-5 mt-3 rounded-[var(--radius-input)] border border-[var(--warning)] bg-[var(--warning-light)] px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--warning)] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900">Buyer name mismatch</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      OCR detected: &quot;{buyerName}&quot; — Your workspace: &quot;{tenantName}&quot;.
                      This document may have been uploaded to the wrong workspace.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- Transaction Details --- */}
            <Section
              icon={<FileText className="h-4 w-4 text-[var(--muted-foreground)]" />}
              title="Transaction Details"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Field label="Document Number / \u0E40\u0E25\u0E02\u0E17\u0E35\u0E48\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23">
                  {canEdit ? (
                    <Input
                      value={val("documentNumber", doc.documentNumber || ocr.document?.invoice_number)}
                      onChange={(e) => onFieldChange("documentNumber", e.target.value)}
                      placeholder="Document number"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.documentNumber || ocr.document?.invoice_number || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Document Date / \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48">
                  {canEdit ? (
                    <Input
                      type="date"
                      value={val("documentDate", doc.documentDate || ocr.document?.issue_date)}
                      onChange={(e) => onFieldChange("documentDate", e.target.value)}
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.documentDate || ocr.document?.issue_date || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Document Type / \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23">
                  {canEdit ? (
                    <Select
                      options={DOC_TYPE_OPTIONS}
                      value={val("docType", doc.docType || ocr.document?.document_type)}
                      onChange={(v) => onFieldChange("docType", v)}
                      placeholder="Select type..."
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.docType || ocr.document?.document_type || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Direction / \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17">
                  {canEdit ? (
                    <Select
                      options={DIRECTION_OPTIONS}
                      value={val("direction", doc.direction)}
                      onChange={(v) => onFieldChange("direction", v)}
                      placeholder="Select direction..."
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.direction || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Journal Type / \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01">
                  {canEdit ? (
                    <Select
                      options={JOURNAL_TYPE_OPTIONS}
                      value={val("journalType", doc.journalType)}
                      onChange={(v) => onFieldChange("journalType", v)}
                      placeholder="Select journal type..."
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {doc.journalType || <span className="text-[var(--muted-foreground)]">Not extracted</span>}
                    </p>
                  )}
                </Field>
                <Field label="Currency / \u0E2A\u0E01\u0E38\u0E25\u0E40\u0E07\u0E34\u0E19">
                  {canEdit ? (
                    <Input
                      value={val("currency", currency)}
                      onChange={(e) => onFieldChange("currency", e.target.value)}
                      placeholder="THB"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {currency}
                    </p>
                  )}
                </Field>
              </div>
            </Section>

            {/* --- Pricing & VAT --- */}
            <Section
              icon={<DollarSign className="h-4 w-4 text-[var(--muted-foreground)]" />}
              title="Pricing & VAT"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Field label="Subtotal / \u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E20\u0E32\u0E29\u0E35">
                  {canEdit ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={val("subtotal", doc.subtotal || ocr.amounts?.net_amount_ex_vat)}
                      onChange={(e) => onFieldChange("subtotal", e.target.value)}
                      placeholder="0.00"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {formatCurrency(doc.subtotal || ocr.amounts?.net_amount_ex_vat, currency) || <span className="text-[var(--muted-foreground)]">-</span>}
                    </p>
                  )}
                </Field>
                <Field label="VAT Amount / \u0E20\u0E32\u0E29\u0E35\u0E21\u0E39\u0E25\u0E04\u0E48\u0E32\u0E40\u0E1E\u0E34\u0E48\u0E21">
                  {canEdit ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={val("vatAmount", doc.vatAmount || ocr.amounts?.vat_amount)}
                      onChange={(e) => onFieldChange("vatAmount", e.target.value)}
                      placeholder="0.00"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {formatCurrency(doc.vatAmount || ocr.amounts?.vat_amount, currency) || <span className="text-[var(--muted-foreground)]">-</span>}
                    </p>
                  )}
                </Field>
                <Field label="Grand Total / \u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E34\u0E49\u0E19">
                  {canEdit ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={val("grandTotal", doc.grandTotal || ocr.amounts?.total_amount)}
                      onChange={(e) => onFieldChange("grandTotal", e.target.value)}
                      placeholder="0.00"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm font-semibold">
                      {formatCurrency(doc.grandTotal || ocr.amounts?.total_amount, currency) || <span className="text-[var(--muted-foreground)]">-</span>}
                    </p>
                  )}
                </Field>
                <Field label="WHT Amount / \u0E20\u0E32\u0E29\u0E35\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22">
                  {canEdit ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={val("whtAmount", doc.whtAmount || ocr.amounts?.wht_amount)}
                      onChange={(e) => onFieldChange("whtAmount", e.target.value)}
                      placeholder="0.00"
                    />
                  ) : (
                    <p className="rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-2 text-sm">
                      {formatCurrency(doc.whtAmount || ocr.amounts?.wht_amount, currency) || <span className="text-[var(--muted-foreground)]">-</span>}
                    </p>
                  )}
                </Field>
              </div>
            </Section>

            {/* --- Line Items --- */}
            <Section
              icon={<Package className="h-4 w-4 text-[var(--muted-foreground)]" />}
              title="Line Items"
            >
              <LineItemsTable items={lineItems} currency={currency} />
            </Section>

            {/* --- Journal Entries --- */}
            <Section
              icon={<BookOpen className="h-4 w-4 text-[var(--muted-foreground)]" />}
              title="Journal Entries"
            >
              <JournalEntries doc={doc} />
            </Section>

            {/* --- Raw OCR JSON --- */}
            <Section
              icon={<Code className="h-4 w-4 text-[var(--muted-foreground)]" />}
              title="Raw OCR JSON"
              defaultOpen={false}
            >
              <div className="relative">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(ocr, null, 2));
                    toast.success("Copied to clipboard");
                  }}
                  className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border)] bg-white px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
                <pre className="max-h-96 overflow-auto rounded-[var(--radius-card)] bg-slate-900 p-4 text-xs leading-relaxed text-emerald-400">
                  {JSON.stringify(ocr, null, 2)}
                </pre>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Export                                                         */
/* ------------------------------------------------------------------ */

export default function ExtractionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col gap-4 p-6">
          <Skeleton variant="text" width="280px" height="20px" />
          <div className="flex flex-1 gap-6">
            <div className="w-[40%]">
              <Skeleton variant="rect" height="400px" />
            </div>
            <div className="flex w-[60%] flex-col gap-3">
              <Skeleton variant="rect" height="40px" />
              <Skeleton variant="rect" height="200px" />
              <Skeleton variant="rect" height="200px" />
            </div>
          </div>
        </div>
      }
    >
      <ExtractionsContent />
    </Suspense>
  );
}

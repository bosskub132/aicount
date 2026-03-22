/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

type DocDetail = {
  id: string;
  status: string;
  issuerName: string | null;
  issuerTaxId: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  grandTotal: string | null;
  whtAmount: string | null;
  direction: string | null;
  docType: string | null;
  journalType: string | null;
  confidenceScore: string | null;
  currency: string | null;
  ocrRaw: any;
  fileUrl: string | null;
  createdAt: string;
};

type DocSummary = {
  id: string;
  issuerName: string | null;
  grandTotal: string | null;
  confidenceScore: string | null;
  documentDate: string | null;
  status: string;
};

/** All confidence helpers work on 0–1 scale (e.g. 0.70 = 70 %). */
function confidenceBadgeClass(score: number) {
  if (score >= 0.8) return "bg-emerald-100 text-emerald-700";
  if (score >= 0.5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function confidenceBarColor(score: number) {
  if (score >= 0.8) return "bg-emerald-500";
  if (score >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

function formatConfidence(score: number) {
  return `${Math.round(score * 100)}%`;
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.min(score * 100, 100);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${confidenceBarColor(score)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceBadgeClass(score)}`}>
          {formatConfidence(score)}
        </span>
      </div>
    </div>
  );
}

function FieldConfidence({ confidence }: { confidence?: number }) {
  if (typeof confidence !== "number") return null;
  const pct = Math.min(confidence * 100, 100);
  const color = confidence >= 0.8 ? "text-emerald-600" : confidence >= 0.5 ? "text-amber-600" : "text-red-600";
  const barColor = confidenceBarColor(confidence);
  return (
    <span className="ml-auto flex items-center gap-1.5" title={`Confidence: ${Math.round(confidence * 100)}%`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200">
        <span
          className={`block h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={`text-[10px] font-medium ${color}`}>{formatConfidence(confidence)}</span>
    </span>
  );
}

function formatCurrency(value: number | string | null | undefined, currency = "THB") {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return null;
  const symbol = currency === "THB" ? "฿" : currency + " ";
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

function FieldRow({
  index,
  label,
  value,
  confidence,
  editing,
  editKey,
  editValues,
  onEditChange,
  options,
}: {
  index: number;
  label: string;
  value: string | null | undefined;
  confidence?: number;
  editing?: boolean;
  editKey?: string;
  editValues?: Record<string, string>;
  onEditChange?: (key: string, val: string) => void;
  options?: { value: string; label: string }[];
}) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <div className="py-2.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-slate-400">{index}.</span>
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <FieldConfidence confidence={confidence} />
      </div>
      {editing && editKey && onEditChange && editValues ? (
        options ? (
          <select
            className="ml-5 w-[calc(100%-1.25rem)] rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
            value={editValues[editKey] ?? value ?? ""}
            onChange={(e) => onEditChange(editKey, e.target.value)}
          >
            <option value="">— Select —</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            className="ml-5 w-[calc(100%-1.25rem)] rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
            value={editValues[editKey] ?? value ?? ""}
            onChange={(e) => onEditChange(editKey, e.target.value)}
            placeholder={label.split(" / ").pop()}
          />
        )
      ) : hasValue ? (
        <div className="ml-5 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">
          {value}
        </div>
      ) : (
        <div className="ml-5 flex items-center gap-1.5 text-sm text-amber-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Not extracted
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  fieldRange,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  fieldRange: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            {fieldRange}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function LineItemsTable({ items }: { items: any[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500">
            <th className="w-8 px-3 py-2 text-center font-medium">#</th>
            <th className="px-3 py-2 font-medium">รายการ / Description</th>
            <th className="px-3 py-2 text-right font-medium">จำนวน / Qty</th>
            <th className="px-3 py-2 text-right font-medium">ราคาต่อหน่วย / Unit Price</th>
            <th className="px-3 py-2 text-right font-medium">รวม / Total</th>
          </tr>
        </thead>
        <tbody>
          {(!items || items.length === 0) ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                <div className="flex flex-col items-center gap-1">
                  <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <span>No product items extracted</span>
                </div>
              </td>
            </tr>
          ) : (
            items.map((item: any, idx: number) => {
              const desc = typeof item === "string" ? item : item?.description || item?.name || "-";
              const qty = item?.quantity ?? item?.qty ?? "";
              const unitPrice = item?.unit_price ?? item?.price ?? "";
              const total = item?.total ?? item?.amount ?? "";
              return (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{desc}</div>
                    {item?.category && <div className="text-[10px] text-slate-400">{item.category}</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{qty}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {unitPrice !== "" ? formatCurrency(unitPrice) || unitPrice : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">
                    {total !== "" ? formatCurrency(total) || total : "-"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExtractionDetail({
  detail,
  tenantId,
  onUpdate,
  canSubmitForApproval = true,
}: {
  detail: DocDetail;
  tenantId: string;
  onUpdate: () => void;
  /** False for checker-only users — makers/admins submit to the approval queue. */
  canSubmitForApproval?: boolean;
}) {
  const ocr = detail.ocrRaw || {};
  const rawScore = detail.confidenceScore ? Number(detail.confidenceScore) : (ocr.confidence?.weighted ?? 0);
  // Normalize to 0–1 scale (legacy values may be stored as 0–100)
  const confidence = rawScore > 1 ? rawScore / 100 : rawScore;
  const perField = ocr.confidence?.per_field || {};
  const currency = detail.currency || ocr.amounts?.currency || "THB";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  function startEditing() {
    setEditValues({
      // Customer Information
      issuerName: detail.issuerName || ocr.issuer?.name || "",
      issuerTaxId: detail.issuerTaxId || ocr.issuer?.tax_id || "",
      address: ocr.issuer?.address || "",
      postalCode: ocr.issuer?.postal_code || "",
      branchId: ocr.issuer?.branch_id || ocr.issuer?.branch || "",
      // Transaction Details
      documentNumber: detail.documentNumber || ocr.document?.invoice_number || "",
      documentDate: detail.documentDate || ocr.document?.issue_date || "",
      creditDays: String(ocr.document?.credit_days ?? ocr.credit_days ?? ""),
      dueDate: ocr.document?.due_date || "",
      currency: currency,
      // Line Items & Pricing
      vatMode: ocr.accounting?.vat_mode || "",
      docType: detail.docType || ocr.document?.document_type || "",
      expenseCategory: ocr.accounting?.expense_type || "",
      // Amounts
      subtotal: detail.subtotal || String(ocr.amounts?.net_amount_ex_vat ?? ""),
      vatAmount: detail.vatAmount || String(ocr.amounts?.vat_amount ?? ""),
      grandTotal: detail.grandTotal || String(ocr.amounts?.total_amount ?? ""),
      whtAmount: detail.whtAmount || String(ocr.amounts?.wht_amount ?? ""),
      // Customer / Buyer Information
      customerName: ocr.customer?.name || "",
      customerAddress: ocr.customer?.address || "",
      customerBranchId: ocr.customer?.branch_id || "",
      // Additional Information
      direction: detail.direction || "",
      journalType: detail.journalType || "",
      notes: ocr.accounting?.notes || "",
    });
    setEditing(true);
    setMsg(null);
  }

  function cancelEditing() {
    setEditing(false);
    setEditValues({});
    setMsg(null);
  }

  function onEditChange(key: string, val: string) {
    setEditValues((prev) => ({ ...prev, [key]: val }));
  }

  async function saveChanges() {
    setSaving(true);
    setMsg(null);
    try {
      // Build updated ocrRaw with edited OCR-level fields
      const updatedOcrRaw = { ...ocr };
      updatedOcrRaw.issuer = {
        ...updatedOcrRaw.issuer,
        name: editValues.issuerName || updatedOcrRaw.issuer?.name,
        tax_id: editValues.issuerTaxId || updatedOcrRaw.issuer?.tax_id,
        address: editValues.address || null,
        postal_code: editValues.postalCode || null,
        branch_id: editValues.branchId || null,
      };
      updatedOcrRaw.document = {
        ...updatedOcrRaw.document,
        invoice_number: editValues.documentNumber || updatedOcrRaw.document?.invoice_number,
        issue_date: editValues.documentDate || updatedOcrRaw.document?.issue_date,
        credit_days: editValues.creditDays || null,
        due_date: editValues.dueDate || null,
        document_type: editValues.docType || updatedOcrRaw.document?.document_type,
      };
      updatedOcrRaw.amounts = {
        ...updatedOcrRaw.amounts,
        currency: editValues.currency || updatedOcrRaw.amounts?.currency,
        net_amount_ex_vat: editValues.subtotal ? Number(editValues.subtotal) : updatedOcrRaw.amounts?.net_amount_ex_vat,
        vat_amount: editValues.vatAmount ? Number(editValues.vatAmount) : updatedOcrRaw.amounts?.vat_amount,
        total_amount: editValues.grandTotal ? Number(editValues.grandTotal) : updatedOcrRaw.amounts?.total_amount,
        wht_amount: editValues.whtAmount ? Number(editValues.whtAmount) : updatedOcrRaw.amounts?.wht_amount,
      };
      updatedOcrRaw.customer = {
        ...updatedOcrRaw.customer,
        name: editValues.customerName || updatedOcrRaw.customer?.name || null,
        address: editValues.customerAddress || updatedOcrRaw.customer?.address || null,
        branch_id: editValues.customerBranchId || updatedOcrRaw.customer?.branch_id || null,
      };
      updatedOcrRaw.accounting = {
        ...updatedOcrRaw.accounting,
        vat_mode: editValues.vatMode || updatedOcrRaw.accounting?.vat_mode,
        expense_type: editValues.expenseCategory || updatedOcrRaw.accounting?.expense_type,
        notes: editValues.notes || updatedOcrRaw.accounting?.notes || null,
      };

      const res = await fetch(`/api/documents/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({
          tenantId,
          issuerName: editValues.issuerName || null,
          issuerTaxId: editValues.issuerTaxId || null,
          documentNumber: editValues.documentNumber || null,
          documentDate: editValues.documentDate || null,
          subtotal: editValues.subtotal ? Number(editValues.subtotal) : null,
          vatAmount: editValues.vatAmount ? Number(editValues.vatAmount) : null,
          grandTotal: editValues.grandTotal ? Number(editValues.grandTotal) : null,
          whtAmount: editValues.whtAmount ? Number(editValues.whtAmount) : null,
          direction: editValues.direction || null,
          journalType: editValues.journalType || null,
          docType: editValues.docType || null,
          ocrRaw: updatedOcrRaw,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMsg({ text: "Changes saved successfully", type: "success" });
      setEditing(false);
      onUpdate();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/documents/${detail.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMsg({ text: "Submitted for approval", type: "success" });
      onUpdate();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Submit failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const canEdit = ["ACTION_REQUIRED", "DRAFT", "QUERY", "REJECTED"].includes(detail.status);
  const inMakerQueue = ["ACTION_REQUIRED", "DRAFT", "QUERY", "REJECTED"].includes(detail.status);

  const customerIcon = (
    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
  const transactionIcon = (
    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
  const lineItemsIcon = (
    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
  const additionalIcon = (
    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );

  const vatModeLabel: Record<string, string> = {
    NORMAL_VAT: "Yes",
    VAT_EXEMPT: "No (Exempt)",
    ZERO_RATED: "No (Zero-rated)",
  };

  const vatModeOptions = [
    { value: "NORMAL_VAT", label: "Yes" },
    { value: "VAT_EXEMPT", label: "No (Exempt)" },
    { value: "ZERO_RATED", label: "No (Zero-rated)" },
  ];

  const docTypeOptions = [
    { value: "RECEIPT", label: "Receipt" },
    { value: "INVOICE", label: "Invoice" },
    { value: "PO", label: "Purchase Order" },
    { value: "CREDIT_NOTE", label: "Credit Note" },
    { value: "DEBIT_NOTE", label: "Debit Note" },
    { value: "OTHER", label: "Other" },
  ];

  const directionOptions = [
    { value: "REVENUE", label: "Revenue" },
    { value: "EXPENSE", label: "Expense" },
  ];

  const journalTypeOptions = [
    { value: "RV", label: "RV - Revenue Voucher" },
    { value: "SV", label: "SV - Sales Voucher" },
    { value: "PV", label: "PV - Payment Voucher" },
    { value: "PurV", label: "PurV - Purchase Voucher" },
    { value: "JV", label: "JV - Journal Voucher" },
  ];

  const lineItems = ocr.line_items || [];

  return (
    <div className="grid h-full min-h-0 gap-5 overflow-hidden" style={{ gridTemplateColumns: "1fr 2fr" }}>
      {/* Left: Image */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 flex flex-shrink-0 items-center gap-2 text-sm font-semibold text-slate-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Receipt Image
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {detail.fileUrl ? (
            <img src={detail.fileUrl} alt="Receipt" className="w-full rounded-lg border object-contain" />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
              No image available
            </div>
          )}
        </div>
      </div>

      {/* Right: Extraction fields */}
      <div className="min-w-0 space-y-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-700">
              AI Extraction Results
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                ({countFields(detail, ocr)} Fields)
              </span>
            </h2>
          </div>
          <ConfidenceBadge score={confidence} />
        </div>

        {/* Sections */}
        <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white">
          {/* Issuer / Seller Information */}
          <CollapsibleSection icon={customerIcon} title="Issuer / Seller Information" fieldRange="Fields 1-5">
            <FieldRow index={1} label="ชื่อผู้ออก / Issuer Name" value={detail.issuerName || ocr.issuer?.name} confidence={perField.issuer_name} editing={editing} editKey="issuerName" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={2} label="ที่อยู่ผู้ออก / Issuer Address" value={ocr.issuer?.address} editing={editing} editKey="address" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={3} label="รหัสไปรษณีย์ / Postal Code" value={ocr.issuer?.postal_code} editing={editing} editKey="postalCode" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={4} label="เลขประจำตัวผู้เสียภาษี / Tax ID" value={detail.issuerTaxId || ocr.issuer?.tax_id} confidence={perField.issuer_tax_id} editing={editing} editKey="issuerTaxId" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={5} label="สำนักงาน/สาขาเลขที่ / Branch ID" value={ocr.issuer?.branch_id || ocr.issuer?.branch} editing={editing} editKey="branchId" editValues={editValues} onEditChange={onEditChange} />
          </CollapsibleSection>

          {/* Customer / Buyer Information */}
          <CollapsibleSection
            icon={
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            }
            title="Customer / Buyer Information"
            fieldRange="Fields 15-17"
            defaultOpen={!!(ocr.customer?.name || ocr.customer?.address)}
          >
            <FieldRow index={15} label="ชื่อลูกค้า / Customer Name" value={ocr.customer?.name} editing={editing} editKey="customerName" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={16} label="ที่อยู่ลูกค้า / Customer Address" value={ocr.customer?.address} editing={editing} editKey="customerAddress" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={17} label="สาขาลูกค้า / Customer Branch" value={ocr.customer?.branch_id} editing={editing} editKey="customerBranchId" editValues={editValues} onEditChange={onEditChange} />
          </CollapsibleSection>

          {/* Transaction Details */}
          <CollapsibleSection icon={transactionIcon} title="Transaction Details" fieldRange="Fields 6-10">
            <FieldRow index={6} label="วันที่ / Transaction Date" value={editing ? (detail.documentDate || ocr.document?.issue_date) : formatDate(detail.documentDate || ocr.document?.issue_date)} confidence={perField.invoice_date} editing={editing} editKey="documentDate" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={7} label="เครดิต / Credit Days" value={ocr.document?.credit_days ?? ocr.credit_days} editing={editing} editKey="creditDays" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={8} label="วันที่ครบกำหนดเครดิต / Credit Due Date" value={editing ? (ocr.document?.due_date || "") : formatDate(ocr.document?.due_date)} editing={editing} editKey="dueDate" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={9} label="สกุลเงิน / Currency" value={currency} editing={editing} editKey="currency" editValues={editValues} onEditChange={onEditChange} />
            <FieldRow index={10} label="เลขที่อ้างอิง / Reference ID" value={detail.documentNumber || ocr.document?.invoice_number} confidence={perField.invoice_number} editing={editing} editKey="documentNumber" editValues={editValues} onEditChange={onEditChange} />
          </CollapsibleSection>

          {/* Line Items & Pricing */}
          <CollapsibleSection icon={lineItemsIcon} title="Line Items & Pricing" fieldRange="Fields 11-14">
            <FieldRow
              index={11}
              label="ภาษีมูลค่าเพิ่ม / Is VAT Included?"
              value={vatModeLabel[ocr.accounting?.vat_mode] || (detail.vatAmount && Number(detail.vatAmount) > 0 ? "Yes" : "No")}
              editing={editing} editKey="vatMode" editValues={editValues} onEditChange={onEditChange}
              options={vatModeOptions}
            />
            <FieldRow
              index={12}
              label="รายละเอียด / Transaction Detail"
              value={ocr.document?.document_type || detail.docType}
              confidence={perField.document_type}
              editing={editing} editKey="docType" editValues={editValues} onEditChange={onEditChange}
              options={docTypeOptions}
            />
            <FieldRow
              index={13}
              label="หมวดหมู่ / Expense Category"
              value={ocr.accounting?.expense_type?.replace(/_/g, " ") || null}
              editing={editing} editKey="expenseCategory" editValues={editValues} onEditChange={onEditChange}
            />

            {/* Product List Table - Field 14 */}
            <div className="py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs text-slate-400">14.</span>
                <span className="text-xs font-medium text-slate-600">รายการสินค้า / Product List</span>
                {lineItems.length > 0 && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                    {lineItems.length} items
                  </span>
                )}
              </div>
              <div className="ml-5">
                <LineItemsTable items={lineItems} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Additional Information */}
          <CollapsibleSection icon={additionalIcon} title="Additional Information" fieldRange="Fields 18-23" defaultOpen={false}>
            <FieldRow index={18} label="ประเภทเอกสาร / Document Type" value={detail.docType || ocr.document?.document_type} editing={editing} editKey="docType" editValues={editValues} onEditChange={onEditChange} options={docTypeOptions} />
            <FieldRow index={19} label="ประเภท / Direction" value={detail.direction} editing={editing} editKey="direction" editValues={editValues} onEditChange={onEditChange} options={directionOptions} />
            <FieldRow index={20} label="ประเภทบันทึก / Journal Type" value={detail.journalType} editing={editing} editKey="journalType" editValues={editValues} onEditChange={onEditChange} options={journalTypeOptions} />
            <FieldRow
              index={21}
              label="OCR Processing Tier"
              value={ocr.processing?.ocr_tier_used ? `Tier ${ocr.processing.ocr_tier_used}${ocr.processing.early_terminated ? " (Early terminated)" : ""}` : null}
            />
            <FieldRow
              index={22}
              label="ต้องตรวจสอบ / Requires Manual Review"
              value={ocr.accounting?.requires_manual_review === true ? "Yes" : ocr.accounting?.requires_manual_review === false ? "No" : null}
            />
            <FieldRow
              index={23}
              label="หมายเหตุ / Notes"
              value={ocr.accounting?.notes}
              editing={editing} editKey="notes" editValues={editValues} onEditChange={onEditChange}
            />
          </CollapsibleSection>

          {/* Raw OCR JSON Log */}
          <CollapsibleSection
            icon={
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            }
            title="Raw OCR JSON"
            fieldRange={ocr.meta?.provider === "google_vision" ? "Google Vision" : ocr.ocr_version || "Provider"}
            defaultOpen={false}
          >
            <div className="relative">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(ocr, null, 2));
                }}
                className="absolute right-2 top-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                Copy
              </button>
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-emerald-400 scrollbar-thin">
                {JSON.stringify(ocr, null, 2)}
              </pre>
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer: Total & review note */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Fields with ⚠ icons require manual review
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-800">
              {editing
                ? formatCurrency(editValues.grandTotal, editValues.currency || currency) || `${currency === "THB" ? "฿" : currency}0.00`
                : formatCurrency(detail.grandTotal || ocr.amounts?.total_amount, currency) || `${currency === "THB" ? "฿" : currency}0.00`}
            </p>
            <p className="text-xs text-slate-500">Total Amount</p>
          </div>
        </div>

        {/* Amount breakdown - editable */}
        <div className="mt-2 grid grid-cols-4 gap-2">
          {editing ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-slate-400">Subtotal</p>
                <input
                  type="number"
                  step="0.01"
                  value={editValues.subtotal ?? ""}
                  onChange={(e) => onEditChange("subtotal", e.target.value)}
                  className="mt-1 w-full rounded border border-blue-300 px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-slate-400">VAT</p>
                <input
                  type="number"
                  step="0.01"
                  value={editValues.vatAmount ?? ""}
                  onChange={(e) => onEditChange("vatAmount", e.target.value)}
                  className="mt-1 w-full rounded border border-blue-300 px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-slate-400">WHT</p>
                <input
                  type="number"
                  step="0.01"
                  value={editValues.whtAmount ?? ""}
                  onChange={(e) => onEditChange("whtAmount", e.target.value)}
                  className="mt-1 w-full rounded border border-blue-300 px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-xs text-slate-400">Grand Total</p>
                <input
                  type="number"
                  step="0.01"
                  value={editValues.grandTotal ?? ""}
                  onChange={(e) => onEditChange("grandTotal", e.target.value)}
                  className="mt-1 w-full rounded border border-blue-300 px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <p className="text-xs text-slate-400">Subtotal</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {formatCurrency(detail.subtotal || ocr.amounts?.net_amount_ex_vat, currency) || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <p className="text-xs text-slate-400">VAT</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {formatCurrency(detail.vatAmount || ocr.amounts?.vat_amount, currency) || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <p className="text-xs text-slate-400">WHT</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {formatCurrency(detail.whtAmount, currency) || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <p className="text-xs text-slate-400">Grand Total</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {formatCurrency(detail.grandTotal || ocr.amounts?.total_amount, currency) || "-"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status:</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              detail.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
              detail.status === "PENDING_APPROVAL" ? "bg-yellow-100 text-yellow-700" :
              detail.status === "ACTION_REQUIRED" ? "bg-orange-100 text-orange-700" :
              detail.status === "REJECTED" ? "bg-red-100 text-red-700" :
              detail.status === "EXPORTED" ? "bg-purple-100 text-purple-700" :
              "bg-slate-100 text-slate-600"
            }`}>
              {detail.status.replace(/_/g, " ")}
            </span>
          </div>
          {detail.status === "PENDING_APPROVAL" && (
            <span className="text-[10px] text-yellow-600">Waiting for checker approval</span>
          )}
          {detail.status === "APPROVED" && (
            <span className="text-[10px] text-emerald-600">Document approved</span>
          )}
        </div>

        {/* Action message */}
        {msg && (
          <div className={`mt-2 rounded-lg px-4 py-2 text-xs font-medium ${
            msg.type === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-700"
          }`}>
            {msg.text}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 space-y-2">
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={cancelEditing}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={startEditing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  Edit Data
                </button>
              )}
              {canSubmitForApproval && inMakerQueue && (
                <button
                  onClick={submitForApproval}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </button>
              )}
              {!canSubmitForApproval && inMakerQueue && (
                <p className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
                  Checker role: use <span className="font-medium">Approvals</span> after a maker submits this document.
                </p>
              )}
            </div>
          )}

          <Link
            href="/documents"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ← Back to Documents
          </Link>
        </div>
      </div>
    </div>
  );
}

function countFields(detail: DocDetail, ocr: any): number {
  let count = 0;
  const vals = [
    // Issuer (1-5)
    detail.issuerName || ocr.issuer?.name,
    ocr.issuer?.address,
    ocr.issuer?.postal_code,
    detail.issuerTaxId || ocr.issuer?.tax_id,
    ocr.issuer?.branch_id || ocr.issuer?.branch,
    // Transaction (6-10)
    detail.documentDate || ocr.document?.issue_date,
    ocr.document?.credit_days,
    ocr.document?.due_date,
    detail.currency || ocr.amounts?.currency,
    detail.documentNumber || ocr.document?.invoice_number,
    // Line Items & Pricing (11-13)
    ocr.accounting?.vat_mode || detail.vatAmount,
    ocr.document?.document_type || detail.docType,
    ocr.accounting?.expense_type,
    // Customer (15-17)
    ocr.customer?.name,
    ocr.customer?.address,
    ocr.customer?.branch_id,
    // Additional (18-23)
    detail.docType || ocr.document?.document_type,
    detail.direction,
    detail.journalType,
    ocr.processing?.ocr_tier_used,
    ocr.accounting?.requires_manual_review,
    ocr.accounting?.notes,
  ];
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== "") count++;
  }
  const lineItems = ocr.line_items || [];
  count += lineItems.length;
  return count;
}

function ExtractionsContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(docId);
  const [workspaceLabel, setWorkspaceLabel] = useState("");
  const [canSubmitForApproval, setCanSubmitForApproval] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    setWorkspaceLabel(tenantId.slice(0, 8));
    fetch(`/api/auth/workspace-role?tenantId=${tenantId}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data) {
          setCanSubmitForApproval(Boolean(json.data.canSubmitForApproval));
        }
      })
      .catch(() => {});
    fetch(`/api/documents?tenantId=${tenantId}`, {
      credentials: "same-origin",
      headers: { "x-tenant-id": tenantId },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDocs(json.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const tenantId = getWorkspaceTenantId();
    fetch(`/api/documents/${selectedId}`, {
      headers: { "x-tenant-id": tenantId },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDetail(json.data);
      });
  }, [selectedId]);

  const scrollCarousel = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  };

  return (
    <section className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">AI Extractions</h1>
          <p className="text-sm text-slate-500">{docs.length} receipts</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Workspace: {workspaceLabel}...
          </span>
          {detail && (
            <Link
              href={`/export?docId=${detail.id}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ↓ Detailed Export
            </Link>
          )}
        </div>
      </div>

      {/* Document carousel with arrows */}
      <div className="relative mt-4 flex-shrink-0">
        <button
          onClick={() => scrollCarousel("left")}
          className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div
          ref={carouselRef}
          className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin"
        >
          {docs.map((doc) => {
            const rawS = doc.confidenceScore ? Number(doc.confidenceScore) : 0;
            const score = rawS > 1 ? rawS / 100 : rawS;
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={`flex-shrink-0 rounded-lg border p-3 text-left text-xs transition-all ${
                  selectedId === doc.id
                    ? "border-blue-400 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
                style={{ minWidth: 180, maxWidth: 220 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-700">
                    {doc.issuerName || "Unknown Vendor"}
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${confidenceBadgeClass(score)}`}>
                    {formatConfidence(score)}
                  </span>
                </div>
                <p className="mt-1 font-medium text-slate-600">
                  {doc.grandTotal ? formatCurrency(doc.grandTotal) : "-"}
                </p>
                <p className="text-slate-400">{doc.documentDate || "-"}</p>
              </button>
            );
          })}
          {loading && <p className="px-3 py-4 text-xs text-slate-400">Loading...</p>}
        </div>

        <button
          onClick={() => scrollCarousel("right")}
          className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Detail view */}
      <div className="mt-4 min-h-0 flex-1">
        {detail ? (
          <ExtractionDetail
            detail={detail}
            tenantId={getWorkspaceTenantId()}
            canSubmitForApproval={canSubmitForApproval}
            onUpdate={() => {
              const tid = getWorkspaceTenantId();
              fetch(`/api/documents/${selectedId}`, { headers: { "x-tenant-id": tid } })
                .then((r) => r.json())
                .then((json) => { if (json.success) setDetail(json.data); });
              fetch(`/api/documents?tenantId=${tid}`, { headers: { "x-tenant-id": tid } })
                .then((r) => r.json())
                .then((json) => { if (json.success) setDocs(json.data || []); });
            }}
          />
        ) : (
          !loading && (
            <div className="py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="mt-3 text-sm text-slate-400">Select a document above to view extraction details</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}

export default function ExtractionsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading...</div>}>
      <ExtractionsContent />
    </Suspense>
  );
}

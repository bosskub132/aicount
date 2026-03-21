/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartOfAccounts, products, vendors } from "@/lib/db/schema";

const numberOrZero = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getLineItemsText = (ocrRaw: Record<string, unknown> | null | undefined) => {
  const lineItems =
    (ocrRaw as any)?.line_items_pricing?.line_items || (ocrRaw as any)?.line_items || [];
  if (!Array.isArray(lineItems)) return "";
  return lineItems
    .map((line) => (typeof line === "string" ? line : (line as any)?.description || (line as any)?.name || ""))
    .join(" ")
    .toLowerCase();
};

const toEntries = ({
  journalType,
  accountCode,
  amount,
  vat,
  whtAmount = 0,
  description,
  deptCode = "",
}: {
  journalType: string;
  accountCode: string;
  amount: number;
  vat: number;
  whtAmount?: number;
  description: string;
  deptCode?: string;
}) => {
  const total = numberOrZero(amount);
  const vatAmount = Math.max(0, numberOrZero(vat));
  const wht = Math.max(0, numberOrZero(whtAmount));
  const principalAmount = Math.max(0, total - vatAmount);
  const expenseCode = accountCode || "9999-99";
  const cashCode = "1000-00";
  const payableCode = "2000-00";
  const receivableCode = "1100-00";
  const salesCode = accountCode || "4000-00";
  const outputVatCode = "2140-00";
  const inputVatCode = "2130-00";
  const whtPayableCode = "2135-00";
  /** Default advance / petty cash (เคลียร์ทดรอง) — map in tenant COA; adjust if your Express chart differs. */
  const advancePettyCode = "1200-00";

  if (journalType === "RV") {
    return [
      { accountCode: cashCode, deptCode, debit: total, credit: 0, description: `${description} cash receipt` },
      { accountCode: salesCode, deptCode, debit: 0, credit: principalAmount || total, description: `${description} revenue` },
      ...(vatAmount > 0
        ? [{ accountCode: outputVatCode, deptCode, debit: 0, credit: vatAmount, description: "Output VAT" }]
        : []),
    ];
  }

  if (journalType === "SV") {
    return [
      { accountCode: receivableCode, deptCode, debit: total, credit: 0, description: `${description} receivable` },
      { accountCode: salesCode, deptCode, debit: 0, credit: principalAmount || total, description: `${description} revenue` },
      ...(vatAmount > 0
        ? [{ accountCode: outputVatCode, deptCode, debit: 0, credit: vatAmount, description: "Output VAT" }]
        : []),
    ];
  }

  // PurV: Dr. Expense, Dr. Input VAT | Cr. Payable, Cr. WHT Payable
  if (journalType === "PurV") {
    return [
      { accountCode: expenseCode, deptCode, debit: principalAmount || total, credit: 0, description: `${description} expense` },
      ...(vatAmount > 0
        ? [{ accountCode: inputVatCode, deptCode, debit: vatAmount, credit: 0, description: "Input VAT" }]
        : []),
      { accountCode: payableCode, deptCode, debit: 0, credit: total - wht, description: `${description} payable` },
      ...(wht > 0
        ? [{ accountCode: whtPayableCode, deptCode, debit: 0, credit: wht, description: "WHT payable (หัก ณ ที่จ่าย)" }]
        : []),
    ];
  }

  // JV: petty cash / advance clearing — Dr. Expense, Dr. Input VAT | Cr. Advance/Petty, Cr. WHT Payable
  if (journalType === "JV") {
    return [
      { accountCode: expenseCode, deptCode, debit: principalAmount || total, credit: 0, description: `${description} expense` },
      ...(vatAmount > 0
        ? [{ accountCode: inputVatCode, deptCode, debit: vatAmount, credit: 0, description: "Input VAT" }]
        : []),
      {
        accountCode: advancePettyCode,
        deptCode,
        debit: 0,
        credit: total - wht,
        description: `${description} advance/petty clearing`,
      },
      ...(wht > 0
        ? [{ accountCode: whtPayableCode, deptCode, debit: 0, credit: wht, description: "WHT payable (หัก ณ ที่จ่าย)" }]
        : []),
    ];
  }

  // PV (default): Dr. Expense, Dr. Input VAT | Cr. Cash, Cr. WHT Payable
  return [
    { accountCode: expenseCode, deptCode, debit: principalAmount || total, credit: 0, description: `${description} expense` },
    ...(vatAmount > 0
      ? [{ accountCode: inputVatCode, deptCode, debit: vatAmount, credit: 0, description: "Input VAT" }]
      : []),
    { accountCode: cashCode, deptCode, debit: 0, credit: total - wht, description: `${description} payment` },
    ...(wht > 0
      ? [{ accountCode: whtPayableCode, deptCode, debit: 0, credit: wht, description: "WHT payable (หัก ณ ที่จ่าย)" }]
      : []),
  ];
};

async function resolveAccountCode({
  tenantId,
  issuerTaxId,
  ocrRaw,
  direction,
}: {
  tenantId: string;
  issuerTaxId?: string | null;
  ocrRaw?: Record<string, unknown> | null;
  direction: "REVENUE" | "EXPENSE";
}) {
  if (direction === "EXPENSE" && issuerTaxId) {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.tenantId, tenantId), eq(vendors.taxId, String(issuerTaxId).replace(/\D/g, ""))))
      .limit(1);
    if (vendor?.defaultExpenseGl) {
      return { accountCode: vendor.defaultExpenseGl, source: "vendor" as const, vendorId: vendor.id };
    }
  }

  const text = getLineItemsText(ocrRaw);
  if (text) {
    const allProducts = await db
      .select({ keywords: products.keywords, incomeGl: products.incomeGl, expenseGl: products.expenseGl })
      .from(products)
      .where(eq(products.tenantId, tenantId));

    for (const product of allProducts) {
      const keywords = Array.isArray(product.keywords) ? product.keywords : [];
      if (keywords.some((keyword) => text.includes(String(keyword || "").toLowerCase()))) {
        const accountCode = direction === "REVENUE" ? product.incomeGl : product.expenseGl;
        if (accountCode) {
          return { accountCode, source: "product" as const, vendorId: null };
        }
      }
    }
  }

  const [suspense] = await db
    .select({ accountCode: chartOfAccounts.accountCode })
    .from(chartOfAccounts)
    .where(and(eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isSuspense, true)))
    .limit(1);

  if (suspense?.accountCode) {
    return { accountCode: suspense.accountCode, source: "suspense" as const, vendorId: null };
  }

  return { accountCode: "9999-99", source: "fallback-suspense" as const, vendorId: null };
}

export async function buildAutoJournalEntries({
  tenantId,
  journalType,
  direction,
  ocrRaw,
  amount,
  vatAmount,
  whtAmount,
  issuerTaxId,
  deptCode,
}: {
  tenantId: string;
  journalType: string | null;
  direction: "REVENUE" | "EXPENSE";
  ocrRaw?: Record<string, unknown> | null;
  amount: number | string | null;
  vatAmount: number | string | null;
  whtAmount?: number | string | null;
  issuerTaxId?: string | null;
  deptCode?: string;
}) {
  if (!journalType) {
    return { entries: [], requiresManualReview: true, mappingSource: "none", vendorId: null };
  }

  const mapping = await resolveAccountCode({ tenantId, issuerTaxId, ocrRaw, direction });
  const description =
    (ocrRaw as any)?.issuer?.name || (ocrRaw as any)?.customer?.name || "Auto-mapped transaction";

  const entries = toEntries({
    journalType,
    accountCode: mapping.accountCode,
    amount: numberOrZero(amount),
    vat: numberOrZero(vatAmount),
    whtAmount: numberOrZero(whtAmount),
    description,
    deptCode: deptCode || "",
  });

  return {
    entries,
    requiresManualReview: mapping.source.includes("suspense"),
    mappingSource: mapping.source,
    vendorId: mapping.vendorId,
  };
}

export function canPostBalanced(
  entries: Array<{ debit: number; credit: number }>,
  tolerance = 0.05
) {
  const debit = entries.reduce((sum, item) => sum + Number(item.debit || 0), 0);
  const credit = entries.reduce((sum, item) => sum + Number(item.credit || 0), 0);
  return Math.abs(Number(debit.toFixed(2)) - Number(credit.toFixed(2))) <= tolerance;
}


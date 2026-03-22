import {
  and,
  eq,
  gte,
  lte,
  sql,
  isNull,
} from "drizzle-orm";
import { documents, vendors, payments } from "@/lib/db/schema";
import {
  computeAgingBucket,
  type AgingBuckets,
  type AgingBucketKey,
} from "@/lib/services/aging";
import { computePaymentStatus, type PaymentStatus } from "@/lib/services/payment-status";

// ── Types ───────────────────────────────────────────────────────────────────

type Db = typeof import("@/lib/db").db;

export interface PayablesFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: PaymentStatus;
  page?: number;
  pageSize?: number;
}

export interface PayableInvoiceRow {
  id: string;
  documentNumber: string | null;
  documentDate: string | null;
  dueDate: string | null;
  grandTotal: number;
  paidAmount: number;
  remaining: number;
  paymentStatus: PaymentStatus;
  agingBucket: AgingBucketKey;
}

export interface VendorAging {
  vendor: {
    id: string;
    name: string;
    taxId: string;
    defaultWhtRate: string | null;
  };
  buckets: AgingBuckets;
  total: number;
  invoices: PayableInvoiceRow[];
}

export interface PayablesAgingResult {
  vendors: VendorAging[];
  totals: AgingBuckets;
  page: number;
  pageSize: number;
  totalVendors: number;
}

export interface PayablesStats {
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
  paidThisMonth: number;
  avgPaymentDays: number;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getPayablesAging(
  db: Db,
  tenantId: string,
  filters: PayablesFilters = {},
): Promise<PayablesAgingResult> {
  const { dateFrom, dateTo, search, status, page = 1, pageSize = 20 } = filters;
  const today = new Date();

  // Build conditions for AP documents (direction = EXPENSE)
  const docConditions = [
    eq(documents.tenantId, tenantId),
    eq(documents.direction, "EXPENSE"),
    isNull(documents.deletedAt),
  ];

  if (dateFrom) {
    docConditions.push(gte(documents.documentDate, dateFrom));
  }
  if (dateTo) {
    docConditions.push(lte(documents.documentDate, dateTo));
  }

  // Fetch all AP documents with payment sums
  const rawDocs = await db
    .select({
      docId: documents.id,
      documentNumber: documents.documentNumber,
      documentDate: documents.documentDate,
      dueDate: documents.dueDate,
      grandTotal: documents.grandTotal,
      issuerTaxId: documents.issuerTaxId,
      issuerName: documents.issuerName,
      paidAmount: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(documents)
    .leftJoin(
      payments,
      and(
        eq(payments.documentId, documents.id),
        eq(payments.tenantId, tenantId),
      ),
    )
    .where(and(...docConditions))
    .groupBy(
      documents.id,
      documents.documentNumber,
      documents.documentDate,
      documents.dueDate,
      documents.grandTotal,
      documents.issuerTaxId,
      documents.issuerName,
    );

  // Fetch all vendors for this tenant to match by taxId
  const allVendors = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      taxId: vendors.taxId,
      defaultWhtRate: vendors.defaultWhtRate,
    })
    .from(vendors)
    .where(eq(vendors.tenantId, tenantId));

  const vendorByTaxId = new Map(allVendors.map((v) => [v.taxId, v]));

  // Group documents by vendor
  const vendorMap = new Map<string, VendorAging>();

  for (const doc of rawDocs) {
    const grandTotal = Number(doc.grandTotal ?? 0);
    const paidAmount = Number(doc.paidAmount);
    const remaining = grandTotal - paidAmount;

    // Skip fully paid invoices unless specifically filtering for "paid"
    if (remaining <= 0 && status !== "paid") continue;

    const paymentStatus = computePaymentStatus(
      grandTotal,
      paidAmount,
      doc.dueDate,
      today,
    );

    // Apply status filter
    if (status && paymentStatus !== status) continue;

    const agingBucket = doc.dueDate
      ? computeAgingBucket(doc.dueDate, today)
      : "current" as AgingBucketKey;

    const invoice: PayableInvoiceRow = {
      id: doc.docId,
      documentNumber: doc.documentNumber,
      documentDate: doc.documentDate,
      dueDate: doc.dueDate,
      grandTotal,
      paidAmount,
      remaining,
      paymentStatus,
      agingBucket,
    };

    // Match vendor by issuerTaxId
    const vendor = doc.issuerTaxId
      ? vendorByTaxId.get(doc.issuerTaxId)
      : null;

    const vendorKey = vendor?.id ?? `unknown-${doc.issuerTaxId ?? "none"}`;
    const vendorInfo = vendor ?? {
      id: vendorKey,
      name: doc.issuerName ?? "Unknown Vendor",
      taxId: doc.issuerTaxId ?? "",
      defaultWhtRate: null,
    };

    // Apply search filter on vendor name
    if (search) {
      const searchLower = search.toLowerCase();
      const nameMatch = vendorInfo.name.toLowerCase().includes(searchLower);
      const taxIdMatch = vendorInfo.taxId.toLowerCase().includes(searchLower);
      if (!nameMatch && !taxIdMatch) continue;
    }

    if (!vendorMap.has(vendorKey)) {
      vendorMap.set(vendorKey, {
        vendor: vendorInfo,
        buckets: { current: 0, d30: 0, d60: 0, d90: 0, overdue: 0, total: 0 },
        total: 0,
        invoices: [],
      });
    }

    const entry = vendorMap.get(vendorKey)!;
    entry.invoices.push(invoice);
    entry.buckets[agingBucket] += remaining;
    entry.buckets.total += remaining;
    entry.total += remaining;
  }

  // Compute grand totals
  const allEntries = Array.from(vendorMap.values());
  const totals: AgingBuckets = { current: 0, d30: 0, d60: 0, d90: 0, overdue: 0, total: 0 };
  for (const entry of allEntries) {
    totals.current += entry.buckets.current;
    totals.d30 += entry.buckets.d30;
    totals.d60 += entry.buckets.d60;
    totals.d90 += entry.buckets.d90;
    totals.overdue += entry.buckets.overdue;
    totals.total += entry.buckets.total;
  }

  // Paginate vendors
  const totalVendors = allEntries.length;
  const offset = (page - 1) * pageSize;
  const paginatedVendors = allEntries.slice(offset, offset + pageSize);

  return {
    vendors: paginatedVendors,
    totals,
    page,
    pageSize,
    totalVendors,
  };
}

export async function getPayablesStats(
  db: Db,
  tenantId: string,
): Promise<PayablesStats> {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);

  // Start of current month
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  // Total outstanding: sum of (grandTotal - paid) for all AP docs
  const outstandingRows = await db
    .select({
      docId: documents.id,
      grandTotal: documents.grandTotal,
      dueDate: documents.dueDate,
      paidAmount: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(documents)
    .leftJoin(
      payments,
      and(
        eq(payments.documentId, documents.id),
        eq(payments.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.direction, "EXPENSE"),
        isNull(documents.deletedAt),
      ),
    )
    .groupBy(documents.id, documents.grandTotal, documents.dueDate);

  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let totalPaymentDays = 0;
  let paidDocCount = 0;

  for (const row of outstandingRows) {
    const grandTotal = Number(row.grandTotal ?? 0);
    const paidAmount = Number(row.paidAmount);
    const remaining = grandTotal - paidAmount;

    if (remaining > 0) {
      totalOutstanding += remaining;

      // Check if overdue
      if (row.dueDate) {
        const due = new Date(row.dueDate);
        if (due < today) {
          overdueCount++;
          overdueAmount += remaining;
        }
      }
    }

    // Compute avg payment days for paid invoices
    if (paidAmount >= grandTotal && row.dueDate) {
      const dueDate = new Date(row.dueDate);
      const diffDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      totalPaymentDays += Math.max(0, diffDays);
      paidDocCount++;
    }
  }

  // Paid this month
  const [paidResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(documents.direction, "EXPENSE"),
        gte(payments.paymentDate, monthStart),
        lte(payments.paymentDate, todayStr),
      ),
    );

  return {
    totalOutstanding,
    overdueCount,
    overdueAmount,
    paidThisMonth: Number(paidResult?.total ?? 0),
    avgPaymentDays: paidDocCount > 0 ? Math.round(totalPaymentDays / paidDocCount) : 0,
  };
}

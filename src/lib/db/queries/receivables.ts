import {
  and,
  eq,
  gte,
  lte,
  sql,
  isNull,
} from "drizzle-orm";
import { documents, customers, payments } from "@/lib/db/schema";
import {
  computeAgingBucket,
  type AgingBuckets,
  type AgingBucketKey,
} from "@/lib/services/aging";
import { computePaymentStatus, type PaymentStatus } from "@/lib/services/payment-status";

// ── Types ───────────────────────────────────────────────────────────────────

type Db = typeof import("@/lib/db").db;

export interface ReceivablesFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: PaymentStatus;
  page?: number;
  pageSize?: number;
}

export interface InvoiceRow {
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

export interface CustomerAging {
  customer: {
    id: string;
    name: string;
    taxId: string;
  };
  buckets: AgingBuckets;
  total: number;
  invoices: InvoiceRow[];
}

export interface ReceivablesAgingResult {
  customers: CustomerAging[];
  totals: AgingBuckets;
  page: number;
  pageSize: number;
  totalCustomers: number;
}

export interface ReceivablesStats {
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
  collectedThisMonth: number;
  avgCollectionDays: number;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getReceivablesAging(
  db: Db,
  tenantId: string,
  filters: ReceivablesFilters = {},
): Promise<ReceivablesAgingResult> {
  const { dateFrom, dateTo, search, status, page = 1, pageSize = 20 } = filters;
  const today = new Date();

  // Build conditions for AR documents (direction = REVENUE)
  const docConditions = [
    eq(documents.tenantId, tenantId),
    eq(documents.direction, "REVENUE"),
    isNull(documents.deletedAt),
  ];

  if (dateFrom) {
    docConditions.push(gte(documents.documentDate, dateFrom));
  }
  if (dateTo) {
    docConditions.push(lte(documents.documentDate, dateTo));
  }

  // Fetch all AR documents with payment sums
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

  // Fetch all customers for this tenant to match by taxId
  const allCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      taxId: customers.taxId,
    })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  const customerByTaxId = new Map(allCustomers.map((c) => [c.taxId, c]));

  // Group documents by customer
  const customerMap = new Map<string, CustomerAging>();

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

    const invoice: InvoiceRow = {
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

    // Match customer by issuerTaxId
    const customer = doc.issuerTaxId
      ? customerByTaxId.get(doc.issuerTaxId)
      : null;

    const customerKey = customer?.id ?? `unknown-${doc.issuerTaxId ?? "none"}`;
    const customerInfo = customer ?? {
      id: customerKey,
      name: doc.issuerName ?? "Unknown Customer",
      taxId: doc.issuerTaxId ?? "",
    };

    // Apply search filter on customer name
    if (search) {
      const searchLower = search.toLowerCase();
      const nameMatch = customerInfo.name.toLowerCase().includes(searchLower);
      const taxIdMatch = customerInfo.taxId.toLowerCase().includes(searchLower);
      if (!nameMatch && !taxIdMatch) continue;
    }

    if (!customerMap.has(customerKey)) {
      customerMap.set(customerKey, {
        customer: customerInfo,
        buckets: { current: 0, d30: 0, d60: 0, d90: 0, overdue: 0, total: 0 },
        total: 0,
        invoices: [],
      });
    }

    const entry = customerMap.get(customerKey)!;
    entry.invoices.push(invoice);
    entry.buckets[agingBucket] += remaining;
    entry.buckets.total += remaining;
    entry.total += remaining;
  }

  // Compute grand totals
  const allEntries = Array.from(customerMap.values());
  const totals: AgingBuckets = { current: 0, d30: 0, d60: 0, d90: 0, overdue: 0, total: 0 };
  for (const entry of allEntries) {
    totals.current += entry.buckets.current;
    totals.d30 += entry.buckets.d30;
    totals.d60 += entry.buckets.d60;
    totals.d90 += entry.buckets.d90;
    totals.overdue += entry.buckets.overdue;
    totals.total += entry.buckets.total;
  }

  // Paginate customers
  const totalCustomers = allEntries.length;
  const offset = (page - 1) * pageSize;
  const paginatedCustomers = allEntries.slice(offset, offset + pageSize);

  return {
    customers: paginatedCustomers,
    totals,
    page,
    pageSize,
    totalCustomers,
  };
}

export async function getReceivablesStats(
  db: Db,
  tenantId: string,
): Promise<ReceivablesStats> {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);

  // Start of current month
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  // Total outstanding: sum of (grandTotal - paid) for all AR docs
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
        eq(documents.direction, "REVENUE"),
        isNull(documents.deletedAt),
      ),
    )
    .groupBy(documents.id, documents.grandTotal, documents.dueDate);

  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let totalCollectionDays = 0;
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

    // Compute avg collection days for paid invoices
    if (paidAmount >= grandTotal && row.dueDate) {
      const dueDate = new Date(row.dueDate);
      const diffDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      totalCollectionDays += Math.max(0, diffDays);
      paidDocCount++;
    }
  }

  // Collected this month
  const [collectedResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(documents.direction, "REVENUE"),
        gte(payments.paymentDate, monthStart),
        lte(payments.paymentDate, todayStr),
      ),
    );

  return {
    totalOutstanding,
    overdueCount,
    overdueAmount,
    collectedThisMonth: Number(collectedResult?.total ?? 0),
    avgCollectionDays: paidDocCount > 0 ? Math.round(totalCollectionDays / paidDocCount) : 0,
  };
}

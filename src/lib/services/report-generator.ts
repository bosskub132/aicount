import { createClient } from "@supabase/supabase-js";
import { and, between, eq, sql } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/lib/db";
import {
  chartOfAccounts,
  journalEntries,
  journalLines,
  documents,
  tenants,
} from "@/lib/db/schema";
import { resolvePeriodDates } from "@/lib/db/queries/period-utils";
import { getProfitLoss } from "@/lib/db/queries/profit-loss";
import { getBalanceSheet } from "@/lib/db/queries/balance-sheet";
import { getCashFlow } from "@/lib/db/queries/cash-flow";
import { getJournalListing } from "@/lib/db/queries/journal-listing";
import { getAccountLedger } from "@/lib/db/queries/account-ledger";
import { upsertReportDraft } from "@/lib/db/queries/report-history";
import {
  TrialBalancePdf,
  ProfitLossPdf,
  BalanceSheetPdf,
  CashFlowPdf,
  MonthlyComparisonPdf,
  GlDetailPdf,
  JournalListingPdf,
} from "@/lib/services/report-pdf-templates";
import {
  Pp30Pdf,
  Pp36Pdf,
  Pnd3Pdf,
  Pnd53Pdf,
  PurchaseVatRegisterPdf,
  SalesVatRegisterPdf,
} from "@/lib/services/tax-pdf-templates";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GenerateReportInput {
  tenantId: string;
  reportType: string;
  period: string;
  scope: string;
  filters?: Record<string, unknown>;
  generatedBy: string;
}

export interface GenerateReportResult {
  reportId: string;
  pdfUrl: string;
  pdfSizeBytes: number;
}

interface CompanyInfo {
  name: string;
  taxId: string;
}

// ── Supabase Admin Client ──────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Company Info ────────────────────────────────────────────────────────────

async function fetchCompanyInfo(tenantId: string): Promise<CompanyInfo> {
  const [tenant] = await db
    .select({ name: tenants.name, taxId: tenants.taxId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  return { name: tenant.name, taxId: tenant.taxId };
}

// ── Trial Balance Query ─────────────────────────────────────────────────────

async function getTrialBalance(
  tenantId: string,
  startDate: string,
  endDate: string
) {
  const rows = await db
    .select({
      accountCode: journalLines.accountCode,
      accountName: chartOfAccounts.accountName,
      totalDebit: sql<number>`sum(${journalLines.debit})`,
      totalCredit: sql<number>`sum(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .leftJoin(
      chartOfAccounts,
      and(
        eq(chartOfAccounts.tenantId, journalEntries.tenantId),
        eq(chartOfAccounts.accountCode, journalLines.accountCode)
      )
    )
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        between(journalEntries.date, startDate, endDate),
        eq(journalEntries.status, "posted")
      )
    )
    .groupBy(journalLines.accountCode, chartOfAccounts.accountName);

  return rows;
}

// ── Monthly Comparison Query ────────────────────────────────────────────────

async function getMonthlyComparison(tenantId: string, year: number) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const rows = await db
    .select({
      yearMonth: sql<string>`to_char(${documents.documentDate}::date, 'YYYY-MM')`,
      revenueAmount: sql<number>`coalesce(sum(case when ${documents.direction}='REVENUE' then ${documents.grandTotal}::numeric else 0 end),0)`,
      expenseAmount: sql<number>`coalesce(sum(case when ${documents.direction}='EXPENSE' then ${documents.grandTotal}::numeric else 0 end),0)`,
      docCount: sql<number>`count(*)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "APPROVED"),
        between(documents.documentDate, startDate, endDate)
      )
    )
    .groupBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${documents.documentDate}::date, 'YYYY-MM') asc`);

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rowMap = new Map(rows.map((r) => [r.yearMonth, r]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    const ym = `${year}-${m}`;
    const isFuture = ym > currentYearMonth;
    const existing = rowMap.get(ym);
    return {
      yearMonth: ym,
      revenueAmount: isFuture ? null : (existing?.revenueAmount ?? 0),
      expenseAmount: isFuture ? null : (existing?.expenseAmount ?? 0),
      docCount: isFuture ? null : (existing?.docCount ?? 0),
    };
  });

  return { year, from: startDate, to: endDate, rows: months };
}

// ── PDF Rendering ──────────────────────────────────────────────────────────

async function renderReportPdf(
  reportType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  company: CompanyInfo,
  generatedBy: string
): Promise<Buffer> {
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const baseProps = { company, generatedBy, generatedAt };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let element: any;

  switch (reportType) {
    case "trial_balance":
      element = TrialBalancePdf({ ...baseProps, data });
      break;
    case "profit_loss":
      element = ProfitLossPdf({ ...baseProps, data });
      break;
    case "balance_sheet":
      element = BalanceSheetPdf({ ...baseProps, data });
      break;
    case "cash_flow":
      element = CashFlowPdf({ ...baseProps, data });
      break;
    case "monthly_comparison":
      element = MonthlyComparisonPdf({ ...baseProps, data });
      break;
    case "gl_detail":
      element = GlDetailPdf({ ...baseProps, data });
      break;
    case "journal_listing":
      element = JournalListingPdf({ ...baseProps, data });
      break;
    case "pp30":
      element = Pp30Pdf({ ...baseProps, data });
      break;
    case "pp36":
      element = Pp36Pdf({ ...baseProps, data });
      break;
    case "pnd3":
      element = Pnd3Pdf({ ...baseProps, data });
      break;
    case "pnd53":
      element = Pnd53Pdf({ ...baseProps, data });
      break;
    case "purchase_vat_register":
      element = PurchaseVatRegisterPdf({ ...baseProps, data });
      break;
    case "sales_vat_register":
      element = SalesVatRegisterPdf({ ...baseProps, data });
      break;
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

// ── Storage Upload ─────────────────────────────────────────────────────────

const BUCKET_NAME = "report-pdfs";

async function ensureBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("[report-generator] Failed to list buckets:", listError);
    throw new Error("Failed to verify storage bucket");
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
    });
    if (createError) {
      console.error("[report-generator] Failed to create bucket:", createError);
      throw new Error("Failed to create storage bucket");
    }
  }
}

async function uploadPdf(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storagePath: string,
  buffer: Buffer
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("[report-generator] Upload failed:", error);
    throw new Error("Failed to upload PDF to storage");
  }
}

async function getSignedUrl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storagePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.error("[report-generator] Signed URL failed:", error);
    throw new Error("Failed to generate signed URL");
  }

  return data.signedUrl;
}

// ── Data Fetching ──────────────────────────────────────────────────────────

async function fetchReportData(
  tenantId: string,
  reportType: string,
  period: string,
  scope: string,
  startDate: string,
  endDate: string,
  filters?: Record<string, unknown>
) {
  switch (reportType) {
    case "trial_balance": {
      const rows = await getTrialBalance(tenantId, startDate, endDate);
      return {
        period: `${startDate}..${endDate}`,
        scope,
        rows,
      };
    }

    case "profit_loss":
      return await getProfitLoss(tenantId, {
        period,
        scope,
        department: filters?.department as string | undefined,
        comparison: filters?.comparison as string | undefined,
      });

    case "balance_sheet":
      return await getBalanceSheet(tenantId, {
        period,
        scope,
        comparison: filters?.comparison as string | undefined,
      });

    case "cash_flow":
      return await getCashFlow(tenantId, {
        period,
        scope,
        comparison: filters?.comparison as string | undefined,
      });

    case "monthly_comparison": {
      const year = parseInt(period, 10) || new Date().getFullYear();
      return await getMonthlyComparison(tenantId, year);
    }

    case "gl_detail": {
      const accountCode = filters?.account as string;
      if (!accountCode) {
        throw new Error("GL detail report requires 'account' filter");
      }
      const result = await getAccountLedger(db, tenantId, accountCode, startDate, endDate);
      return {
        accountCode,
        period: { start: startDate, end: endDate },
        openingBalance: result.openingBalance,
        closingBalance: result.closingBalance,
        periodDebits: result.periodDebits,
        periodCredits: result.periodCredits,
        transactions: result.transactions,
      };
    }

    case "journal_listing":
      return await getJournalListing(tenantId, {
        period,
        scope,
        type: filters?.type as string | undefined,
        page: 1,
        limit: 10000, // Fetch all entries for PDF
      });

    // Tax reports: data is passed through via filters.taxData
    // These reports require pre-aggregated tax data from the calling API
    case "pp30":
    case "pp36":
    case "pnd3":
    case "pnd53":
    case "purchase_vat_register":
    case "sales_vat_register":
      if (!filters?.taxData) {
        throw new Error(`${reportType} requires pre-aggregated tax data in filters.taxData`);
      }
      return filters.taxData;

    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

// ── Main Generator ─────────────────────────────────────────────────────────

export async function generateReport(
  input: GenerateReportInput
): Promise<GenerateReportResult> {
  const { tenantId, reportType, period, scope, filters, generatedBy } = input;

  // 1. Resolve period dates
  const dates = resolvePeriodDates(period, scope);

  // 2. Fetch report data
  const data = await fetchReportData(
    tenantId,
    reportType,
    period,
    scope,
    dates.start,
    dates.end,
    filters
  );

  // 3. Fetch company info
  const company = await fetchCompanyInfo(tenantId);

  // 4. Render PDF
  const pdfBuffer = await renderReportPdf(reportType, data, company, generatedBy);
  const pdfSizeBytes = pdfBuffer.length;

  // 5. Upload to Supabase Storage
  const supabase = getSupabaseAdmin();
  await ensureBucket(supabase);

  const timestamp = Date.now();
  const storagePath = `${tenantId}/${reportType}/${period}-${timestamp}.pdf`;
  await uploadPdf(supabase, storagePath, pdfBuffer);

  // 6. Upsert report history draft
  const reportRecord = await upsertReportDraft(tenantId, {
    reportType,
    period,
    periodScope: scope,
    dateFrom: dates.start,
    dateTo: dates.end,
    filters: filters ?? null,
    pdfStoragePath: storagePath,
    pdfSizeBytes,
    generatedBy,
  });

  // 7. Generate signed URL
  const pdfUrl = await getSignedUrl(supabase, storagePath);

  return {
    reportId: reportRecord.id,
    pdfUrl,
    pdfSizeBytes,
  };
}

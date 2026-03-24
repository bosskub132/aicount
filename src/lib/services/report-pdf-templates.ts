import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import * as React from "react";

// ── Font Registration ───────────────────────────────────────────────────────

Font.register({
  family: "NotoSansThai",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-400-normal.woff2",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-700-normal.woff2",
      fontWeight: 700,
    },
  ],
});

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "NotoSansThai", fontSize: 10 },
  pageLandscape: { padding: 30, fontFamily: "NotoSansThai", fontSize: 8 },
  header: { marginBottom: 20, textAlign: "center" },
  companyName: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  companyInfo: { fontSize: 8, color: "#64748b" },
  reportTitle: { fontSize: 12, fontWeight: 700, marginTop: 12 },
  periodText: { fontSize: 9, color: "#64748b", marginTop: 2 },
  table: { marginTop: 12 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #f1f5f9",
    paddingVertical: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    backgroundColor: "#f0fdf4",
  },
  subtotalRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 6,
    fontWeight: 700,
  },
  highlightRow: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    paddingVertical: 8,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
  },
  cellLeft: { flex: 3, paddingHorizontal: 8 },
  cellRight: { flex: 1, paddingHorizontal: 8, textAlign: "right" },
  cellCenter: { flex: 1, paddingHorizontal: 8, textAlign: "center" },
  cellCode: { flex: 1, paddingHorizontal: 8 },
  cellName: { flex: 3, paddingHorizontal: 8 },
  cellAmount: { flex: 1.5, paddingHorizontal: 8, textAlign: "right" },
  cellSmall: { flex: 0.8, paddingHorizontal: 4, textAlign: "right", fontSize: 7 },
  amount: { fontVariantNumeric: "tabular-nums" },
  negative: { color: "#dc2626" },
  bold: { fontWeight: 700 },
  indented: { paddingLeft: 24 },
});

// ── Shared Types ────────────────────────────────────────────────────────────

interface CompanyInfo {
  name: string;
  taxId: string;
  address?: string;
}

interface BaseProps {
  company: CompanyInfo;
  generatedBy?: string;
  generatedAt: string;
}

// ── Shared Components ───────────────────────────────────────────────────────

function ReportHeader({
  company,
  title,
  thaiTitle,
  period,
}: {
  company: CompanyInfo;
  title: string;
  thaiTitle: string;
  period: string;
}) {
  return React.createElement(
    View,
    { style: styles.header },
    React.createElement(Text, { style: styles.companyName }, company.name),
    React.createElement(
      Text,
      { style: styles.companyInfo },
      `Tax ID: ${company.taxId}`
    ),
    company.address
      ? React.createElement(Text, { style: styles.companyInfo }, company.address)
      : null,
    React.createElement(Text, { style: styles.reportTitle }, title),
    React.createElement(Text, { style: styles.reportTitle }, thaiTitle),
    React.createElement(
      Text,
      { style: styles.periodText },
      `Period: ${period}`
    )
  );
}

function ReportFooter({
  generatedBy,
  generatedAt,
}: {
  generatedBy?: string;
  generatedAt: string;
}) {
  return React.createElement(
    View,
    { style: styles.footer, fixed: true },
    React.createElement(
      Text,
      null,
      `Generated: ${generatedAt}${generatedBy ? ` by ${generatedBy}` : ""}`
    ),
    React.createElement(Text, {
      render: ({
        pageNumber,
        totalPages,
      }: {
        pageNumber: number;
        totalPages: number;
      }) => `Page ${pageNumber} of ${totalPages}`,
    })
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBaht(value: number): string {
  return `฿${formatAmount(value)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function amountStyle(value: number): any {
  return value < 0
    ? [styles.amount, styles.negative]
    : [styles.amount];
}

// ── 1. Trial Balance ────────────────────────────────────────────────────────

interface TrialBalanceRow {
  accountCode: string;
  accountName: string | null;
  totalDebit: number;
  totalCredit: number;
}

interface TrialBalanceData {
  period: string;
  scope: string;
  rows: TrialBalanceRow[];
}

interface TrialBalancePdfProps extends BaseProps {
  data: TrialBalanceData;
}

export function TrialBalancePdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: TrialBalancePdfProps) {
  const grandDebit = data.rows.reduce((s, r) => s + Number(r.totalDebit), 0);
  const grandCredit = data.rows.reduce((s, r) => s + Number(r.totalCredit), 0);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(ReportHeader, {
        company,
        title: "Trial Balance",
        thaiTitle: "งบทดลอง",
        period: data.period,
      }),
      React.createElement(
        View,
        { style: styles.table },
        // Header row
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.cellCode, styles.bold] }, "Account Code"),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Account Name"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Debit"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Credit")
        ),
        // Data rows
        ...data.rows.map((row, i) =>
          React.createElement(
            View,
            { style: styles.tableRow, key: `tb-${i}` },
            React.createElement(Text, { style: styles.cellCode }, row.accountCode),
            React.createElement(Text, { style: styles.cellName }, row.accountName ?? row.accountCode),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.amount] },
              Number(row.totalDebit) !== 0 ? formatAmount(Number(row.totalDebit)) : "-"
            ),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.amount] },
              Number(row.totalCredit) !== 0 ? formatAmount(Number(row.totalCredit)) : "-"
            )
          )
        ),
        // Grand total
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Grand Total"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold, styles.amount] }, formatAmount(grandDebit)),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold, styles.amount] }, formatAmount(grandCredit))
        )
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

// ── 2. Profit & Loss ────────────────────────────────────────────────────────

interface ProfitLossRow {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface ProfitLossSection {
  category: string;
  label: string;
  rows: ProfitLossRow[];
  total: number;
}

interface ProfitLossData {
  period: { start: string; end: string };
  sections: ProfitLossSection[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

interface ProfitLossPdfProps extends BaseProps {
  data: ProfitLossData;
}

export function ProfitLossPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: ProfitLossPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(ReportHeader, {
        company,
        title: "Profit & Loss Statement",
        thaiTitle: "งบกำไรขาดทุน",
        period: `${data.period.start} to ${data.period.end}`,
      }),
      React.createElement(
        View,
        { style: styles.table },
        // Header row
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.cellCode, styles.bold] }, "Code"),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Account"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Amount (฿)")
        ),
        // Sections
        ...data.sections.flatMap((section, si) => [
          // Section header
          React.createElement(
            View,
            { style: styles.sectionHeader, key: `pl-sh-${si}` },
            React.createElement(Text, { style: [styles.cellLeft, styles.bold] }, section.label)
          ),
          // Section rows
          ...section.rows.map((row, ri) =>
            React.createElement(
              View,
              { style: styles.tableRow, key: `pl-r-${si}-${ri}` },
              React.createElement(Text, { style: styles.cellCode }, row.accountCode),
              React.createElement(Text, { style: styles.cellName }, row.accountName),
              React.createElement(
                Text,
                { style: [styles.cellAmount, amountStyle(row.amount)] },
                section.category === "expense"
                  ? `(${formatAmount(Math.abs(row.amount))})`
                  : formatAmount(row.amount)
              )
            )
          ),
          // Section subtotal
          React.createElement(
            View,
            { style: styles.subtotalRow, key: `pl-st-${si}` },
            React.createElement(Text, { style: styles.cellCode }, ""),
            React.createElement(Text, { style: [styles.cellName, styles.bold] }, `Total ${section.label.split(" · ")[0]}`),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.bold, styles.amount] },
              formatAmount(section.total)
            )
          ),
        ]),
        // Net Profit highlight
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Net Profit · กำไรสุทธิ"),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, amountStyle(data.netProfit)] },
            formatBaht(data.netProfit)
          )
        )
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

// ── 3. Balance Sheet ────────────────────────────────────────────────────────

interface BalanceSheetRow {
  accountCode: string;
  accountName: string;
  balance: number;
}

interface BalanceSheetSection {
  category: string;
  label: string;
  rows: BalanceSheetRow[];
  total: number;
}

interface BalanceSheetData {
  asOfDate: string;
  sections: BalanceSheetSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

interface BalanceSheetPdfProps extends BaseProps {
  data: BalanceSheetData;
}

export function BalanceSheetPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: BalanceSheetPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(ReportHeader, {
        company,
        title: "Balance Sheet",
        thaiTitle: "งบแสดงฐานะการเงิน",
        period: `As of ${data.asOfDate}`,
      }),
      React.createElement(
        View,
        { style: styles.table },
        // Header row
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.cellCode, styles.bold] }, "Code"),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Account"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Balance (฿)")
        ),
        // Sections
        ...data.sections.flatMap((section, si) => [
          React.createElement(
            View,
            { style: styles.sectionHeader, key: `bs-sh-${si}` },
            React.createElement(Text, { style: [styles.cellLeft, styles.bold] }, section.label)
          ),
          ...section.rows.map((row, ri) =>
            React.createElement(
              View,
              { style: styles.tableRow, key: `bs-r-${si}-${ri}` },
              React.createElement(Text, { style: styles.cellCode }, row.accountCode),
              React.createElement(Text, { style: styles.cellName }, row.accountName),
              React.createElement(
                Text,
                { style: [styles.cellAmount, amountStyle(row.balance)] },
                formatAmount(row.balance)
              )
            )
          ),
          React.createElement(
            View,
            { style: styles.subtotalRow, key: `bs-st-${si}` },
            React.createElement(Text, { style: styles.cellCode }, ""),
            React.createElement(Text, { style: [styles.cellName, styles.bold] }, `Total ${section.label.split(" · ")[0]}`),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.bold, styles.amount] },
              formatAmount(section.total)
            )
          ),
        ]),
        // A = L + E check
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(
            Text,
            { style: [styles.cellName, styles.bold] },
            `Liabilities + Equity · หนี้สิน + ส่วนของผู้ถือหุ้น`
          ),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, styles.amount] },
            formatBaht(data.totalLiabilities + data.totalEquity)
          )
        ),
        !data.isBalanced
          ? React.createElement(
              View,
              { style: [styles.tableRow, { backgroundColor: "#fef2f2" }] },
              React.createElement(Text, { style: [styles.cellLeft, styles.negative] }, "⚠ Balance sheet does not balance. Difference: " +
                formatBaht(data.totalAssets - (data.totalLiabilities + data.totalEquity)))
            )
          : null
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

// ── 4. Cash Flow ────────────────────────────────────────────────────────────

interface CashFlowItem {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface CashFlowSection {
  items: CashFlowItem[];
  total: number;
}

interface CashFlowData {
  period: { start: string; end: string };
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
}

interface CashFlowPdfProps extends BaseProps {
  data: CashFlowData;
}

function CashFlowSectionView({
  label,
  section,
  keyPrefix,
}: {
  label: string;
  section: CashFlowSection;
  keyPrefix: string;
}) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      View,
      { style: styles.sectionHeader },
      React.createElement(Text, { style: [styles.cellLeft, styles.bold] }, label)
    ),
    ...section.items.map((item, i) =>
      React.createElement(
        View,
        { style: styles.tableRow, key: `${keyPrefix}-${i}` },
        React.createElement(Text, { style: styles.cellCode }, item.accountCode),
        React.createElement(Text, { style: styles.cellName }, item.accountName),
        React.createElement(
          Text,
          { style: [styles.cellAmount, amountStyle(item.amount)] },
          formatAmount(item.amount)
        )
      )
    ),
    React.createElement(
      View,
      { style: styles.subtotalRow },
      React.createElement(Text, { style: styles.cellCode }, ""),
      React.createElement(Text, { style: [styles.cellName, styles.bold] }, `Net ${label}`),
      React.createElement(
        Text,
        { style: [styles.cellAmount, styles.bold, amountStyle(section.total)] },
        formatAmount(section.total)
      )
    )
  );
}

export function CashFlowPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: CashFlowPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(ReportHeader, {
        company,
        title: "Cash Flow Statement",
        thaiTitle: "งบกระแสเงินสด",
        period: `${data.period.start} to ${data.period.end}`,
      }),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.cellCode, styles.bold] }, "Code"),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Description"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Amount (฿)")
        ),
        React.createElement(CashFlowSectionView, {
          label: "Operating Activities · กิจกรรมดำเนินงาน",
          section: data.operating,
          keyPrefix: "cf-op",
        }),
        React.createElement(CashFlowSectionView, {
          label: "Investing Activities · กิจกรรมลงทุน",
          section: data.investing,
          keyPrefix: "cf-inv",
        }),
        React.createElement(CashFlowSectionView, {
          label: "Financing Activities · กิจกรรมจัดหาเงิน",
          section: data.financing,
          keyPrefix: "cf-fin",
        }),
        // Net Cash Change
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Net Cash Change · เงินสดเพิ่ม(ลด)สุทธิ"),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, amountStyle(data.netCashChange)] },
            formatBaht(data.netCashChange)
          )
        )
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

// ── 5. Monthly Comparison ───────────────────────────────────────────────────

interface MonthlyComparisonRow {
  yearMonth: string;
  revenueAmount: number | null;
  expenseAmount: number | null;
  docCount: number | null;
}

interface MonthlyComparisonData {
  year: number;
  from: string;
  to: string;
  rows: MonthlyComparisonRow[];
}

interface MonthlyComparisonPdfProps extends BaseProps {
  data: MonthlyComparisonData;
}

export function MonthlyComparisonPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: MonthlyComparisonPdfProps) {
  const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const totalRevenue = data.rows.reduce((s, r) => s + (r.revenueAmount ?? 0), 0);
  const totalExpense = data.rows.reduce((s, r) => s + (r.expenseAmount ?? 0), 0);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: styles.pageLandscape },
      React.createElement(ReportHeader, {
        company,
        title: "Monthly Comparison",
        thaiTitle: "เปรียบเทียบรายเดือน",
        period: `Year ${data.year}`,
      }),
      React.createElement(
        View,
        { style: styles.table },
        // Header: Category | Jan..Dec | Total
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [{ flex: 1.5, paddingHorizontal: 4 }, styles.bold] }, "Category"),
          ...monthLabels.map((m, i) =>
            React.createElement(Text, { style: [styles.cellSmall, styles.bold], key: `mh-${i}` }, m)
          ),
          React.createElement(Text, { style: [styles.cellSmall, styles.bold] }, "Total")
        ),
        // Revenue row
        React.createElement(
          View,
          { style: styles.tableRow },
          React.createElement(Text, { style: { flex: 1.5, paddingHorizontal: 4 } }, "Revenue · รายได้"),
          ...data.rows.map((r, i) =>
            React.createElement(
              Text,
              { style: [styles.cellSmall, styles.amount], key: `mr-${i}` },
              r.revenueAmount != null ? formatAmount(r.revenueAmount) : "-"
            )
          ),
          React.createElement(Text, { style: [styles.cellSmall, styles.bold, styles.amount] }, formatAmount(totalRevenue))
        ),
        // Expense row
        React.createElement(
          View,
          { style: styles.tableRow },
          React.createElement(Text, { style: { flex: 1.5, paddingHorizontal: 4 } }, "Expenses · ค่าใช้จ่าย"),
          ...data.rows.map((r, i) =>
            React.createElement(
              Text,
              { style: [styles.cellSmall, styles.amount], key: `me-${i}` },
              r.expenseAmount != null ? formatAmount(r.expenseAmount) : "-"
            )
          ),
          React.createElement(Text, { style: [styles.cellSmall, styles.bold, styles.amount] }, formatAmount(totalExpense))
        ),
        // Net row
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: [{ flex: 1.5, paddingHorizontal: 4 }, styles.bold] }, "Net · สุทธิ"),
          ...data.rows.map((r, i) => {
            const net =
              r.revenueAmount != null && r.expenseAmount != null
                ? r.revenueAmount - r.expenseAmount
                : null;
            return React.createElement(
              Text,
              {
                style: [styles.cellSmall, styles.bold, net != null ? amountStyle(net) : styles.amount],
                key: `mn-${i}`,
              },
              net != null ? formatAmount(net) : "-"
            );
          }),
          React.createElement(
            Text,
            { style: [styles.cellSmall, styles.bold, amountStyle(totalRevenue - totalExpense)] },
            formatAmount(totalRevenue - totalExpense)
          )
        ),
        // Doc count row
        React.createElement(
          View,
          { style: styles.tableRow },
          React.createElement(Text, { style: { flex: 1.5, paddingHorizontal: 4, color: "#64748b" } }, "Documents"),
          ...data.rows.map((r, i) =>
            React.createElement(
              Text,
              { style: [styles.cellSmall, { color: "#64748b" }], key: `md-${i}` },
              r.docCount != null ? String(r.docCount) : "-"
            )
          ),
          React.createElement(
            Text,
            { style: [styles.cellSmall, { color: "#64748b" }] },
            String(data.rows.reduce((s, r) => s + (r.docCount ?? 0), 0))
          )
        )
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

// ── 6. GL Detail (Account Ledger) ───────────────────────────────────────────

interface GlTransaction {
  date: string;
  jvNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface GlDetailData {
  accountCode: string;
  period: { start: string; end: string };
  openingBalance: number;
  closingBalance: number;
  periodDebits: number;
  periodCredits: number;
  transactions: GlTransaction[];
}

interface GlDetailPdfProps extends BaseProps {
  data: GlDetailData;
}

export function GlDetailPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: GlDetailPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(ReportHeader, {
        company,
        title: `General Ledger — ${data.accountCode}`,
        thaiTitle: "บัญชีแยกประเภท",
        period: `${data.period.start} to ${data.period.end}`,
      }),
      React.createElement(
        View,
        { style: styles.table },
        // Opening balance
        React.createElement(
          View,
          { style: styles.subtotalRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Opening Balance · ยอดยกมา"),
          React.createElement(Text, { style: [styles.cellAmount, styles.amount] }, ""),
          React.createElement(Text, { style: [styles.cellAmount, styles.amount] }, ""),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, amountStyle(data.openingBalance)] },
            formatAmount(data.openingBalance)
          )
        ),
        // Table header
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.cellCode, styles.bold] }, "Date"),
          React.createElement(Text, { style: [styles.cellCode, styles.bold] }, "JV No."),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Description"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Debit"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Credit"),
          React.createElement(Text, { style: [styles.cellAmount, styles.bold] }, "Balance")
        ),
        // Transactions
        ...data.transactions.map((tx, i) =>
          React.createElement(
            View,
            { style: styles.tableRow, key: `gl-${i}` },
            React.createElement(Text, { style: styles.cellCode }, tx.date),
            React.createElement(Text, { style: styles.cellCode }, tx.jvNumber),
            React.createElement(Text, { style: styles.cellName }, tx.description),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.amount] },
              tx.debit !== 0 ? formatAmount(tx.debit) : "-"
            ),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.amount] },
              tx.credit !== 0 ? formatAmount(tx.credit) : "-"
            ),
            React.createElement(
              Text,
              { style: [styles.cellAmount, amountStyle(tx.runningBalance)] },
              formatAmount(tx.runningBalance)
            )
          )
        ),
        // Closing balance
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Closing Balance · ยอดคงเหลือ"),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, styles.amount] },
            formatAmount(data.periodDebits)
          ),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, styles.amount] },
            formatAmount(data.periodCredits)
          ),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, amountStyle(data.closingBalance)] },
            formatBaht(data.closingBalance)
          )
        )
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

// ── 7. Journal Listing ──────────────────────────────────────────────────────

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  jvNo: string;
  date: string;
  description: string;
  type: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
}

interface JournalListingData {
  period: { start: string; end: string };
  entries: JournalEntry[];
  summary: {
    totalEntries: number;
    totalDebit: number;
    totalCredit: number;
  };
}

interface JournalListingPdfProps extends BaseProps {
  data: JournalListingData;
}

export function JournalListingPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: JournalListingPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(ReportHeader, {
        company,
        title: "Journal Listing",
        thaiTitle: "รายการบันทึกบัญชี",
        period: `${data.period.start} to ${data.period.end}`,
      }),
      React.createElement(
        View,
        { style: styles.table },
        // Entries
        ...data.entries.flatMap((entry, ei) => [
          // Entry header
          React.createElement(
            View,
            { style: styles.sectionHeader, key: `jl-h-${ei}` },
            React.createElement(Text, { style: [styles.cellCode, styles.bold] }, entry.jvNo),
            React.createElement(Text, { style: [styles.cellCode, styles.bold] }, entry.date),
            React.createElement(Text, { style: [styles.cellName, styles.bold] }, entry.description),
            React.createElement(
              Text,
              { style: [styles.cellCenter, { fontSize: 8, color: "#64748b" }] },
              entry.type
            )
          ),
          // Entry lines (indented)
          ...entry.lines.map((line, li) =>
            React.createElement(
              View,
              { style: [styles.tableRow, styles.indented], key: `jl-l-${ei}-${li}` },
              React.createElement(Text, { style: styles.cellCode }, line.accountCode),
              React.createElement(Text, { style: styles.cellName }, line.accountName),
              React.createElement(
                Text,
                { style: [styles.cellAmount, styles.amount] },
                line.debit !== 0 ? formatAmount(line.debit) : ""
              ),
              React.createElement(
                Text,
                { style: [styles.cellAmount, styles.amount] },
                line.credit !== 0 ? formatAmount(line.credit) : ""
              )
            )
          ),
          // Entry total
          React.createElement(
            View,
            { style: [styles.subtotalRow, { marginBottom: 4 }], key: `jl-t-${ei}` },
            React.createElement(Text, { style: styles.cellCode }, ""),
            React.createElement(Text, { style: [styles.cellName, styles.bold] }, "Entry Total"),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.bold, styles.amount] },
              formatAmount(entry.totalDebit)
            ),
            React.createElement(
              Text,
              { style: [styles.cellAmount, styles.bold, styles.amount] },
              formatAmount(entry.totalCredit)
            )
          ),
        ]),
        // Grand summary
        React.createElement(
          View,
          { style: styles.highlightRow },
          React.createElement(Text, { style: styles.cellCode }, ""),
          React.createElement(
            Text,
            { style: [styles.cellName, styles.bold] },
            `Grand Total (${data.summary.totalEntries} entries)`
          ),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, styles.amount] },
            formatBaht(data.summary.totalDebit)
          ),
          React.createElement(
            Text,
            { style: [styles.cellAmount, styles.bold, styles.amount] },
            formatBaht(data.summary.totalCredit)
          )
        )
      ),
      React.createElement(ReportFooter, { generatedBy, generatedAt })
    )
  );
}

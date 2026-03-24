import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import * as React from "react";

// ── Font Registration (idempotent) ──────────────────────────────────────────

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

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "NotoSansThai", fontSize: 9 },
  pageLandscape: { padding: 30, fontFamily: "NotoSansThai", fontSize: 8 },

  // Header
  header: { marginBottom: 16, textAlign: "center" },
  companyName: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  companyInfo: { fontSize: 8, color: "#64748b" },
  reportTitle: { fontSize: 12, fontWeight: 700, marginTop: 10 },
  reportSubtitle: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  periodText: { fontSize: 9, color: "#64748b", marginTop: 2 },

  // Table
  table: { marginTop: 10 },
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
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 6,
    fontWeight: 700,
    borderTop: "1px solid #e2e8f0",
  },
  highlightRow: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    paddingVertical: 8,
    fontWeight: 700,
  },

  // Form layout (for PP30)
  formRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #e2e8f0",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  formLabel: { flex: 3, fontSize: 9 },
  formValue: { flex: 1.5, textAlign: "right", fontSize: 9 },
  formValueWide: { flex: 2, textAlign: "right", fontSize: 9 },

  // Cells
  cellSeq: { width: 30, paddingHorizontal: 4, textAlign: "center" },
  cellName: { flex: 2.5, paddingHorizontal: 4 },
  cellTaxId: { flex: 1.5, paddingHorizontal: 4 },
  cellBranch: { width: 40, paddingHorizontal: 4, textAlign: "center" },
  cellDate: { width: 60, paddingHorizontal: 4 },
  cellType: { flex: 1, paddingHorizontal: 4 },
  cellAmount: { flex: 1, paddingHorizontal: 4, textAlign: "right" },
  cellRate: { width: 40, paddingHorizontal: 4, textAlign: "right" },
  cellCountry: { flex: 1, paddingHorizontal: 4 },
  cellDesc: { flex: 1.5, paddingHorizontal: 4 },
  cellDocNo: { flex: 1.5, paddingHorizontal: 4 },
  cellSeller: { flex: 2, paddingHorizontal: 4 },

  // Typography
  bold: { fontWeight: 700 },
  amount: { fontVariantNumeric: "tabular-nums" },
  negative: { color: "#dc2626" },
  small: { fontSize: 7, color: "#64748b" },

  // Footer
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

  // Signature
  signatureArea: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  signatureBlock: {
    width: 180,
    textAlign: "center",
  },
  signatureLine: {
    borderTop: "1px solid #000",
    marginTop: 40,
    paddingTop: 4,
    fontSize: 8,
  },
});

// ── Shared Types ────────────────────────────────────────────────────────────

interface CompanyInfo {
  name: string;
  taxId: string;
  address?: string;
  branchNumber?: string;
}

interface BaseProps {
  company: CompanyInfo;
  generatedBy?: string;
  generatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTaxId(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13) return raw;
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function amountStyle(value: number): any {
  return value < 0 ? [s.amount, s.negative] : [s.amount];
}

// ── Shared Components ───────────────────────────────────────────────────────

function TaxReportHeader({
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
    { style: s.header },
    React.createElement(Text, { style: s.companyName }, company.name),
    React.createElement(
      Text,
      { style: s.companyInfo },
      `Tax ID: ${formatTaxId(company.taxId)}${company.branchNumber ? `  Branch: ${company.branchNumber}` : ""}`
    ),
    company.address
      ? React.createElement(Text, { style: s.companyInfo }, company.address)
      : null,
    React.createElement(Text, { style: s.reportTitle }, thaiTitle),
    React.createElement(Text, { style: s.reportSubtitle }, title),
    React.createElement(Text, { style: s.periodText }, `Period: ${period}`)
  );
}

function TaxReportFooter({
  generatedBy,
  generatedAt,
}: {
  generatedBy?: string;
  generatedAt: string;
}) {
  return React.createElement(
    View,
    { style: s.footer, fixed: true },
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

function SignatureArea() {
  return React.createElement(
    View,
    { style: s.signatureArea },
    React.createElement(
      View,
      { style: s.signatureBlock },
      React.createElement(Text, { style: s.signatureLine }, "Prepared by / ผู้จัดทำ"),
      React.createElement(Text, { style: s.small }, "Date / วันที่ ___/___/___")
    ),
    React.createElement(
      View,
      { style: s.signatureBlock },
      React.createElement(Text, { style: s.signatureLine }, "Authorized by / ผู้มีอำนาจลงนาม"),
      React.createElement(Text, { style: s.small }, "Date / วันที่ ___/___/___")
    )
  );
}

// ── 1. PP30 — ภ.พ.30 VAT Return ────────────────────────────────────────────

interface Pp30Data {
  period: string;
  filingMonth: string;
  outputVat: { taxBase: number; vatAmount: number };
  inputVat: { taxBase: number; vatAmount: number };
  netVat: number;
  excessCreditPriorPeriod: number;
  vatPayableOrRefundable: number;
}

interface Pp30PdfProps extends BaseProps {
  data: Pp30Data;
}

export function Pp30Pdf({ data, company, generatedBy, generatedAt }: Pp30PdfProps) {
  const formRow = (
    label: string,
    taxBase: string | null,
    vatAmount: string
  ) =>
    React.createElement(
      View,
      { style: s.formRow },
      React.createElement(Text, { style: s.formLabel }, label),
      taxBase !== null
        ? React.createElement(Text, { style: [s.formValue, s.amount] }, taxBase)
        : React.createElement(Text, { style: s.formValue }, ""),
      React.createElement(Text, { style: [s.formValue, s.amount] }, vatAmount)
    );

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: s.page },
      TaxReportHeader({
        company,
        title: "VAT Return",
        thaiTitle: "แบบ ภ.พ.30",
        period: data.period,
      }),
      // Column header
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "Description / รายการ"),
        React.createElement(Text, { style: [s.formValue, s.bold] }, "Tax Base / มูลค่าฐานภาษี"),
        React.createElement(Text, { style: [s.formValue, s.bold] }, "VAT Amount / จำนวนภาษี")
      ),
      // Row 1: Output VAT
      formRow(
        "1. Output VAT / ภาษีขาย",
        formatAmount(data.outputVat.taxBase),
        formatAmount(data.outputVat.vatAmount)
      ),
      // Row 2: Input VAT
      formRow(
        "2. Input VAT / ภาษีซื้อ",
        formatAmount(data.inputVat.taxBase),
        formatAmount(data.inputVat.vatAmount)
      ),
      // Row 3: Net VAT
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#f0fdf4" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "3. Net VAT / ภาษีที่ต้องชำระ(ชำระเกิน)"),
        React.createElement(Text, { style: s.formValue }, ""),
        React.createElement(
          Text,
          { style: [s.formValue, s.bold, amountStyle(data.netVat)] },
          formatAmount(data.netVat)
        )
      ),
      // Row 4: Excess credit
      formRow(
        "4. Excess credit from prior period / เครดิตภาษียกมา",
        null,
        formatAmount(data.excessCreditPriorPeriod)
      ),
      // Row 5: VAT payable/refundable
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#eff6ff" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "5. VAT Payable(Refundable) / ภาษีที่ต้องชำระ(ขอคืน)"),
        React.createElement(Text, { style: s.formValue }, ""),
        React.createElement(
          Text,
          { style: [s.formValue, s.bold, amountStyle(data.vatPayableOrRefundable)] },
          formatAmount(data.vatPayableOrRefundable)
        )
      ),
      // Filing month info
      React.createElement(
        View,
        { style: { marginTop: 16 } },
        React.createElement(
          Text,
          { style: { fontSize: 9, color: "#475569" } },
          `Filing Month / เดือนภาษี: ${data.filingMonth}`
        ),
        React.createElement(
          Text,
          { style: { fontSize: 9, color: "#475569", marginTop: 2 } },
          `Company / บริษัท: ${company.name}`
        ),
        React.createElement(
          Text,
          { style: { fontSize: 9, color: "#475569", marginTop: 2 } },
          `Tax ID / เลขประจำตัวผู้เสียภาษี: ${formatTaxId(company.taxId)}`
        )
      ),
      SignatureArea(),
      TaxReportFooter({ generatedBy, generatedAt })
    )
  );
}

// ── 2. PP36 — ภ.พ.36 Non-Resident Services ─────────────────────────────────

interface Pp36Line {
  vendor: string;
  country: string;
  description: string;
  amount: number;
  vatAmount: number;
}

interface Pp36Data {
  period: string;
  lines: Pp36Line[];
  totalAmount: number;
  totalVat: number;
}

interface Pp36PdfProps extends BaseProps {
  data: Pp36Data;
}

export function Pp36Pdf({ data, company, generatedBy, generatedAt }: Pp36PdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: s.page },
      TaxReportHeader({
        company,
        title: "Non-Resident Services VAT",
        thaiTitle: "แบบ ภ.พ.36",
        period: data.period,
      }),
      React.createElement(
        View,
        { style: s.table },
        // Header
        React.createElement(
          View,
          { style: s.tableHeader },
          React.createElement(Text, { style: [s.cellSeq, s.bold] }, "#"),
          React.createElement(Text, { style: [s.cellName, s.bold] }, "Vendor / ผู้ขาย"),
          React.createElement(Text, { style: [s.cellCountry, s.bold] }, "Country / ประเทศ"),
          React.createElement(Text, { style: [s.cellDesc, s.bold] }, "Description / รายละเอียด"),
          React.createElement(Text, { style: [s.cellAmount, s.bold] }, "Amount / จำนวนเงิน"),
          React.createElement(Text, { style: [s.cellAmount, s.bold] }, "VAT / ภาษีมูลค่าเพิ่ม")
        ),
        // Data rows
        ...data.lines.map((line, i) =>
          React.createElement(
            View,
            { style: s.tableRow, key: `pp36-${i}` },
            React.createElement(Text, { style: s.cellSeq }, String(i + 1)),
            React.createElement(Text, { style: s.cellName }, line.vendor),
            React.createElement(Text, { style: s.cellCountry }, line.country),
            React.createElement(Text, { style: s.cellDesc }, line.description),
            React.createElement(Text, { style: [s.cellAmount, s.amount] }, formatAmount(line.amount)),
            React.createElement(Text, { style: [s.cellAmount, s.amount] }, formatAmount(line.vatAmount))
          )
        ),
        // Totals
        React.createElement(
          View,
          { style: s.totalRow },
          React.createElement(Text, { style: s.cellSeq }, ""),
          React.createElement(Text, { style: s.cellName }, ""),
          React.createElement(Text, { style: s.cellCountry }, ""),
          React.createElement(Text, { style: [s.cellDesc, s.bold] }, "Total / รวม"),
          React.createElement(Text, { style: [s.cellAmount, s.bold, s.amount] }, formatAmount(data.totalAmount)),
          React.createElement(Text, { style: [s.cellAmount, s.bold, s.amount] }, formatAmount(data.totalVat))
        )
      ),
      SignatureArea(),
      TaxReportFooter({ generatedBy, generatedAt })
    )
  );
}

// ── 3. PND3 — ภ.ง.ด.3 Individual WHT ──────────────────────────────────────

interface PndPayee {
  name: string;
  taxId: string;
  branch: string;
  date: string;
  incomeType: string;
  amount: number;
  whtRate: number;
  whtAmount: number;
}

interface Pnd3Data {
  period: string;
  filingMonth: string;
  payees: PndPayee[];
  totalAmount: number;
  totalWht: number;
  payeeCount: number;
}

interface Pnd3PdfProps extends BaseProps {
  data: Pnd3Data;
}

function PndAttachmentTable({
  payees,
  totalAmount,
  totalWht,
  payeeCount,
  keyPrefix,
}: {
  payees: PndPayee[];
  totalAmount: number;
  totalWht: number;
  payeeCount: number;
  keyPrefix: string;
}) {
  return React.createElement(
    View,
    { style: s.table },
    // Header
    React.createElement(
      View,
      { style: s.tableHeader },
      React.createElement(Text, { style: [s.cellSeq, s.bold] }, "ลำดับ"),
      React.createElement(Text, { style: [s.cellName, s.bold] }, "ชื่อผู้รับเงิน"),
      React.createElement(Text, { style: [s.cellTaxId, s.bold] }, "เลขประจำตัวผู้เสียภาษี"),
      React.createElement(Text, { style: [s.cellBranch, s.bold] }, "สาขา"),
      React.createElement(Text, { style: [s.cellDate, s.bold] }, "วัน/เดือน/ปี"),
      React.createElement(Text, { style: [s.cellType, s.bold] }, "ประเภทเงินได้"),
      React.createElement(Text, { style: [s.cellAmount, s.bold] }, "จำนวนเงิน"),
      React.createElement(Text, { style: [s.cellRate, s.bold] }, "อัตรา%"),
      React.createElement(Text, { style: [s.cellAmount, s.bold] }, "ภาษีที่หัก")
    ),
    // Data rows
    ...payees.map((p, i) =>
      React.createElement(
        View,
        { style: s.tableRow, key: `${keyPrefix}-${i}` },
        React.createElement(Text, { style: s.cellSeq }, String(i + 1)),
        React.createElement(Text, { style: s.cellName }, p.name),
        React.createElement(Text, { style: s.cellTaxId }, formatTaxId(p.taxId)),
        React.createElement(Text, { style: s.cellBranch }, p.branch),
        React.createElement(Text, { style: s.cellDate }, p.date),
        React.createElement(Text, { style: s.cellType }, p.incomeType),
        React.createElement(Text, { style: [s.cellAmount, s.amount] }, formatAmount(p.amount)),
        React.createElement(Text, { style: [s.cellRate, s.amount] }, p.whtRate.toFixed(1)),
        React.createElement(Text, { style: [s.cellAmount, s.amount] }, formatAmount(p.whtAmount))
      )
    ),
    // Totals
    React.createElement(
      View,
      { style: s.totalRow },
      React.createElement(Text, { style: s.cellSeq }, ""),
      React.createElement(Text, { style: [s.cellName, s.bold] }, `Total (${payeeCount} payees)`),
      React.createElement(Text, { style: s.cellTaxId }, ""),
      React.createElement(Text, { style: s.cellBranch }, ""),
      React.createElement(Text, { style: s.cellDate }, ""),
      React.createElement(Text, { style: s.cellType }, ""),
      React.createElement(Text, { style: [s.cellAmount, s.bold, s.amount] }, formatAmount(totalAmount)),
      React.createElement(Text, { style: s.cellRate }, ""),
      React.createElement(Text, { style: [s.cellAmount, s.bold, s.amount] }, formatAmount(totalWht))
    )
  );
}

export function Pnd3Pdf({ data, company, generatedBy, generatedAt }: Pnd3PdfProps) {
  return React.createElement(
    Document,
    null,
    // Page 1: Main form summary
    React.createElement(
      Page,
      { size: "A4", style: s.page },
      TaxReportHeader({
        company,
        title: "Individual WHT Return",
        thaiTitle: "แบบ ภ.ง.ด.3",
        period: data.period,
      }),
      // Company info section
      React.createElement(
        View,
        { style: { marginBottom: 16 } },
        React.createElement(
          View,
          { style: s.formRow },
          React.createElement(Text, { style: s.formLabel }, "Company / บริษัท:"),
          React.createElement(Text, { style: s.formValueWide }, company.name)
        ),
        React.createElement(
          View,
          { style: s.formRow },
          React.createElement(Text, { style: s.formLabel }, "Tax ID / เลขประจำตัวผู้เสียภาษี:"),
          React.createElement(Text, { style: s.formValueWide }, formatTaxId(company.taxId))
        ),
        company.branchNumber
          ? React.createElement(
              View,
              { style: s.formRow },
              React.createElement(Text, { style: s.formLabel }, "Branch / สาขา:"),
              React.createElement(Text, { style: s.formValueWide }, company.branchNumber)
            )
          : null,
        React.createElement(
          View,
          { style: s.formRow },
          React.createElement(Text, { style: s.formLabel }, "Filing Month / เดือนภาษี:"),
          React.createElement(Text, { style: s.formValueWide }, data.filingMonth)
        )
      ),
      // Summary
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#eff6ff" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "Total Income Paid / รวมเงินได้ที่จ่าย"),
        React.createElement(Text, { style: [s.formValueWide, s.bold, s.amount] }, formatAmount(data.totalAmount))
      ),
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#eff6ff" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "Total WHT / รวมภาษีที่หักและนำส่ง"),
        React.createElement(Text, { style: [s.formValueWide, s.bold, s.amount] }, formatAmount(data.totalWht))
      ),
      React.createElement(
        View,
        { style: s.formRow },
        React.createElement(Text, { style: s.formLabel }, "Number of Payees / จำนวนราย"),
        React.createElement(Text, { style: s.formValueWide }, String(data.payeeCount))
      ),
      SignatureArea(),
      TaxReportFooter({ generatedBy, generatedAt })
    ),
    // Page 2+: Attachment schedule
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: s.pageLandscape },
      React.createElement(
        View,
        { style: s.header },
        React.createElement(Text, { style: s.reportTitle }, "ใบแนบ ภ.ง.ด.3"),
        React.createElement(Text, { style: s.reportSubtitle }, "Attachment Schedule — PND3"),
        React.createElement(Text, { style: s.periodText }, `Period: ${data.period}`)
      ),
      PndAttachmentTable({
        payees: data.payees,
        totalAmount: data.totalAmount,
        totalWht: data.totalWht,
        payeeCount: data.payeeCount,
        keyPrefix: "pnd3",
      }),
      TaxReportFooter({ generatedBy, generatedAt })
    )
  );
}

// ── 4. PND53 — ภ.ง.ด.53 Corporate WHT ─────────────────────────────────────

interface Pnd53Data {
  period: string;
  filingMonth: string;
  payees: PndPayee[];
  totalAmount: number;
  totalWht: number;
  payeeCount: number;
}

interface Pnd53PdfProps extends BaseProps {
  data: Pnd53Data;
}

export function Pnd53Pdf({ data, company, generatedBy, generatedAt }: Pnd53PdfProps) {
  return React.createElement(
    Document,
    null,
    // Page 1: Main form summary
    React.createElement(
      Page,
      { size: "A4", style: s.page },
      TaxReportHeader({
        company,
        title: "Corporate WHT Return",
        thaiTitle: "แบบ ภ.ง.ด.53",
        period: data.period,
      }),
      // Company info section
      React.createElement(
        View,
        { style: { marginBottom: 16 } },
        React.createElement(
          View,
          { style: s.formRow },
          React.createElement(Text, { style: s.formLabel }, "Company / บริษัท:"),
          React.createElement(Text, { style: s.formValueWide }, company.name)
        ),
        React.createElement(
          View,
          { style: s.formRow },
          React.createElement(Text, { style: s.formLabel }, "Tax ID / เลขประจำตัวผู้เสียภาษี:"),
          React.createElement(Text, { style: s.formValueWide }, formatTaxId(company.taxId))
        ),
        company.branchNumber
          ? React.createElement(
              View,
              { style: s.formRow },
              React.createElement(Text, { style: s.formLabel }, "Branch / สาขา:"),
              React.createElement(Text, { style: s.formValueWide }, company.branchNumber)
            )
          : null,
        React.createElement(
          View,
          { style: s.formRow },
          React.createElement(Text, { style: s.formLabel }, "Filing Month / เดือนภาษี:"),
          React.createElement(Text, { style: s.formValueWide }, data.filingMonth)
        )
      ),
      // Summary
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#eff6ff" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "Total Income Paid / รวมเงินได้ที่จ่าย"),
        React.createElement(Text, { style: [s.formValueWide, s.bold, s.amount] }, formatAmount(data.totalAmount))
      ),
      React.createElement(
        View,
        { style: [s.formRow, { backgroundColor: "#eff6ff" }] },
        React.createElement(Text, { style: [s.formLabel, s.bold] }, "Total WHT / รวมภาษีที่หักและนำส่ง"),
        React.createElement(Text, { style: [s.formValueWide, s.bold, s.amount] }, formatAmount(data.totalWht))
      ),
      React.createElement(
        View,
        { style: s.formRow },
        React.createElement(Text, { style: s.formLabel }, "Number of Payees / จำนวนราย"),
        React.createElement(Text, { style: s.formValueWide }, String(data.payeeCount))
      ),
      SignatureArea(),
      TaxReportFooter({ generatedBy, generatedAt })
    ),
    // Page 2+: Attachment schedule
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: s.pageLandscape },
      React.createElement(
        View,
        { style: s.header },
        React.createElement(Text, { style: s.reportTitle }, "ใบแนบ ภ.ง.ด.53"),
        React.createElement(Text, { style: s.reportSubtitle }, "Attachment Schedule — PND53"),
        React.createElement(Text, { style: s.periodText }, `Period: ${data.period}`)
      ),
      PndAttachmentTable({
        payees: data.payees,
        totalAmount: data.totalAmount,
        totalWht: data.totalWht,
        payeeCount: data.payeeCount,
        keyPrefix: "pnd53",
      }),
      TaxReportFooter({ generatedBy, generatedAt })
    )
  );
}

// ── 5. Purchase VAT Register — รายงานภาษีซื้อ ──────────────────────────────

interface VatRegisterLine {
  date: string;
  invoiceNo: string;
  name: string;
  taxId: string;
  branch: string;
  taxBase: number;
  vatAmount: number;
}

interface VatRegisterData {
  period: string;
  lines: VatRegisterLine[];
  grandTotalTaxBase: number;
  grandTotalVat: number;
}

interface PurchaseVatRegisterPdfProps extends BaseProps {
  data: VatRegisterData;
}

function VatRegisterTable({
  lines,
  grandTotalTaxBase,
  grandTotalVat,
  nameHeader,
  keyPrefix,
}: {
  lines: VatRegisterLine[];
  grandTotalTaxBase: number;
  grandTotalVat: number;
  nameHeader: string;
  keyPrefix: string;
}) {
  return React.createElement(
    View,
    { style: s.table },
    // Header
    React.createElement(
      View,
      { style: s.tableHeader },
      React.createElement(Text, { style: [s.cellSeq, s.bold] }, "ลำดับที่"),
      React.createElement(Text, { style: [s.cellDate, s.bold] }, "วันเดือนปี"),
      React.createElement(Text, { style: [s.cellDocNo, s.bold] }, "เลขที่ใบกำกับภาษี"),
      React.createElement(Text, { style: [s.cellSeller, s.bold] }, nameHeader),
      React.createElement(Text, { style: [s.cellTaxId, s.bold] }, "เลขประจำตัวผู้เสียภาษี"),
      React.createElement(Text, { style: [s.cellBranch, s.bold] }, "สาขา"),
      React.createElement(Text, { style: [s.cellAmount, s.bold] }, "มูลค่าสินค้า/บริการ"),
      React.createElement(Text, { style: [s.cellAmount, s.bold] }, "จำนวนเงินภาษี")
    ),
    // Data rows
    ...lines.map((line, i) =>
      React.createElement(
        View,
        { style: s.tableRow, key: `${keyPrefix}-${i}` },
        React.createElement(Text, { style: s.cellSeq }, String(i + 1)),
        React.createElement(Text, { style: s.cellDate }, line.date),
        React.createElement(Text, { style: s.cellDocNo }, line.invoiceNo),
        React.createElement(Text, { style: s.cellSeller }, line.name),
        React.createElement(Text, { style: s.cellTaxId }, formatTaxId(line.taxId)),
        React.createElement(Text, { style: s.cellBranch }, line.branch),
        React.createElement(Text, { style: [s.cellAmount, s.amount] }, formatAmount(line.taxBase)),
        React.createElement(Text, { style: [s.cellAmount, s.amount] }, formatAmount(line.vatAmount))
      )
    ),
    // Grand total
    React.createElement(
      View,
      { style: s.highlightRow },
      React.createElement(Text, { style: s.cellSeq }, ""),
      React.createElement(Text, { style: s.cellDate }, ""),
      React.createElement(Text, { style: s.cellDocNo }, ""),
      React.createElement(Text, { style: [s.cellSeller, s.bold] }, "รวมทั้งสิ้น"),
      React.createElement(Text, { style: s.cellTaxId }, ""),
      React.createElement(Text, { style: s.cellBranch }, ""),
      React.createElement(Text, { style: [s.cellAmount, s.bold, s.amount] }, formatAmount(grandTotalTaxBase)),
      React.createElement(Text, { style: [s.cellAmount, s.bold, s.amount] }, formatAmount(grandTotalVat))
    )
  );
}

export function PurchaseVatRegisterPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: PurchaseVatRegisterPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: s.pageLandscape },
      TaxReportHeader({
        company,
        title: "Purchase VAT Register",
        thaiTitle: "รายงานภาษีซื้อ",
        period: data.period,
      }),
      VatRegisterTable({
        lines: data.lines,
        grandTotalTaxBase: data.grandTotalTaxBase,
        grandTotalVat: data.grandTotalVat,
        nameHeader: "ชื่อผู้ขาย",
        keyPrefix: "pvat",
      }),
      TaxReportFooter({ generatedBy, generatedAt })
    )
  );
}

// ── 6. Sales VAT Register — รายงานภาษีขาย ──────────────────────────────────

interface SalesVatRegisterPdfProps extends BaseProps {
  data: VatRegisterData;
}

export function SalesVatRegisterPdf({
  data,
  company,
  generatedBy,
  generatedAt,
}: SalesVatRegisterPdfProps) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: s.pageLandscape },
      TaxReportHeader({
        company,
        title: "Sales VAT Register",
        thaiTitle: "รายงานภาษีขาย",
        period: data.period,
      }),
      VatRegisterTable({
        lines: data.lines,
        grandTotalTaxBase: data.grandTotalTaxBase,
        grandTotalVat: data.grandTotalVat,
        nameHeader: "ชื่อผู้ซื้อ",
        keyPrefix: "svat",
      }),
      TaxReportFooter({ generatedBy, generatedAt })
    )
  );
}

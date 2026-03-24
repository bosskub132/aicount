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

// ── Types ───────────────────────────────────────────────────────────────────

export interface WhtCertificateData {
  certificateNo: string;
  formType: "pnd3" | "pnd53";
  payerName: string;
  payerTaxId: string;
  payerBranch: string;
  payerAddress?: string;
  payeeName: string;
  payeeTaxId: string;
  payeeBranch: string;
  payeeAddress?: string;
  incomeType: string;
  incomeSection: string;
  paymentDate: string;
  amountPaid: number;
  whtRate: number;
  whtAmount: number;
  issuedAt: string;
  isVoided?: boolean;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "NotoSansThai",
    fontSize: 9,
    position: "relative",
  },

  // Title
  titleArea: { textAlign: "center", marginBottom: 10 },
  titleMain: { fontSize: 13, fontWeight: 700 },
  titleSub: { fontSize: 10, marginTop: 2 },
  certNo: { fontSize: 8, textAlign: "right", marginBottom: 6 },

  // Checkbox row
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  checkboxLabel: { fontSize: 9, marginRight: 16 },

  // Bordered sections (payer / payee)
  sectionBox: {
    border: "1px solid #000",
    padding: 8,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4 },
  infoRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  infoLabel: { width: 120, fontSize: 9 },
  infoValue: { flex: 1, fontSize: 9 },

  // Tax ID display
  taxIdRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  taxIdBox: {
    width: 14,
    height: 14,
    border: "0.5px solid #000",
    textAlign: "center",
    fontSize: 8,
    lineHeight: 1.6,
    marginRight: 1,
  },
  taxIdDash: { fontSize: 9, marginHorizontal: 2 },

  // Income type checkboxes
  incomeSection: {
    border: "1px solid #000",
    padding: 8,
    marginBottom: 8,
  },
  incomeSectionTitle: { fontSize: 9, fontWeight: 700, marginBottom: 6 },
  incomeGrid: { flexDirection: "row", flexWrap: "wrap" },
  incomeItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 3,
  },
  checkbox: {
    width: 11,
    height: 11,
    border: "0.5px solid #000",
    marginRight: 4,
    textAlign: "center",
    fontSize: 8,
    lineHeight: 1.4,
  },
  checkboxText: { fontSize: 8, flex: 1 },

  // Payment detail table
  table: { marginBottom: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderTop: "1px solid #000",
    borderBottom: "1px solid #000",
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #ccc",
    paddingVertical: 4,
  },
  totalRow: {
    flexDirection: "row",
    borderTop: "1px solid #000",
    borderBottom: "1px solid #000",
    paddingVertical: 4,
    fontWeight: 700,
  },
  cellDate: { width: 70, paddingHorizontal: 4, textAlign: "center" },
  cellDesc: { flex: 2, paddingHorizontal: 4 },
  cellAmount: { flex: 1, paddingHorizontal: 4, textAlign: "right" },
  cellWht: { flex: 1, paddingHorizontal: 4, textAlign: "right" },

  // Typography
  bold: { fontWeight: 700 },
  amount: { fontVariantNumeric: "tabular-nums" },
  small: { fontSize: 7, color: "#64748b" },

  // Filing reference
  filingRef: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  filingText: { fontSize: 9 },

  // Signature area
  signatureArea: {
    marginTop: 24,
    alignItems: "flex-end",
  },
  signatureBlock: {
    width: 200,
    textAlign: "center",
  },
  signatureLine: {
    borderTop: "1px solid #000",
    marginTop: 36,
    paddingTop: 4,
    fontSize: 8,
  },
  signatureDate: { fontSize: 8, marginTop: 4 },
  stampNote: { fontSize: 7, color: "#64748b", marginTop: 4 },

  // Voided watermark
  voidedWatermark: {
    position: "absolute",
    top: "35%",
    left: "15%",
    fontSize: 60,
    color: "#dc2626",
    opacity: 0.18,
    transform: "rotate(-45deg)",
    fontWeight: 700,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#94a3b8",
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTaxId(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13) return raw;
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Income type options ─────────────────────────────────────────────────────

const PND3_INCOME_TYPES = [
  { key: "40(1)", label: "40(1) เงินเดือน ค่าจ้าง บำนาญ" },
  { key: "40(2)", label: "40(2) ค่านายหน้า" },
  { key: "40(3)", label: "40(3) ค่าแห่งลิขสิทธิ์ ค่าแห่งกู๊ดวิลล์" },
  { key: "40(4)a", label: "40(4)(ก) ดอกเบี้ย" },
  { key: "40(4)b", label: "40(4)(ข) เงินปันผล" },
  { key: "40(5)", label: "40(5) ค่าเช่าทรัพย์สิน" },
  { key: "40(6)", label: "40(6) ค่าวิชาชีพอิสระ" },
  { key: "40(7)", label: "40(7) ค่ารับเหมา" },
  { key: "40(8)", label: "40(8) เงินได้อื่นๆ" },
];

const PND53_INCOME_TYPES = [
  { key: "1", label: "1. มาตรา 40(2) ค่านายหน้า" },
  { key: "2", label: "2. มาตรา 40(3) ค่าแห่งลิขสิทธิ์" },
  { key: "3", label: "3. มาตรา 40(4)(ก) ดอกเบี้ย" },
  { key: "4", label: "4. มาตรา 40(4)(ข) เงินปันผล" },
  { key: "5", label: "5. มาตรา 40(5) ค่าเช่า" },
  { key: "6", label: "6. มาตรา 40(6) ค่าวิชาชีพอิสระ" },
  { key: "7", label: "7. มาตรา 40(7) ค่ารับเหมา" },
  { key: "8", label: "8. มาตรา 40(8) เงินได้อื่นๆ" },
];

// ── Sub-components ──────────────────────────────────────────────────────────

function TaxIdBoxes({ taxId }: { taxId: string }) {
  const formatted = formatTaxId(taxId);
  const parts = formatted.split("-");

  const elements: React.ReactElement[] = [];
  parts.forEach((part, pi) => {
    if (pi > 0) {
      elements.push(
        React.createElement(Text, { style: s.taxIdDash, key: `d-${pi}` }, "-")
      );
    }
    for (let ci = 0; ci < part.length; ci++) {
      elements.push(
        React.createElement(
          View,
          { style: s.taxIdBox, key: `b-${pi}-${ci}` },
          React.createElement(Text, null, part[ci])
        )
      );
    }
  });

  return React.createElement(View, { style: s.taxIdRow }, ...elements);
}

function CheckboxItem({
  checked,
  label,
  itemKey,
}: {
  checked: boolean;
  label: string;
  itemKey: string;
}) {
  return React.createElement(
    View,
    { style: s.incomeItem, key: itemKey },
    React.createElement(
      View,
      { style: s.checkbox },
      React.createElement(Text, null, checked ? "X" : "")
    ),
    React.createElement(Text, { style: s.checkboxText }, label)
  );
}

function OriginalCopyCheckbox({ isOriginal }: { isOriginal: boolean }) {
  return React.createElement(
    View,
    { style: s.checkboxRow },
    React.createElement(
      View,
      { style: s.checkbox },
      React.createElement(Text, null, isOriginal ? "X" : "")
    ),
    React.createElement(Text, { style: s.checkboxLabel }, "ต้นฉบับ (Original)"),
    React.createElement(
      View,
      { style: s.checkbox },
      React.createElement(Text, null, isOriginal ? "" : "X")
    ),
    React.createElement(Text, { style: s.checkboxLabel }, "สำเนา (Copy)")
  );
}

function PartySection({
  title,
  name,
  taxId,
  branch,
  address,
}: {
  title: string;
  name: string;
  taxId: string;
  branch: string;
  address?: string;
}) {
  return React.createElement(
    View,
    { style: s.sectionBox },
    React.createElement(Text, { style: s.sectionTitle }, title),
    React.createElement(
      View,
      { style: s.infoRow },
      React.createElement(Text, { style: s.infoLabel }, "ชื่อ / Name:"),
      React.createElement(Text, { style: s.infoValue }, name)
    ),
    React.createElement(
      View,
      { style: { flexDirection: "row", alignItems: "center", marginBottom: 2 } },
      React.createElement(
        Text,
        { style: { width: 120, fontSize: 9 } },
        "เลขประจำตัวผู้เสียภาษี:"
      ),
      TaxIdBoxes({ taxId })
    ),
    React.createElement(
      View,
      { style: s.infoRow },
      React.createElement(Text, { style: s.infoLabel }, "สาขา / Branch:"),
      React.createElement(Text, { style: s.infoValue }, branch || "สำนักงานใหญ่")
    ),
    address
      ? React.createElement(
          View,
          { style: s.infoRow },
          React.createElement(Text, { style: s.infoLabel }, "ที่อยู่ / Address:"),
          React.createElement(Text, { style: s.infoValue }, address)
        )
      : null
  );
}

function IncomeTypeSection({
  formType,
  incomeSection,
}: {
  formType: "pnd3" | "pnd53";
  incomeSection: string;
}) {
  const options = formType === "pnd3" ? PND3_INCOME_TYPES : PND53_INCOME_TYPES;
  const sectionLabel =
    formType === "pnd3"
      ? "ประเภทเงินได้พึงประเมินที่จ่าย (Type of Income)"
      : "ประเภทเงินได้พึงประเมินที่จ่าย — นิติบุคคล (Corporate Income Type)";

  return React.createElement(
    View,
    { style: s.incomeSection },
    React.createElement(Text, { style: s.incomeSectionTitle }, sectionLabel),
    React.createElement(
      View,
      { style: s.incomeGrid },
      ...options.map((opt) =>
        CheckboxItem({
          checked: incomeSection === opt.key,
          label: opt.label,
          itemKey: `inc-${opt.key}`,
        })
      )
    )
  );
}

function PaymentDetailTable({
  data,
}: {
  data: WhtCertificateData;
}) {
  return React.createElement(
    View,
    { style: s.table },
    // Header
    React.createElement(
      View,
      { style: s.tableHeader },
      React.createElement(
        Text,
        { style: [s.cellDate, s.bold] },
        "วันเดือนปีที่จ่าย"
      ),
      React.createElement(
        Text,
        { style: [s.cellDesc, s.bold] },
        "ประเภทเงินได้ / Description"
      ),
      React.createElement(
        Text,
        { style: [s.cellAmount, s.bold] },
        "จำนวนเงินที่จ่าย"
      ),
      React.createElement(
        Text,
        { style: [s.cellWht, s.bold] },
        "ภาษีที่หักไว้"
      )
    ),
    // Single payment row
    React.createElement(
      View,
      { style: s.tableRow },
      React.createElement(Text, { style: s.cellDate }, data.paymentDate),
      React.createElement(
        Text,
        { style: s.cellDesc },
        `${data.incomeType} (${data.whtRate}%)`
      ),
      React.createElement(
        Text,
        { style: [s.cellAmount, s.amount] },
        formatAmount(data.amountPaid)
      ),
      React.createElement(
        Text,
        { style: [s.cellWht, s.amount] },
        formatAmount(data.whtAmount)
      )
    ),
    // Total row
    React.createElement(
      View,
      { style: s.totalRow },
      React.createElement(Text, { style: s.cellDate }, ""),
      React.createElement(
        Text,
        { style: [s.cellDesc, s.bold] },
        "รวมเงินที่จ่ายและภาษีที่หักนำส่ง"
      ),
      React.createElement(
        Text,
        { style: [s.cellAmount, s.bold, s.amount] },
        formatAmount(data.amountPaid)
      ),
      React.createElement(
        Text,
        { style: [s.cellWht, s.bold, s.amount] },
        formatAmount(data.whtAmount)
      )
    )
  );
}

function FilingReference({ data }: { data: WhtCertificateData }) {
  const formLabel = data.formType === "pnd3" ? "ภ.ง.ด.3" : "ภ.ง.ด.53";
  return React.createElement(
    View,
    { style: s.filingRef },
    React.createElement(
      Text,
      { style: s.filingText },
      `ผู้จ่ายเงินได้ยื่นแบบ ${formLabel}`
    )
  );
}

function SignatureBlock() {
  return React.createElement(
    View,
    { style: s.signatureArea },
    React.createElement(
      View,
      { style: s.signatureBlock },
      React.createElement(
        Text,
        { style: s.signatureLine },
        "ลงชื่อ ................................................ ผู้จ่ายเงิน"
      ),
      React.createElement(
        Text,
        { style: s.signatureDate },
        "วันที่ ___/___/___"
      ),
      React.createElement(
        Text,
        { style: s.stampNote },
        "(ประทับตราบริษัท / Company Stamp)"
      )
    )
  );
}

function VoidedWatermark() {
  return React.createElement(
    Text,
    { style: s.voidedWatermark },
    "เป็นโมฆะ"
  );
}

function CertificateFooter({ issuedAt }: { issuedAt: string }) {
  return React.createElement(
    View,
    { style: s.footer, fixed: true },
    React.createElement(Text, null, `Issued: ${issuedAt}`),
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

// ── Main Export ──────────────────────────────────────────────────────────────

export function WhtCertificatePdf(props: {
  data: WhtCertificateData;
}): React.ReactElement {
  const { data } = props;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: s.page },

      // Voided watermark (conditional)
      data.isVoided ? VoidedWatermark() : null,

      // Certificate number
      React.createElement(
        Text,
        { style: s.certNo },
        `เลขที่ / No. ${data.certificateNo}`
      ),

      // Title
      React.createElement(
        View,
        { style: s.titleArea },
        React.createElement(
          Text,
          { style: s.titleMain },
          "หนังสือรับรองการหักภาษี ณ ที่จ่าย"
        ),
        React.createElement(
          Text,
          { style: s.titleSub },
          "Withholding Tax Certificate (50 ทวิ)"
        )
      ),

      // Original / Copy checkbox
      OriginalCopyCheckbox({ isOriginal: true }),

      // Payer section
      PartySection({
        title: "ผู้จ่ายเงิน (Payer)",
        name: data.payerName,
        taxId: data.payerTaxId,
        branch: data.payerBranch,
        address: data.payerAddress,
      }),

      // Payee section
      PartySection({
        title: "ผู้รับเงิน (Payee)",
        name: data.payeeName,
        taxId: data.payeeTaxId,
        branch: data.payeeBranch,
        address: data.payeeAddress,
      }),

      // Income type checkboxes
      IncomeTypeSection({
        formType: data.formType,
        incomeSection: data.incomeSection,
      }),

      // Payment detail table
      PaymentDetailTable({ data }),

      // Filing reference
      FilingReference({ data }),

      // Signature area
      SignatureBlock(),

      // Footer
      CertificateFooter({ issuedAt: data.issuedAt })
    )
  );
}

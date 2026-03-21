/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, journalLines } from "@/lib/db/schema";
import { getBestMatchStrength } from "@/lib/services/match-strength";
import {
  ensureExpressTemplateRow,
  recordExportTemplateSelection,
} from "@/lib/services/express-template-sync";

const MATCH_SUFFIX: Record<string, string> = {
  strong: " [Strong]",
  suitable: " [Suitable]",
  manual: " [Manual]",
};

const sumDebit = (entries: Array<{ debit: string | number }>) =>
  entries.reduce((sum, row) => sum + Number(row.debit || 0), 0);
const sumCredit = (entries: Array<{ credit: string | number }>) =>
  entries.reduce((sum, row) => sum + Number(row.credit || 0), 0);

const formatDate = (value?: Date | string | null) => {
  const date = value ? new Date(value) : new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

export const formatVoucherNo = (journalType: string, valueDate: Date | string | null, sequence: number) => {
  const date = valueDate ? new Date(valueDate) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${journalType}${yy}${mm}-${String(sequence).padStart(3, "0")}`;
};

type ExportItem = {
  description: string;
  amount: number;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function extractItemsFromOcrRaw(ocrRaw: Record<string, any> | null | undefined, fallbackTotal: number) {
  const rawItems = ocrRaw?.line_items_pricing?.line_items || ocrRaw?.line_items || [];
  if (!Array.isArray(rawItems) || !rawItems.length) {
    return [{ description: "Item 1", amount: Math.max(0, fallbackTotal) }];
  }

  const mapped = rawItems.map((item, idx): ExportItem => {
    if (typeof item === "string") {
      return { description: item || `Item ${idx + 1}`, amount: 0 };
    }
    const qty = toNumber(item?.qty ?? item?.quantity);
    const price = toNumber(item?.unit_price ?? item?.price);
    const byQty = qty > 0 && price > 0 ? qty * price : 0;
    const amount = Math.max(
      0,
      toNumber(item?.line_total ?? item?.total ?? item?.amount ?? item?.net_amount ?? byQty)
    );
    return {
      description: String(item?.description || item?.name || `Item ${idx + 1}`),
      amount,
    };
  });

  const positive = mapped.filter((item) => item.amount > 0);
  if (positive.length) return positive;
  return [{ description: "Item 1", amount: Math.max(0, fallbackTotal) }];
}

function adjustBalanceForRoundedEntries(
  entries: Array<{ accountCode: string; deptCode: string | null; debit: number; credit: number; description: string | null }>
) {
  const debitTotal = Number(entries.reduce((sum, e) => sum + e.debit, 0).toFixed(2));
  const creditTotal = Number(entries.reduce((sum, e) => sum + e.credit, 0).toFixed(2));
  const diff = Number((debitTotal - creditTotal).toFixed(2));
  if (Math.abs(diff) <= 0.005) return entries;

  if (diff > 0) {
    const idx = entries.findIndex((e) => e.credit > 0);
    if (idx >= 0) entries[idx].credit = Number((entries[idx].credit + diff).toFixed(2));
  } else {
    const idx = entries.findIndex((e) => e.debit > 0);
    if (idx >= 0) entries[idx].debit = Number((entries[idx].debit + Math.abs(diff)).toFixed(2));
  }
  return entries;
}

function buildItemLevelEntries({
  baseEntries,
  items,
  docTotal,
}: {
  baseEntries: typeof journalLines.$inferSelect[];
  items: ExportItem[];
  docTotal: number;
}) {
  const validItems = items.filter((item) => item.amount > 0);
  const sourceItems = validItems.length ? validItems : [{ description: "Item 1", amount: Math.max(0, docTotal) }];
  const sumItemAmounts = sourceItems.reduce((sum, item) => sum + item.amount, 0);

  return sourceItems.map((item, idx) => {
    const ratio = sumItemAmounts > 0 ? item.amount / sumItemAmounts : 1 / sourceItems.length;
    const rounded = baseEntries.map((entry) => ({
      accountCode: entry.accountCode,
      deptCode: entry.deptCode || "",
      debit: Number((toNumber(entry.debit) * ratio).toFixed(2)),
      credit: Number((toNumber(entry.credit) * ratio).toFixed(2)),
      description: item.description || entry.description || `Item ${idx + 1}`,
    }));
    return {
      item,
      entries: adjustBalanceForRoundedEntries(rounded),
    };
  });
}

export async function exportApprovedDocumentsToExpress({
  tenantId,
  period = "month",
  journalType = "",
  returnContent = false,
  exportMode = "document",
  selectedDocumentIds = [],
  templateKey,
  exportedByUserId,
}: {
  tenantId: string;
  period?: "month" | "all";
  journalType?: string;
  returnContent?: boolean;
  exportMode?: "document" | "item";
  selectedDocumentIds?: string[];
  /** Static catalog id from `TEMPLATES` (export UI), stored under `express_templates.template_id`. */
  templateKey?: string | null;
  /** Profile id of the exporter — writes `export_template_selections` when template resolves. */
  exportedByUserId?: string | null;
}) {
  const filters = [eq(documents.tenantId, tenantId), eq(documents.status, "APPROVED")];

  // When user explicitly selects documents, use only tenant+status so selected docs are exported
  if (selectedDocumentIds.length === 0) {
    if (journalType) {
      filters.push(eq(documents.journalType, journalType as any));
    }
  }
  if (period === "month" && selectedDocumentIds.length === 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    filters.push(gte(documents.documentDate, start.toISOString().slice(0, 10)));
    filters.push(lt(documents.documentDate, end.toISOString().slice(0, 10)));
  }

  const approvedDocs = await db
    .select()
    .from(documents)
    .where(and(...filters))
    .orderBy(asc(documents.documentDate), asc(documents.createdAt));

  const targetDocs = selectedDocumentIds.length
    ? approvedDocs.filter((doc) => selectedDocumentIds.includes(doc.id))
    : approvedDocs;

  if (!targetDocs.length) {
    throw new Error("No APPROVED documents in the selected period");
  }

  const linesByDoc = await db
    .select()
    .from(journalLines)
    .where(inArray(journalLines.documentId, targetDocs.map((d) => d.id)));

  const lineMap = new Map<string, typeof linesByDoc>();
  for (const line of linesByDoc) {
    const arr = lineMap.get(line.documentId) || [];
    arr.push(line);
    lineMap.set(line.documentId, arr);
  }

  const lines: string[] = [];
  const exportedIds: Array<{ id: string; voucherNo: string; strength: string; vendor: string }> = [];
  const skipped = { noEntries: 0, noJournalType: 0, unbalanced: 0 };
  let counter = 1;

  for (const doc of targetDocs) {
    const entries = lineMap.get(doc.id) || [];
    if (!entries.length) {
      skipped.noEntries += 1;
      continue;
    }
    if (!doc.journalType) {
      skipped.noJournalType += 1;
      continue;
    }
    const debit = Number(sumDebit(entries).toFixed(2));
    const credit = Number(sumCredit(entries).toFixed(2));
    if (Math.abs(debit - credit) > 0.005) {
      skipped.unbalanced += 1;
      continue;
    }

    const { strength } = getBestMatchStrength({
      journalType: doc.journalType,
      direction: doc.direction as any,
      ocrRaw: (doc.ocrRaw as Record<string, any>) || {},
      issuerName: doc.issuerName,
    });
    const descBase = doc.issuerName || "Auto export";
    const description = descBase + (MATCH_SUFFIX[strength] || "");

    if (exportMode === "item") {
      const docTotal = toNumber(doc.grandTotal);
      const items = extractItemsFromOcrRaw((doc.ocrRaw as Record<string, any>) || {}, docTotal);
      const itemGroups = buildItemLevelEntries({ baseEntries: entries, items, docTotal });
      let itemCounter = 1;
      for (const group of itemGroups) {
        const voucherNo =
          `${doc.voucherNo || formatVoucherNo(doc.journalType, doc.documentDate, counter)}-I${String(itemCounter).padStart(2, "0")}`;
        itemCounter += 1;
        lines.push(
          `H|${formatDate(doc.documentDate)}|${voucherNo}|${doc.journalType}|${description} - ${group.item.description}`
        );
        for (const entry of group.entries) {
          lines.push(
            `D|${entry.accountCode || ""}|${entry.deptCode || ""}|${Number(entry.debit || 0).toFixed(2)}|${Number(entry.credit || 0).toFixed(2)}|${entry.description || ""}`
          );
        }
      }
      counter += 1;
      exportedIds.push({ id: doc.id, voucherNo: doc.voucherNo || formatVoucherNo(doc.journalType, doc.documentDate, counter), strength, vendor: doc.issuerName || "-" });
    } else {
      const voucherNo = doc.voucherNo || formatVoucherNo(doc.journalType, doc.documentDate, counter);
      counter += 1;
      lines.push(`H|${formatDate(doc.documentDate)}|${voucherNo}|${doc.journalType}|${description}`);
      for (const entry of entries) {
        lines.push(
          `D|${entry.accountCode || ""}|${entry.deptCode || ""}|${Number(entry.debit || 0).toFixed(2)}|${Number(entry.credit || 0).toFixed(2)}|${entry.description || ""}`
        );
      }
      exportedIds.push({ id: doc.id, voucherNo, strength, vendor: doc.issuerName || "-" });
    }
  }

  if (!lines.length) {
    const reasons = [];
    reasons.push(`${targetDocs.length} approved doc(s) found but none could be exported`);
    if (skipped.noEntries) reasons.push(`${skipped.noEntries} without journal entries`);
    if (skipped.noJournalType) reasons.push(`${skipped.noJournalType} without journal type`);
    if (skipped.unbalanced) reasons.push(`${skipped.unbalanced} with unbalanced debit/credit`);
    throw new Error(reasons.join(". "));
  }

  const exportDir = path.join(process.cwd(), "public", "generated", "exports");
  await fs.mkdir(exportDir, { recursive: true });

  const timestamp = Date.now();

  // Build Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AICount";
  workbook.created = new Date();

  // --- Export sheet ---
  const exportSheet = workbook.addWorksheet("Export");

  // Header row
  const headerRow = exportSheet.addRow(["Type", "Date", "VoucherNo", "JournalType", "AccountCode", "DeptCode", "Debit", "Credit", "Description"]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    cell.alignment = { horizontal: "center" };
  });

  for (const line of lines) {
    const parts = line.split("|");
    if (parts[0] === "H") {
      exportSheet.addRow([parts[0], parts[1] || "", parts[2] || "", parts[3] || "", "", "", "", "", parts[4] || ""]);
    } else {
      // D line
      const debit = Number(parts[3] || 0);
      const credit = Number(parts[4] || 0);
      exportSheet.addRow([parts[0], "", "", "", parts[1] || "", parts[2] || "", debit, credit, parts[5] || ""]);
    }
  }

  // Format number columns
  exportSheet.getColumn(7).numFmt = "#,##0.00";
  exportSheet.getColumn(8).numFmt = "#,##0.00";

  // Auto-width columns
  exportSheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  // --- Manifest sheet ---
  const manifestSheet = workbook.addWorksheet("Manifest");
  const mHeaderRow = manifestSheet.addRow(["VoucherNo", "MatchStrength", "Vendor", "ExportMode"]);
  mHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF70AD47" } };
    cell.alignment = { horizontal: "center" };
  });
  for (const { voucherNo, strength, vendor } of exportedIds) {
    manifestSheet.addRow([voucherNo, strength, vendor, exportMode]);
  }
  manifestSheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });

  const fileName = `express-export-${timestamp}.xlsx`;
  const filePath = path.join(exportDir, fileName);
  await workbook.xlsx.writeFile(filePath);

  for (const item of exportedIds) {
    await db
      .update(documents)
      .set({
        status: "EXPORTED",
        exportedAt: new Date(),
        voucherNo: item.voucherNo,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, item.id));
  }

  if (exportedByUserId && templateKey) {
    const expressRowId = await ensureExpressTemplateRow(tenantId, templateKey);
    if (expressRowId) {
      await recordExportTemplateSelection({
        tenantId,
        expressTemplateRowId: expressRowId,
        documentIds: exportedIds.map((row) => row.id),
        exportedBy: exportedByUserId,
      });
    }
  }

  const result: Record<string, unknown> = {
    filePath: `/generated/exports/${fileName}`,
    totalCandidates: targetDocs.length,
    exportedCount: exportedIds.length,
    exportMode,
  };
  if (returnContent) {
    result.fileContent = lines.join("\n");
  }
  if (templateKey) {
    result.templateKey = templateKey;
  }
  return result;
}


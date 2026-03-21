import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import postgres from "postgres";

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function normalizeUuid(value) {
  const text = String(value || "").trim();
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(text) ? text : crypto.randomUUID();
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function toTs(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function readJsonArray(dir, fileName) {
  try {
    const text = await fs.readFile(path.join(dir, fileName), "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function withTransaction(sql, task) {
  await sql.begin(async (trx) => {
    await task(trx);
  });
}

async function main() {
  const pgUrl = process.env.SUPABASE_DB_URL;
  if (!pgUrl) {
    throw new Error("SUPABASE_DB_URL is required");
  }
  const exportDir = readArg("input", process.env.LEGACY_EXPORT_DIR || "");
  if (!exportDir) throw new Error("Provide --input=<legacy-export-dir> or LEGACY_EXPORT_DIR");

  const sql = postgres(pgUrl, { max: 1 });
  const datasets = {
    tenants: await readJsonArray(exportDir, "tenants.json"),
    profiles: await readJsonArray(exportDir, "profiles.json"),
    tenantAssignments: await readJsonArray(exportDir, "tenant_assignments.json"),
    chartOfAccounts: await readJsonArray(exportDir, "chart_of_accounts.json"),
    vendors: await readJsonArray(exportDir, "vendors.json"),
    customers: await readJsonArray(exportDir, "customers.json"),
    products: await readJsonArray(exportDir, "products.json"),
    departments: await readJsonArray(exportDir, "departments.json"),
    documents: await readJsonArray(exportDir, "documents.json"),
    journalLines: await readJsonArray(exportDir, "journal_lines.json"),
  };

  const stats = {
    tenants: 0,
    profiles: 0,
    tenantAssignments: 0,
    chartOfAccounts: 0,
    vendors: 0,
    customers: 0,
    products: 0,
    departments: 0,
    documents: 0,
    journalLines: 0,
  };

  await withTransaction(sql, async (trx) => {
    for (const row of datasets.tenants) {
      await trx`
        insert into tenants (id, name, tax_id, owner_user_id, is_vat_registered, base_currency, data_retention_years, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${String(row.name || "Unknown Tenant")},
          ${String(row.tax_id || row.taxId || "0000000000000").slice(0, 13)},
          ${normalizeUuid(row.owner_user_id || row.ownerUserId)},
          ${row.is_vat_registered ?? row.isVatRegistered ?? true},
          ${String(row.base_currency || row.baseCurrency || "THB").slice(0, 3)},
          ${Number(row.data_retention_years || row.dataRetentionYears || 7)},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (id) do nothing
      `;
      stats.tenants += 1;
    }

    for (const row of datasets.profiles) {
      await trx`
        insert into profiles (id, email, name, role, is_active, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${String(row.email || "unknown@example.com")},
          ${row.name ? String(row.name) : null},
          ${String(row.role || "maker")},
          ${row.is_active ?? row.isActive ?? true},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (id) do nothing
      `;
      stats.profiles += 1;
    }

    for (const row of datasets.tenantAssignments) {
      await trx`
        insert into tenant_assignments (id, tenant_id, user_id, role, created_at)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${normalizeUuid(row.user_id || row.userId)},
          ${String(row.role || "maker")},
          ${toTs(row.created_at || row.createdAt)}
        ) on conflict (tenant_id, user_id, role) do nothing
      `;
      stats.tenantAssignments += 1;
    }

    for (const row of datasets.chartOfAccounts) {
      await trx`
        insert into chart_of_accounts (id, tenant_id, account_code, account_name, category, is_suspense, is_active, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${String(row.account_code || row.accountCode || "9999-99")},
          ${String(row.account_name || row.accountName || "Unknown Account")},
          ${String(row.category || "expense")},
          ${row.is_suspense ?? row.isSuspense ?? false},
          ${row.is_active ?? row.isActive ?? true},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (tenant_id, account_code) do nothing
      `;
      stats.chartOfAccounts += 1;
    }

    for (const row of datasets.vendors) {
      await trx`
        insert into vendors (id, tenant_id, tax_id, name, address, default_expense_gl, default_wht_rate, is_active, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${String(row.tax_id || row.taxId || "0000000000000").slice(0, 13)},
          ${String(row.name || "Unknown Vendor")},
          ${row.address ? String(row.address) : null},
          ${row.default_expense_gl || row.defaultExpenseGl || null},
          ${String(row.default_wht_rate || row.defaultWhtRate || "3.00")},
          ${row.is_active ?? row.isActive ?? true},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (tenant_id, tax_id) do nothing
      `;
      stats.vendors += 1;
    }

    for (const row of datasets.customers) {
      await trx`
        insert into customers (id, tenant_id, tax_id, name, credit_term_days, is_active, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${String(row.tax_id || row.taxId || "0000000000000").slice(0, 13)},
          ${String(row.name || "Unknown Customer")},
          ${Number(row.credit_term_days || row.creditTermDays || 30)},
          ${row.is_active ?? row.isActive ?? true},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (tenant_id, tax_id) do nothing
      `;
      stats.customers += 1;
    }

    for (const row of datasets.products) {
      await trx`
        insert into products (id, tenant_id, item_code, item_name, keywords, income_gl, expense_gl, is_active, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${String(row.item_code || row.itemCode || crypto.randomUUID().slice(0, 8))},
          ${String(row.item_name || row.itemName || "Unknown Product")},
          ${JSON.stringify(Array.isArray(row.keywords) ? row.keywords : [])}::jsonb,
          ${row.income_gl || row.incomeGl || null},
          ${row.expense_gl || row.expenseGl || null},
          ${row.is_active ?? row.isActive ?? true},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (tenant_id, item_code) do nothing
      `;
      stats.products += 1;
    }

    for (const row of datasets.departments) {
      await trx`
        insert into departments (id, tenant_id, dept_code, dept_name, is_active, created_at, updated_at)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${String(row.dept_code || row.deptCode || "GEN")},
          ${String(row.dept_name || row.deptName || "General")},
          ${row.is_active ?? row.isActive ?? true},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (tenant_id, dept_code) do nothing
      `;
      stats.departments += 1;
    }

    for (const row of datasets.documents) {
      await trx`
        insert into documents (
          id, tenant_id, uploaded_by, intake_source, file_url, file_hash, batch_id,
          issuer_tax_id, issuer_name, document_number, document_date, subtotal, vat_amount, grand_total, wht_amount,
          direction, doc_type, status, journal_type, voucher_no, confidence_score, ocr_raw, rejection_comment,
          currency, exchange_rate, version, void_reason, approved_by, approved_at, exported_at, created_at, updated_at
        )
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.tenant_id || row.tenantId)},
          ${normalizeUuid(row.uploaded_by || row.uploadedBy)},
          ${String(row.intake_source || row.intakeSource || "FRONTEND_UPLOAD")},
          ${row.file_url || row.fileUrl || null},
          ${row.file_hash || row.fileHash || null},
          ${(row.batch_id || row.batchId) ? normalizeUuid(row.batch_id || row.batchId) : null},
          ${row.issuer_tax_id || row.issuerTaxId || null},
          ${row.issuer_name || row.issuerName || null},
          ${row.document_number || row.documentNumber || null},
          ${toDate(row.document_date || row.documentDate)},
          ${row.subtotal != null ? String(row.subtotal) : null},
          ${row.vat_amount != null ? String(row.vat_amount) : null},
          ${row.grand_total != null ? String(row.grand_total) : null},
          ${row.wht_amount != null ? String(row.wht_amount) : null},
          ${row.direction || null},
          ${row.doc_type || row.docType || null},
          ${String(row.status || "DRAFT")},
          ${row.journal_type || row.journalType || null},
          ${row.voucher_no || row.voucherNo || null},
          ${row.confidence_score != null ? String(row.confidence_score) : null},
          ${row.ocr_raw ? JSON.stringify(row.ocr_raw) : row.ocrRaw ? JSON.stringify(row.ocrRaw) : null}::jsonb,
          ${row.rejection_comment || row.rejectionComment || null},
          ${String(row.currency || "THB")},
          ${row.exchange_rate != null ? String(row.exchange_rate) : row.exchangeRate != null ? String(row.exchangeRate) : null},
          ${Number(row.version || 1)},
          ${row.void_reason || row.voidReason || null},
          ${(row.approved_by || row.approvedBy) ? normalizeUuid(row.approved_by || row.approvedBy) : null},
          ${(row.approved_at || row.approvedAt) ? toTs(row.approved_at || row.approvedAt) : null},
          ${(row.exported_at || row.exportedAt) ? toTs(row.exported_at || row.exportedAt) : null},
          ${toTs(row.created_at || row.createdAt)},
          ${toTs(row.updated_at || row.updatedAt)}
        ) on conflict (id) do nothing
      `;
      stats.documents += 1;
    }

    for (const row of datasets.journalLines) {
      await trx`
        insert into journal_lines (id, document_id, account_code, dept_code, debit, credit, description, sort_order)
        values (
          ${normalizeUuid(row.id)},
          ${normalizeUuid(row.document_id || row.documentId)},
          ${String(row.account_code || row.accountCode || "9999-99")},
          ${row.dept_code || row.deptCode || null},
          ${String(Number(row.debit || 0).toFixed(2))},
          ${String(Number(row.credit || 0).toFixed(2))},
          ${row.description || null},
          ${Number(row.sort_order || row.sortOrder || 0)}
        ) on conflict (id) do nothing
      `;
      stats.journalLines += 1;
    }
  });

  const reportPath = path.join(exportDir, "migration-report.json");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        sourceDir: exportDir,
        stats,
      },
      null,
      2
    ),
    "utf8"
  );
  await sql.end();
  console.log("Migration completed. Report:", reportPath);
  console.log(stats);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


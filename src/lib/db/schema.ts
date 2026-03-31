import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  decimal,
  boolean,
  jsonb,
  pgEnum,
  date,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "maker", "checker"]);

export const accountCategoryEnum = pgEnum("account_category", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const intakeSourceEnum = pgEnum("intake_source", [
  "FRONTEND_UPLOAD",
  "LINE",
]);

export const docTypeEnum = pgEnum("doc_type", [
  "RECEIPT",
  "INVOICE",
  "PO",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "OTHER",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "DRAFT",
  "OCR_PROCESSING",
  "QUERY",
  "ACTION_REQUIRED",
  "PENDING_APPROVAL",
  "REJECTED",
  "APPROVED",
  "EXPORTED",
  "VOID",
]);

export const journalTypeEnum = pgEnum("journal_type", [
  "RV",
  "SV",
  "PV",
  "PurV",
  "JV",
  "Manual",
]);

export const journalStatusEnum = pgEnum("journal_status", [
  "draft",
  "posted",
  "reversed",
]);

export const matchTypeEnum = pgEnum("match_type", [
  "auto",
  "manual",
]);

export const directionEnum = pgEnum("direction", ["REVENUE", "EXPENSE"]);

export const assignmentRoleEnum = pgEnum("assignment_role", [
  "maker",
  "checker",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
]);

// ── Core Tables ─────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  taxId: varchar("tax_id", { length: 13 }).notNull(),
  ownerUserId: uuid("owner_user_id").notNull(),
  isVatRegistered: boolean("is_vat_registered").default(true),
  baseCurrency: varchar("base_currency", { length: 3 }).default("THB"),
  dataRetentionYears: integer("data_retention_years").default(7),
  defaultExportTemplateId: uuid("default_export_template_id"),
  address: text("address"),
  branchNumber: varchar("branch_number", { length: 20 }).default("00000"),
  nextJvSequence: integer("next_jv_sequence").default(0).notNull(),
  nextWhtSequence: integer("next_wht_sequence").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
  deletionReason: text("deletion_reason"),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // matches Supabase auth.users.id
  email: text("email").notNull(),
  name: text("name"),
  role: userRoleEnum("role").default("maker").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isOnboardingComplete: boolean("is_onboarding_complete").default(false).notNull(),
  onboardingStep: integer("onboarding_step").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
});

export const tenantAssignments = pgTable(
  "tenant_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: assignmentRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_user_role_idx").on(
      table.tenantId,
      table.userId,
      table.role
    ),
  ]
);

// ── Invitations ──────────────────────────────────────────────────────────────

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: assignmentRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => profiles.id),
    status: invitationStatusEnum("status").default("pending").notNull(),
    token: varchar("token", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("invitation_token_idx").on(table.token),
    index("invitation_tenant_idx").on(table.tenantId),
    index("invitation_email_idx").on(table.email),
  ]
);

// ── Master Data (Tenant-Scoped) ─────────────────────────────────────────────

export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountCode: varchar("account_code", { length: 20 }).notNull(),
    accountName: text("account_name").notNull(),
    category: accountCategoryEnum("category").notNull(),
    isSuspense: boolean("is_suspense").default(false).notNull(),
    cashFlowCategory: varchar("cash_flow_category", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("coa_tenant_code_idx").on(table.tenantId, table.accountCode),
  ]
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    taxId: varchar("tax_id", { length: 13 }).notNull(),
    name: text("name").notNull(),
    vendorType: varchar("vendor_type", { length: 20 }).default("company").notNull(),
    isNonResident: boolean("is_non_resident").default(false).notNull(),
    branchNumber: varchar("branch_number", { length: 20 }),
    country: varchar("country", { length: 100 }),
    address: text("address"),
    defaultExpenseGl: varchar("default_expense_gl", { length: 20 }),
    defaultWhtRate: decimal("default_wht_rate", {
      precision: 5,
      scale: 2,
    }).default("3.00"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("vendor_tenant_tax_idx").on(table.tenantId, table.taxId),
  ]
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    taxId: varchar("tax_id", { length: 13 }).notNull(),
    name: text("name").notNull(),
    branchNumber: varchar("branch_number", { length: 20 }),
    creditTermDays: integer("credit_term_days").default(30),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customer_tenant_tax_idx").on(table.tenantId, table.taxId),
  ]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    itemCode: varchar("item_code", { length: 50 }).notNull(),
    itemName: text("item_name").notNull(),
    keywords: jsonb("keywords").$type<string[]>().default([]),
    incomeGl: varchar("income_gl", { length: 20 }),
    expenseGl: varchar("expense_gl", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_tenant_code_idx").on(table.tenantId, table.itemCode),
  ]
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    deptCode: varchar("dept_code", { length: 20 }).notNull(),
    deptName: text("dept_name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("dept_tenant_code_idx").on(table.tenantId, table.deptCode),
  ]
);

// ── Documents & Journal Lines ───────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => profiles.id),
    intakeSource: intakeSourceEnum("intake_source")
      .default("FRONTEND_UPLOAD")
      .notNull(),
    fileUrl: text("file_url"),
    fileHash: varchar("file_hash", { length: 64 }),
    batchId: uuid("batch_id"),

    // PO Matching & Reversal
    linkedPoId: uuid("linked_po_id"),
    reversesDocumentId: uuid("reverses_document_id"),
    parentDocumentId: uuid("parent_document_id"),

    // OCR-extracted fields
    issuerTaxId: varchar("issuer_tax_id", { length: 13 }),
    issuerName: text("issuer_name"),
    issuerBranch: varchar("issuer_branch", { length: 20 }),
    documentNumber: varchar("document_number", { length: 100 }),
    documentDate: date("document_date"),
    subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
    vatAmount: decimal("vat_amount", { precision: 15, scale: 2 }),
    grandTotal: decimal("grand_total", { precision: 15, scale: 2 }),
    whtAmount: decimal("wht_amount", { precision: 15, scale: 2 }),
    whtIncomeType: varchar("wht_income_type", { length: 50 }),
    whtRate: decimal("wht_rate", { precision: 5, scale: 2 }),
    dueDate: date("due_date"),

    // Phase 6A: New extraction fields
    customerTaxId: varchar("customer_tax_id", { length: 13 }),
    referencePo: varchar("reference_po", { length: 100 }),
    creditDueDate: date("credit_due_date"),
    discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0"),

    // Phase 6A: Extraction pipeline tracking
    extractionStatus: text("extraction_status").default("pending"),
    extractionFailureReason: text("extraction_failure_reason"),

    // Classification
    direction: directionEnum("direction"),
    docType: docTypeEnum("doc_type"),
    status: documentStatusEnum("status").default("DRAFT").notNull(),
    journalType: journalTypeEnum("journal_type"),
    voucherNo: varchar("voucher_no", { length: 50 }),
    confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
    ocrRaw: jsonb("ocr_raw"),
    rejectionComment: text("rejection_comment"),

    // Multi-currency
    currency: varchar("currency", { length: 3 }).default("THB"),
    exchangeRate: decimal("exchange_rate", { precision: 15, scale: 6 }),

    // Versioning & void
    version: integer("version").default(1).notNull(),
    voidReason: text("void_reason"),

    // WHT certificate
    whtCertificatePath: text("wht_certificate_path"),

    // Approval
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at"),
    exportedAt: timestamp("exported_at"),

    // Soft delete
    deletedAt: timestamp("deleted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("doc_tenant_status_idx").on(table.tenantId, table.status),
    index("doc_tenant_date_idx").on(table.tenantId, table.documentDate),
    index("doc_batch_idx").on(table.batchId),
    index("doc_file_hash_idx").on(table.tenantId, table.fileHash),
  ]
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntries.id,
      { onDelete: "cascade" }
    ),
    accountCode: varchar("account_code", { length: 20 }).notNull(),
    deptCode: varchar("dept_code", { length: 20 }),
    debit: decimal("debit", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    credit: decimal("credit", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
  },
  (table) => [
    index("jl_document_idx").on(table.documentId),
    index("jl_journal_entry_idx").on(table.journalEntryId),
  ]
);

// ── GL Mapping Rules ────────────────────────────────────────────────────────

export const glMappingRules = pgTable(
  "gl_mapping_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    keywordPattern: text("keyword_pattern").notNull(),
    expenseGl: varchar("expense_gl", { length: 20 }),
    incomeGl: varchar("income_gl", { length: 20 }),
    priority: integer("priority").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("gl_rule_tenant_idx").on(table.tenantId)]
);

// ── Period Locks ────────────────────────────────────────────────────────────

export const periodLocks = pgTable(
  "period_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    yearMonth: varchar("year_month", { length: 7 }).notNull(), // YYYY-MM
    lockedBy: uuid("locked_by")
      .notNull()
      .references(() => profiles.id),
    lockedAt: timestamp("locked_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("period_lock_tenant_ym_idx").on(
      table.tenantId,
      table.yearMonth
    ),
  ]
);

// ── Bank Statements ─────────────────────────────────────────────────────────

export const bankStatements = pgTable(
  "bank_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    statementDate: date("statement_date").notNull(),
    balance: decimal("balance", { precision: 15, scale: 2 }),
    lineItems: jsonb("line_items"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("bank_stmt_tenant_idx").on(table.tenantId)]
);

// ── Journal Entries ─────────────────────────────────────────────────────────

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jvNumber: varchar("jv_number", { length: 50 }).notNull(),
    date: date("date").notNull(),
    type: journalTypeEnum("type").notNull(),
    description: text("description").notNull(),
    status: journalStatusEnum("status").default("draft").notNull(),
    sourceDocumentId: uuid("source_document_id").references(
      () => documents.id
    ),
    reversedFromId: uuid("reversed_from_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("je_tenant_jv_idx").on(table.tenantId, table.jvNumber),
    index("je_tenant_date_idx").on(table.tenantId, table.date),
    index("je_tenant_status_idx").on(table.tenantId, table.status),
    index("je_source_doc_idx").on(table.sourceDocumentId),
  ]
);

// ── Payments ────────────────────────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntries.id
    ),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    whtAmount: decimal("wht_amount", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    netAmount: decimal("net_amount", { precision: 15, scale: 2 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }),
    referenceNo: varchar("reference_no", { length: 100 }),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pmt_tenant_doc_idx").on(table.tenantId, table.documentId),
    index("pmt_tenant_date_idx").on(table.tenantId, table.paymentDate),
  ]
);

// ── Bank Transactions ───────────────────────────────────────────────────────

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankStatementId: uuid("bank_statement_id")
      .notNull()
      .references(() => bankStatements.id, { onDelete: "cascade" }),
    transactionDate: date("transaction_date").notNull(),
    description: text("description").notNull(),
    debit: decimal("debit", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    credit: decimal("credit", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    referenceNo: varchar("reference_no", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("btx_statement_idx").on(table.bankStatementId)]
);

// ── Bank Reconciliation Matches ─────────────────────────────────────────────

export const bankReconMatches = pgTable(
  "bank_recon_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id),
    matchType: matchTypeEnum("match_type").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }),
    confirmedAt: timestamp("confirmed_at"),
    confirmedBy: uuid("confirmed_by").references(() => profiles.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("brm_bank_tx_idx").on(table.bankTransactionId),
    index("brm_tenant_confirmed_idx").on(table.tenantId, table.confirmedAt),
  ]
);

// ── Express Templates ───────────────────────────────────────────────────────

export const expressTemplates = pgTable(
  "express_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    templateId: varchar("template_id", { length: 50 }).notNull(),
    name: text("name").notNull(),
    journalTypes: jsonb("journal_types").$type<string[]>().default([]),
    categoryKeywords: jsonb("category_keywords").$type<string[]>().default([]),
    direction: directionEnum("direction"),
    accountingPart: text("accounting_part"),
    templateGroup: text("template_group"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("express_tpl_tenant_id_idx").on(
      table.tenantId,
      table.templateId
    ),
  ]
);

// ── Export Template Selections (Audit) ──────────────────────────────────────

export const exportTemplateSelections = pgTable("export_template_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => expressTemplates.id),
  documentIds: jsonb("document_ids").$type<string[]>().default([]),
  exportedAt: timestamp("exported_at").defaultNow().notNull(),
  exportedBy: uuid("exported_by")
    .notNull()
    .references(() => profiles.id),
});

// ── Audit Logs ──────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    userId: uuid("user_id").references(() => profiles.id),
    action: text("action").notNull(), // e.g. "document.approved", "coa.updated"
    entityType: text("entity_type"), // e.g. "document", "vendor"
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"), // free-form context
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_tenant_idx").on(table.tenantId),
    index("audit_entity_idx").on(table.entityType, table.entityId),
  ]
);

// ── Notifications ───────────────────────────────────────────────────────────

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  emailOnReject: boolean("email_on_reject").default(true).notNull(),
  emailOnPending: boolean("email_on_pending").default(true).notNull(),
  emailWeeklyDigest: boolean("email_weekly_digest").default(false).notNull(),
  inApp: boolean("in_app").default(true).notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notif_user_read_idx").on(table.userId, table.isRead),
  ]
);

// ── Report History ──────────────────────────────────────────────────────────

export const reportHistory = pgTable(
  "report_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reportType: varchar("report_type", { length: 50 }).notNull(),
    period: varchar("period", { length: 20 }).notNull(),
    periodScope: varchar("period_scope", { length: 20 }).notNull(),
    dateFrom: date("date_from").notNull(),
    dateTo: date("date_to").notNull(),
    filters: jsonb("filters"),
    pdfStoragePath: text("pdf_storage_path"),
    pdfSizeBytes: integer("pdf_size_bytes"),
    generatedBy: uuid("generated_by").references(() => profiles.id),
    lockedAt: timestamp("locked_at"),
    lockedBy: uuid("locked_by").references(() => profiles.id),
    deletedAt: timestamp("deleted_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("report_history_draft_idx")
      .on(table.tenantId, table.reportType, table.period, table.periodScope)
      .where(sql`locked_at IS NULL AND deleted_at IS NULL`),
  ]
);

// ── Report Retention Policy ─────────────────────────────────────────────────

export const reportRetentionPolicy = pgTable("report_retention_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  draftRetentionDays: integer("draft_retention_days").default(30).notNull(),
  trashRecoveryDays: integer("trash_recovery_days").default(7).notNull(),
  financialRetentionValue: integer("financial_retention_value").default(7).notNull(),
  financialRetentionUnit: varchar("financial_retention_unit", { length: 10 }).default("years").notNull(),
  taxRetentionValue: integer("tax_retention_value").default(7).notNull(),
  taxRetentionUnit: varchar("tax_retention_unit", { length: 10 }).default("years").notNull(),
  whtRetentionValue: integer("wht_retention_value").default(7).notNull(),
  whtRetentionUnit: varchar("wht_retention_unit", { length: 10 }).default("years").notNull(),
  managementRetentionValue: integer("management_retention_value").default(2).notNull(),
  managementRetentionUnit: varchar("management_retention_unit", { length: 10 }).default("years").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => profiles.id),
});

// ── WHT Certificates ──────────────────────────────────────────────────────

export const whtCertificates = pgTable(
  "wht_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    certificateNo: varchar("certificate_no", { length: 20 }).notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    paymentId: uuid("payment_id"),
    vendorId: uuid("vendor_id"),
    formType: varchar("form_type", { length: 10 }).notNull(),
    payeeName: text("payee_name").notNull(),
    payeeTaxId: varchar("payee_tax_id", { length: 13 }).notNull(),
    payeeBranch: varchar("payee_branch", { length: 20 }).default("00000"),
    payeeAddress: text("payee_address"),
    payerName: text("payer_name").notNull(),
    payerTaxId: varchar("payer_tax_id", { length: 13 }).notNull(),
    payerAddress: text("payer_address"),
    payerBranch: varchar("payer_branch", { length: 20 }).default("00000"),
    incomeType: varchar("income_type", { length: 50 }).notNull(),
    incomeSection: varchar("income_section", { length: 20 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).notNull(),
    whtRate: decimal("wht_rate", { precision: 5, scale: 2 }).notNull(),
    whtAmount: decimal("wht_amount", { precision: 15, scale: 2 }).notNull(),
    pdfStoragePath: text("pdf_storage_path"),
    pdfSizeBytes: integer("pdf_size_bytes"),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    issuedBy: uuid("issued_by").references(() => profiles.id),
    voidedAt: timestamp("voided_at"),
    voidedBy: uuid("voided_by").references(() => profiles.id),
    voidReason: text("void_reason"),
    replacesId: uuid("replaces_id"),
    expiresAt: timestamp("expires_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wht_cert_tenant_no_idx").on(table.tenantId, table.certificateNo),
    index("wht_cert_doc_idx").on(table.tenantId, table.documentId),
  ]
);

// ── Bank Reconciliation Settings ──────────────────────────────────────────

export const bankReconSettings = pgTable("bank_recon_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  amountTolerance: decimal("amount_tolerance", { precision: 10, scale: 2 })
    .default("0.50")
    .notNull(),
  dateRangeDays: integer("date_range_days").default(3).notNull(),
  autoMatch: boolean("auto_match").default(true).notNull(),
  matchByReference: boolean("match_by_reference").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Bank Accounts ─────────────────────────────────────────────────────────

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    glAccountCode: varchar("gl_account_code", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("bank_account_tenant_idx").on(table.tenantId)]
);

// ── Custom Export Templates ───────────────────────────────────────────────

export const customExportTemplates = pgTable("custom_export_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  columnMappings: jsonb("column_mappings")
    .$type<
      Array<{
        position: number;
        header: string;
        sourceField: string;
        format?: string;
        defaultValue?: string;
      }>
    >()
    .default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── AI Extraction Rules ────────────────────────────────────────────────────

export const aiExtractionRules = pgTable("ai_extraction_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  ruleType: text("rule_type").notNull(),
  triggerKey: text("trigger_key").notNull(),
  triggerValue: text("trigger_value").notNull(),
  fieldName: text("field_name").notNull(),
  ruleText: text("rule_text").notNull(),
  deterministicValue: text("deterministic_value"),
  sampleCount: integer("sample_count").default(1).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.50").notNull(),
  isGraduated: boolean("is_graduated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

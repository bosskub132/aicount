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
    documentNumber: varchar("document_number", { length: 100 }),
    documentDate: date("document_date"),
    subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
    vatAmount: decimal("vat_amount", { precision: 15, scale: 2 }),
    grandTotal: decimal("grand_total", { precision: 15, scale: 2 }),
    whtAmount: decimal("wht_amount", { precision: 15, scale: 2 }),
    dueDate: date("due_date"),

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
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
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
  (table) => [index("jl_document_idx").on(table.documentId)]
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

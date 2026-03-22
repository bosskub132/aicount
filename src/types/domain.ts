import type { InferSelectModel } from "drizzle-orm";
import type {
  tenants,
  profiles,
  tenantAssignments,
  chartOfAccounts,
  vendors,
  customers,
  products,
  departments,
  documents,
  journalLines,
  journalEntries,
  payments,
  bankTransactions,
  bankReconMatches,
  glMappingRules,
  periodLocks,
  expressTemplates,
  auditLogs,
  notifications,
} from "@/lib/db/schema";

export type Tenant = InferSelectModel<typeof tenants>;
export type Profile = InferSelectModel<typeof profiles>;
export type TenantAssignment = InferSelectModel<typeof tenantAssignments>;
export type ChartOfAccount = InferSelectModel<typeof chartOfAccounts>;
export type Vendor = InferSelectModel<typeof vendors>;
export type Customer = InferSelectModel<typeof customers>;
export type Product = InferSelectModel<typeof products>;
export type Department = InferSelectModel<typeof departments>;
export type Document = InferSelectModel<typeof documents>;
export type JournalLine = InferSelectModel<typeof journalLines>;
export type JournalEntry = InferSelectModel<typeof journalEntries>;
export type Payment = InferSelectModel<typeof payments>;
export type BankTransaction = InferSelectModel<typeof bankTransactions>;
export type BankReconMatch = InferSelectModel<typeof bankReconMatches>;
export type GLMappingRule = InferSelectModel<typeof glMappingRules>;
export type PeriodLock = InferSelectModel<typeof periodLocks>;
export type ExpressTemplate = InferSelectModel<typeof expressTemplates>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type Notification = InferSelectModel<typeof notifications>;

export type DocumentWithLines = Document & {
  journalLines: JournalLine[];
};

export type JournalEntryWithLines = JournalEntry & {
  lines: JournalLine[];
};

export type JournalEntryWithDetails = JournalEntry & {
  lines: JournalLine[];
  sourceDocument?: Document | null;
};

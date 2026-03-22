import { relations } from "drizzle-orm";
import {
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
  bankStatements,
  bankTransactions,
  bankReconMatches,
  glMappingRules,
  periodLocks,
  expressTemplates,
  exportTemplateSelections,
  notifications,
  notificationPreferences,
} from "./schema";

export const tenantsRelations = relations(tenants, ({ many }) => ({
  assignments: many(tenantAssignments),
  chartOfAccounts: many(chartOfAccounts),
  vendors: many(vendors),
  customers: many(customers),
  products: many(products),
  departments: many(departments),
  documents: many(documents),
  journalEntries: many(journalEntries),
  payments: many(payments),
  bankReconMatches: many(bankReconMatches),
  glMappingRules: many(glMappingRules),
  periodLocks: many(periodLocks),
  bankStatements: many(bankStatements),
  expressTemplates: many(expressTemplates),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  assignments: many(tenantAssignments),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
}));

export const tenantAssignmentsRelations = relations(
  tenantAssignments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantAssignments.tenantId],
      references: [tenants.id],
    }),
    user: one(profiles, {
      fields: [tenantAssignments.userId],
      references: [profiles.id],
    }),
  })
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [documents.tenantId],
    references: [tenants.id],
  }),
  uploader: one(profiles, {
    fields: [documents.uploadedBy],
    references: [profiles.id],
  }),
  journalLines: many(journalLines),
  journalEntries: many(journalEntries),
  payments: many(payments),
  linkedPo: one(documents, {
    fields: [documents.linkedPoId],
    references: [documents.id],
    relationName: "poLink",
  }),
  reversedDoc: one(documents, {
    fields: [documents.reversesDocumentId],
    references: [documents.id],
    relationName: "reversal",
  }),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  document: one(documents, {
    fields: [journalLines.documentId],
    references: [documents.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
}));

export const chartOfAccountsRelations = relations(
  chartOfAccounts,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [chartOfAccounts.tenantId],
      references: [tenants.id],
    }),
  })
);

export const vendorsRelations = relations(vendors, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vendors.tenantId],
    references: [tenants.id],
  }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
}));

export const departmentsRelations = relations(departments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [departments.tenantId],
    references: [tenants.id],
  }),
}));

export const expressTemplatesRelations = relations(
  expressTemplates,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [expressTemplates.tenantId],
      references: [tenants.id],
    }),
  })
);

export const exportTemplateSelectionsRelations = relations(
  exportTemplateSelections,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [exportTemplateSelections.tenantId],
      references: [tenants.id],
    }),
    template: one(expressTemplates, {
      fields: [exportTemplateSelections.templateId],
      references: [expressTemplates.id],
    }),
    exportedByUser: one(profiles, {
      fields: [exportTemplateSelections.exportedBy],
      references: [profiles.id],
    }),
  })
);

export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [journalEntries.tenantId],
      references: [tenants.id],
    }),
    sourceDocument: one(documents, {
      fields: [journalEntries.sourceDocumentId],
      references: [documents.id],
    }),
    reversedFrom: one(journalEntries, {
      fields: [journalEntries.reversedFromId],
      references: [journalEntries.id],
      relationName: "reversal",
    }),
    createdByUser: one(profiles, {
      fields: [journalEntries.createdBy],
      references: [profiles.id],
    }),
    lines: many(journalLines),
    payments: many(payments),
    bankReconMatches: many(bankReconMatches),
  })
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  document: one(documents, {
    fields: [payments.documentId],
    references: [documents.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [payments.journalEntryId],
    references: [journalEntries.id],
  }),
  createdByUser: one(profiles, {
    fields: [payments.createdBy],
    references: [profiles.id],
  }),
}));

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one, many }) => ({
    bankStatement: one(bankStatements, {
      fields: [bankTransactions.bankStatementId],
      references: [bankStatements.id],
    }),
    reconMatch: many(bankReconMatches),
  })
);

export const bankStatementsRelations = relations(
  bankStatements,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [bankStatements.tenantId],
      references: [tenants.id],
    }),
    transactions: many(bankTransactions),
  })
);

export const bankReconMatchesRelations = relations(
  bankReconMatches,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [bankReconMatches.tenantId],
      references: [tenants.id],
    }),
    bankTransaction: one(bankTransactions, {
      fields: [bankReconMatches.bankTransactionId],
      references: [bankTransactions.id],
    }),
    journalEntry: one(journalEntries, {
      fields: [bankReconMatches.journalEntryId],
      references: [journalEntries.id],
    }),
    confirmedByUser: one(profiles, {
      fields: [bankReconMatches.confirmedBy],
      references: [profiles.id],
    }),
  })
);

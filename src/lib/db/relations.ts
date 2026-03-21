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
  glMappingRules,
  periodLocks,
  bankStatements,
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

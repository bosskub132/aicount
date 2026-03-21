import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exportTemplateSelections, expressTemplates } from "@/lib/db/schema";
import { TEMPLATES } from "@/lib/services/match-strength";

function templateDisplayName(id: string) {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Ensures a tenant row exists in `express_templates` for a static catalog `templateKey` (e.g. cash-purchase). */
export async function ensureExpressTemplateRow(
  tenantId: string,
  templateKey: string | null | undefined
): Promise<string | null> {
  if (!templateKey) return null;
  const meta = TEMPLATES.find((t) => t.id === templateKey);
  if (!meta) return null;

  const [existing] = await db
    .select({ id: expressTemplates.id })
    .from(expressTemplates)
    .where(and(eq(expressTemplates.tenantId, tenantId), eq(expressTemplates.templateId, templateKey)))
    .limit(1);
  if (existing) return existing.id;

  try {
    const [inserted] = await db
      .insert(expressTemplates)
      .values({
        tenantId,
        templateId: templateKey,
        name: templateDisplayName(meta.id),
        journalTypes: meta.journalTypes,
        categoryKeywords: meta.categoryKeywords,
        direction: meta.direction,
      })
      .returning({ id: expressTemplates.id });
    if (inserted?.id) return inserted.id;
  } catch {
    // concurrent insert — resolve existing row
  }

  const [after] = await db
    .select({ id: expressTemplates.id })
    .from(expressTemplates)
    .where(and(eq(expressTemplates.tenantId, tenantId), eq(expressTemplates.templateId, templateKey)))
    .limit(1);
  return after?.id ?? null;
}

export async function recordExportTemplateSelection(params: {
  tenantId: string;
  expressTemplateRowId: string;
  documentIds: string[];
  exportedBy: string;
}) {
  if (!params.documentIds.length) return;
  await db.insert(exportTemplateSelections).values({
    tenantId: params.tenantId,
    templateId: params.expressTemplateRowId,
    documentIds: params.documentIds,
    exportedBy: params.exportedBy,
  });
}

import { eq, sql } from "drizzle-orm";
import { tenants } from "@/lib/db/schema";

type DrizzleDb = {
  update: typeof import("@/lib/db").db.update;
};

/**
 * Generate a sequential WHT certificate number for the given tenant.
 * Format: WHT-{YYYY}-{NNNN} zero-padded (e.g., "WHT-2026-0001")
 *
 * MUST be called inside a transaction for concurrency safety.
 * Uses atomic UPDATE ... RETURNING to avoid race conditions.
 */
export async function generateWhtCertificateNumber(
  db: DrizzleDb,
  tenantId: string,
): Promise<string> {
  const [row] = await db
    .update(tenants)
    .set({
      nextWhtSequence: sql`${tenants.nextWhtSequence} + 1`,
    })
    .where(eq(tenants.id, tenantId))
    .returning({ nextWhtSequence: tenants.nextWhtSequence });

  if (!row) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const year = new Date().getFullYear();
  const seq = String(row.nextWhtSequence).padStart(4, "0");

  return `WHT-${year}-${seq}`;
}

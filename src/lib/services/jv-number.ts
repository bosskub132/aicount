import { eq, sql } from "drizzle-orm";
import { tenants } from "@/lib/db/schema";

type DrizzleDb = {
  update: typeof import("@/lib/db").db.update;
};

/**
 * Generate a sequential JV number for the given tenant.
 * Format: JV-{YYYY}-{NNNN} zero-padded (e.g., "JV-2026-0142")
 *
 * MUST be called inside a transaction for concurrency safety.
 * Uses atomic UPDATE ... RETURNING to avoid race conditions.
 */
export async function generateJvNumber(
  db: DrizzleDb,
  tenantId: string,
): Promise<string> {
  const [row] = await db
    .update(tenants)
    .set({
      nextJvSequence: sql`${tenants.nextJvSequence} + 1`,
    })
    .where(eq(tenants.id, tenantId))
    .returning({ nextJvSequence: tenants.nextJvSequence });

  if (!row) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const year = new Date().getFullYear();
  const seq = String(row.nextJvSequence).padStart(4, "0");

  return `JV-${year}-${seq}`;
}

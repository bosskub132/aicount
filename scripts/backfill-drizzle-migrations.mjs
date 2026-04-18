import { config } from "dotenv";
import postgres from "postgres";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: ".env.local", override: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set in .env.local");
  process.exit(1);
}

const MIGRATIONS_DIR = resolve("supabase/migrations");
const journal = JSON.parse(readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, "utf8"));

const sql = postgres(url, { max: 1, prepare: false });

try {
  console.log("[backfill] Ensuring drizzle schema + tracking table exist...");
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const existingRows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const existing = new Set(existingRows.map((r) => r.hash));
  console.log(`[backfill] ${existing.size} migrations already tracked.`);

  let inserted = 0;
  let skipped = 0;
  for (const entry of journal.entries) {
    const filePath = `${MIGRATIONS_DIR}/${entry.tag}.sql`;
    const content = readFileSync(filePath, "utf8");
    const hash = createHash("sha256").update(content).digest("hex");
    if (existing.has(hash)) {
      console.log(`[backfill] ${entry.tag} → already tracked, skipping`);
      skipped++;
      continue;
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`[backfill] ${entry.tag} → inserted (hash ${hash.slice(0, 12)}…)`);
    inserted++;
  }

  console.log(`[backfill] ✓ Done. Inserted ${inserted}, skipped ${skipped}.`);
  const after = await sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`;
  console.log(`[backfill] Tracking table now has ${after[0].n} rows.`);
} catch (err) {
  console.error("[backfill] Failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

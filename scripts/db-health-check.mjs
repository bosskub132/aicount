import "dotenv/config";
import postgres from "postgres";

async function main() {
  const pgUrl = process.env.SUPABASE_DB_URL;
  if (!pgUrl) throw new Error("SUPABASE_DB_URL is required");
  const sql = postgres(pgUrl, { max: 1 });

  const requiredTables = [
    "tenants",
    "profiles",
    "tenant_assignments",
    "chart_of_accounts",
    "vendors",
    "customers",
    "products",
    "departments",
    "documents",
    "journal_lines",
    "gl_mapping_rules",
    "period_locks",
    "bank_statements",
    "export_template_selections",
  ];

  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
  `;
  const existing = new Set(rows.map((r) => r.table_name));
  const missing = requiredTables.filter((name) => !existing.has(name));

  const rlsRows = await sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and rowsecurity = true
  `;
  const rlsEnabled = new Set(rlsRows.map((r) => r.tablename));

  const response = {
    checkedAt: new Date().toISOString(),
    missingTables: missing,
    tablesWithRls: Array.from(rlsEnabled).sort(),
  };

  await sql.end();
  console.log(JSON.stringify(response, null, 2));
  if (missing.length) process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


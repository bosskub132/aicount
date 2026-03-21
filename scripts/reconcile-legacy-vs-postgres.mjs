import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function readJsonArray(dir, fileName) {
  try {
    const text = await fs.readFile(path.join(dir, fileName), "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const pgUrl = process.env.SUPABASE_DB_URL;
  if (!pgUrl) throw new Error("SUPABASE_DB_URL is required");
  const exportDir = readArg("input", process.env.LEGACY_EXPORT_DIR || "");
  if (!exportDir) throw new Error("Provide --input=<legacy-export-dir> or LEGACY_EXPORT_DIR");

  const sql = postgres(pgUrl, { max: 1 });
  const legacy = {
    tenants: await readJsonArray(exportDir, "tenants.json"),
    profiles: await readJsonArray(exportDir, "profiles.json"),
    tenantAssignments: await readJsonArray(exportDir, "tenant_assignments.json"),
    chartOfAccounts: await readJsonArray(exportDir, "chart_of_accounts.json"),
    vendors: await readJsonArray(exportDir, "vendors.json"),
    customers: await readJsonArray(exportDir, "customers.json"),
    products: await readJsonArray(exportDir, "products.json"),
    departments: await readJsonArray(exportDir, "departments.json"),
    documents: await readJsonArray(exportDir, "documents.json"),
    journalLines: await readJsonArray(exportDir, "journal_lines.json"),
  };

  const dbCounts = {
    tenants: Number((await sql`select count(*)::int as n from tenants`)[0].n),
    profiles: Number((await sql`select count(*)::int as n from profiles`)[0].n),
    tenantAssignments: Number((await sql`select count(*)::int as n from tenant_assignments`)[0].n),
    chartOfAccounts: Number((await sql`select count(*)::int as n from chart_of_accounts`)[0].n),
    vendors: Number((await sql`select count(*)::int as n from vendors`)[0].n),
    customers: Number((await sql`select count(*)::int as n from customers`)[0].n),
    products: Number((await sql`select count(*)::int as n from products`)[0].n),
    departments: Number((await sql`select count(*)::int as n from departments`)[0].n),
    documents: Number((await sql`select count(*)::int as n from documents`)[0].n),
    journalLines: Number((await sql`select count(*)::int as n from journal_lines`)[0].n),
  };

  const unbalancedRows = await sql`
    select
      jl.document_id,
      round(sum(jl.debit)::numeric, 2) as debit_total,
      round(sum(jl.credit)::numeric, 2) as credit_total
    from journal_lines jl
    group by jl.document_id
    having abs(round(sum(jl.debit)::numeric, 2) - round(sum(jl.credit)::numeric, 2)) > 0.05
    limit 200
  `;

  const report = {
    generatedAt: new Date().toISOString(),
    counts: {
      legacy: {
        tenants: legacy.tenants.length,
        profiles: legacy.profiles.length,
        tenantAssignments: legacy.tenantAssignments.length,
        chartOfAccounts: legacy.chartOfAccounts.length,
        vendors: legacy.vendors.length,
        customers: legacy.customers.length,
        products: legacy.products.length,
        departments: legacy.departments.length,
        documents: legacy.documents.length,
        journalLines: legacy.journalLines.length,
      },
      postgres: dbCounts,
    },
    countDiff: {
      tenants: dbCounts.tenants - legacy.tenants.length,
      profiles: dbCounts.profiles - legacy.profiles.length,
      tenantAssignments: dbCounts.tenantAssignments - legacy.tenantAssignments.length,
      chartOfAccounts: dbCounts.chartOfAccounts - legacy.chartOfAccounts.length,
      vendors: dbCounts.vendors - legacy.vendors.length,
      customers: dbCounts.customers - legacy.customers.length,
      products: dbCounts.products - legacy.products.length,
      departments: dbCounts.departments - legacy.departments.length,
      documents: dbCounts.documents - legacy.documents.length,
      journalLines: dbCounts.journalLines - legacy.journalLines.length,
    },
    unbalancedJournalDocuments: unbalancedRows,
  };

  const outPath = path.join(exportDir, "reconciliation-report.json");
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  await sql.end();
  console.log("Reconciliation report:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


import { promises as fs } from "fs";
import path from "path";

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function main() {
  const dir = readArg("output", process.env.LEGACY_EXPORT_DIR || "legacy-export");
  const files = [
    "tenants.json",
    "profiles.json",
    "tenant_assignments.json",
    "chart_of_accounts.json",
    "vendors.json",
    "customers.json",
    "products.json",
    "departments.json",
    "documents.json",
    "journal_lines.json",
  ];

  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(dir, fileName);
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, "[]\n", "utf8");
      }
    })
  );
  console.log(`Legacy export template ready at: ${dir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

function run(command, args = []) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("close", (code) => {
      resolve({
        command: `${command} ${args.join(" ")}`.trim(),
        code: code ?? 1,
        elapsedMs: Date.now() - startedAt,
      });
    });
  });
}

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function main() {
  const baseUrl = getArg("baseUrl", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  const results = [];
  results.push(await run("npm", ["run", "lint"]));
  results.push(await run("npm", ["run", "build"]));
  results.push(await run("npm", ["run", "smoke:test", "--", `--baseUrl=${baseUrl}`]));

  const passed = results.every((r) => r.code === 0);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    passed,
    results,
  };

  const reportsDir = path.join(process.cwd(), "docs", "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, `release-preflight-${Date.now()}.json`);
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Preflight report: ${outputPath}`);
  if (!passed) process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


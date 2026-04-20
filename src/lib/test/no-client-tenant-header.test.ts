import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("no client-side x-tenant-id headers", () => {
  it("no file under src/app or src/lib/hooks sets the x-tenant-id header", () => {
    const root = path.resolve(__dirname, "../../..");
    const dirs = [
      path.join(root, "src", "app"),
      path.join(root, "src", "lib", "hooks"),
      path.join(root, "src", "components"),
    ];
    const offenders: Array<{ file: string; lineNo: number; line: string }> = [];

    for (const dir of dirs) {
      for (const file of walk(dir)) {
        // Skip middleware and request-context — those are server-side and
        // allowed to inject x-tenant-id headers downstream.
        if (file.includes("middleware") || file.includes("request-context")) continue;
        const content = readFileSync(file, "utf8");
        if (!content.includes("x-tenant-id")) continue;
        content.split(/\r?\n/).forEach((line, i) => {
          if (line.includes('"x-tenant-id"') || line.includes("'x-tenant-id'")) {
            offenders.push({ file, lineNo: i + 1, line: line.trim() });
          }
        });
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file}:${o.lineNo}\n    ${o.line}`)
        .join("\n\n");
      throw new Error(
        `Found ${offenders.length} client-side x-tenant-id references.\n` +
          `Middleware injects x-tenant-id from the cookie; client code must not set it.\n\n` +
          report
      );
    }
    expect(offenders).toEqual([]);
  });
});

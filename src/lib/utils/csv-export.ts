"use client";

/**
 * Escape a CSV field value: wrap in quotes if it contains commas, newlines, or quotes.
 * Double any embedded quotes per RFC 4180.
 */
function escapeField(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV file from columns and rows and trigger a browser download.
 *
 * - Prepends UTF-8 BOM so Excel correctly handles Thai text.
 * - Quotes fields containing commas or newlines.
 * - Creates a temporary anchor element to trigger the download.
 */
export function exportToCsv(
  columns: string[],
  rows: string[][],
  filename: string,
): void {
  const headerLine = columns.map(escapeField).join(",");
  const dataLines = rows.map((row) => row.map(escapeField).join(","));
  const csvContent = [headerLine, ...dataLines].join("\n");

  // UTF-8 BOM for proper Thai text rendering in Excel
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

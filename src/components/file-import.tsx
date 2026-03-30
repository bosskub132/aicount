"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, FileText } from "lucide-react";
import { Button } from "@/components/button";
import { Select } from "@/components/select";

export type EntityType = "coa" | "vendor" | "customer" | "department" | "product";

interface ColumnDef {
  key: string;
  label: string;
  required: boolean;
}

interface FileImportProps {
  entityType: EntityType;
  onImport: (rows: Record<string, string>[]) => void | Promise<void>;
  maxRows?: number;
}

const COLUMN_DEFS: Record<EntityType, ColumnDef[]> = {
  coa: [
    { key: "accountCode", label: "Account Code", required: true },
    { key: "accountName", label: "Account Name", required: true },
    { key: "category", label: "Category", required: true },
    { key: "isSuspense", label: "Suspense", required: false },
    { key: "parentCode", label: "Parent Code", required: false },
  ],
  vendor: [
    { key: "taxId", label: "Tax ID", required: true },
    { key: "name", label: "Name", required: true },
    { key: "address", label: "Address", required: false },
    { key: "vendorType", label: "Type (company/individual)", required: false },
    { key: "branchNumber", label: "Branch Number", required: false },
    { key: "country", label: "Country", required: false },
    { key: "isNonResident", label: "Non-Resident", required: false },
    { key: "defaultExpenseGl", label: "Default Expense GL", required: false },
    { key: "defaultWhtRate", label: "Default WHT Rate", required: false },
  ],
  customer: [
    { key: "taxId", label: "Tax ID", required: true },
    { key: "name", label: "Name", required: true },
    { key: "address", label: "Address", required: false },
    { key: "creditTermDays", label: "Credit Term Days", required: false },
    { key: "creditLimit", label: "Credit Limit", required: false },
    { key: "branchNumber", label: "Branch Number", required: false },
  ],
  department: [
    { key: "deptCode", label: "Department Code", required: true },
    { key: "deptName", label: "Department Name", required: true },
  ],
  product: [
    { key: "itemCode", label: "Item Code", required: true },
    { key: "itemName", label: "Item Name", required: true },
    { key: "keywords", label: "Keywords", required: false },
    { key: "incomeGl", label: "Income GL", required: false },
    { key: "expenseGl", label: "Expense GL", required: false },
  ],
};

const ENTITY_LABELS: Record<EntityType, string> = {
  coa: "Chart of Accounts",
  vendor: "Vendors",
  customer: "Customers",
  department: "Departments",
  product: "Products",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const PREVIEW_ROWS = 5;

function autoMapColumns(headers: string[], columns: ColumnDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const col of columns) {
    const match = headers.find(
      (h) =>
        h.toLowerCase().includes(col.key.toLowerCase()) ||
        h.toLowerCase().includes(col.label.toLowerCase())
    );
    if (match) {
      mapping[col.key] = match;
    }
  }
  return mapping;
}

function buildMappedRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>
): Record<string, string>[] {
  return rawRows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [entityKey, fileHeader] of Object.entries(mapping)) {
      mapped[entityKey] = row[fileHeader] ?? "";
    }
    return mapped;
  });
}

function validateRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>,
  columns: ColumnDef[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredCols = columns.filter((c) => c.required);
  const unmapped = requiredCols.filter((c) => !mapping[c.key]);

  if (unmapped.length > 0) {
    for (const col of unmapped) {
      errors.push(`Required column "${col.label}" is not mapped`);
    }
    return { errors, warnings };
  }

  let missingValueCount = 0;
  for (const row of rawRows) {
    for (const col of requiredCols) {
      const header = mapping[col.key];
      if (!header || !row[header]?.trim()) {
        missingValueCount++;
      }
    }
  }

  if (missingValueCount > 0) {
    errors.push(`${missingValueCount} required field value(s) are empty across rows`);
  }

  const optionalUnmapped = columns.filter((c) => !c.required && !mapping[c.key]);
  if (optionalUnmapped.length > 0) {
    warnings.push(`${optionalUnmapped.length} optional column(s) not mapped: ${optionalUnmapped.map((c) => c.label).join(", ")}`);
  }

  return { errors, warnings };
}

export function FileImport({ entityType, onImport, maxRows = 5000 }: FileImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const columns = COLUMN_DEFS[entityType];

  const processFile = useCallback(
    async (selectedFile: File) => {
      setParseError(null);
      setValidationErrors([]);
      setValidationWarnings([]);
      setImported(false);

      if (selectedFile.size > MAX_FILE_SIZE) {
        setParseError("File exceeds 5MB limit");
        return;
      }

      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      try {
        if (ext === "csv") {
          const Papa = (await import("papaparse")).default;
          const result = await new Promise<{ data: Record<string, string>[]; errors: { message: string }[] }>(
            (resolve, reject) => {
              Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (r) => resolve(r as { data: Record<string, string>[]; errors: { message: string }[] }),
                error: (err: Error) => reject(err),
              });
            }
          );
          if (result.errors.length > 0) {
            setParseError(`Parse error: ${result.errors[0].message}`);
            return;
          }
          rows = result.data.slice(0, maxRows);
          headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        } else if (ext === "xlsx" || ext === "xls") {
          const ExcelJS = (await import("exceljs")).default;
          const workbook = new ExcelJS.Workbook();
          const buffer = await selectedFile.arrayBuffer();
          await workbook.xlsx.load(buffer);
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            setParseError("No worksheet found in file");
            return;
          }
          const allRows = worksheet.getSheetValues() as (string | number | null | undefined)[][];
          const rawRows = allRows.filter(Boolean);
          if (rawRows.length < 2) {
            setParseError("File must have a header row and at least one data row");
            return;
          }
          // Row 1 = headers (index 1 in ExcelJS 1-based array, but getSheetValues returns undefined at [0])
          const headerRow = rawRows[0] as (string | number | null | undefined)[];
          headers = headerRow.slice(1).map((h) => String(h ?? "").trim()).filter(Boolean);
          rows = rawRows
            .slice(1, maxRows + 1)
            .map((row) => {
              const r = row as (string | number | null | undefined)[];
              const obj: Record<string, string> = {};
              headers.forEach((h, i) => {
                obj[h] = String(r[i + 1] ?? "").trim();
              });
              return obj;
            });
        } else {
          setParseError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file");
          return;
        }
      } catch (err) {
        setParseError(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`);
        return;
      }

      const mapping = autoMapColumns(headers, columns);
      const { errors, warnings } = validateRows(rows, mapping, columns);

      setFile(selectedFile);
      setFileHeaders(headers);
      setFileRows(rows);
      setColumnMapping(mapping);
      setValidationErrors(errors);
      setValidationWarnings(warnings);
    },
    [columns, maxRows]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) {
        processFile(dropped);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        processFile(selected);
      }
      // reset input so same file can be re-selected
      e.target.value = "";
    },
    [processFile]
  );

  const handleMappingChange = useCallback(
    (entityKey: string, fileHeader: string) => {
      const newMapping = { ...columnMapping, [entityKey]: fileHeader };
      if (!fileHeader) {
        delete newMapping[entityKey];
      }
      setColumnMapping(newMapping);
      const { errors, warnings } = validateRows(fileRows, newMapping, columns);
      setValidationErrors(errors);
      setValidationWarnings(warnings);
    },
    [columnMapping, fileRows, columns]
  );

  const handleImport = useCallback(async () => {
    if (validationErrors.length > 0 || importing) return;
    setImporting(true);
    try {
      const mappedRows = buildMappedRows(fileRows, columnMapping);
      await onImport(mappedRows);
      setImported(true);
    } finally {
      setImporting(false);
    }
  }, [validationErrors, importing, fileRows, columnMapping, onImport]);

  const reset = useCallback(() => {
    setFile(null);
    setFileHeaders([]);
    setFileRows([]);
    setColumnMapping({});
    setParseError(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setImported(false);
  }, []);

  const headerOptions = [
    { value: "", label: "— not mapped —" },
    ...fileHeaders.map((h) => ({ value: h, label: h })),
  ];

  const previewRows = fileRows.slice(0, PREVIEW_ROWS);
  const mappedColumns = columns.filter((c) => columnMapping[c.key]);
  const readyCount = fileRows.length - (validationErrors.some((e) => e.includes("empty")) ? 1 : 0);

  // Drop zone (no file selected or parse error)
  if (!file || parseError) {
    return (
      <div className="flex flex-col gap-4">
        {parseError && (
          <div className="flex items-start gap-2 rounded-[var(--radius-input)] bg-[var(--destructive-light)] border border-[var(--destructive)] px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
            <span className="text-sm text-[var(--destructive)]">{parseError}</span>
          </div>
        )}
        <label
          className={`flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed cursor-pointer transition-colors py-12 px-6 text-center ${
            isDragging
              ? "border-[var(--primary)] bg-[var(--primary-light)]"
              : "border-[var(--border)] bg-[var(--muted)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className={`h-8 w-8 ${isDragging ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Drop your file here, or click to browse
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Supports .csv, .xlsx, .xls — max 5MB, up to {maxRows.toLocaleString()} rows
            </span>
          </div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={handleFileSelect}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* File info bar */}
      <div className="flex items-center justify-between rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--card)] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {file.name.endsWith(".csv") ? (
            <FileText className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
          )}
          <span className="text-sm font-medium text-[var(--foreground)] truncate">{file.name}</span>
          <span className="text-xs text-[var(--muted-foreground)] shrink-0">
            {fileRows.length.toLocaleString()} rows
          </span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="ml-2 shrink-0 rounded-[var(--radius-input)] p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Column mapping */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Map Columns — {ENTITY_LABELS[entityType]}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {columns.map((col) => (
            <Select
              key={col.key}
              label={col.label}
              required={col.required}
              options={headerOptions}
              value={columnMapping[col.key] ?? ""}
              onChange={(val) => handleMappingChange(col.key, val)}
              placeholder="— not mapped —"
            />
          ))}
        </div>
      </div>

      {/* Preview table */}
      {mappedColumns.length > 0 && previewRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Preview (first {Math.min(PREVIEW_ROWS, fileRows.length)} rows)
          </h3>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                  {mappedColumns.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2 text-left font-medium text-[var(--muted-foreground)] whitespace-nowrap"
                    >
                      {col.label}
                      {col.required && (
                        <span className="text-[var(--destructive)] ml-0.5">*</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)] transition-colors"
                  >
                    {mappedColumns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-[var(--foreground)] max-w-[180px] truncate"
                      >
                        {row[columnMapping[col.key]] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation summary */}
      <div className="flex flex-col gap-2">
        {validationErrors.length > 0 && (
          <div className="flex flex-col gap-1">
            {validationErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-[var(--radius-input)] bg-[var(--destructive-light)] border border-[var(--destructive)] px-3 py-2"
              >
                <AlertTriangle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--destructive)]">{err}</span>
              </div>
            ))}
          </div>
        )}
        {validationWarnings.length > 0 && (
          <div className="flex flex-col gap-1">
            {validationWarnings.map((warn, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-[var(--radius-input)] bg-[var(--warning-light,var(--muted))] border border-[var(--warning,var(--border))] px-3 py-2"
              >
                <AlertTriangle className="h-4 w-4 text-[var(--warning,var(--muted-foreground))] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--warning,var(--muted-foreground))]">{warn}</span>
              </div>
            ))}
          </div>
        )}
        {validationErrors.length === 0 && fileRows.length > 0 && (
          <div className="flex items-center gap-2 rounded-[var(--radius-input)] bg-[var(--success-light)] border border-[var(--success)] px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
            <span className="text-sm text-[var(--success)]">
              {fileRows.length.toLocaleString()} rows ready to import
              {validationWarnings.length > 0 && ` · ${validationWarnings.length} warning(s)`}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {imported ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--success)]">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              {fileRows.length.toLocaleString()} rows imported successfully
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={reset}>
            Choose another file
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={reset}>
            Change file
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={importing}
            disabled={validationErrors.length > 0 || fileRows.length === 0}
            onClick={handleImport}
          >
            Import {fileRows.length > 0 ? `${fileRows.length.toLocaleString()} rows` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

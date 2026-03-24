"use client";

import { Suspense, useState, useCallback } from "react";
import { Info, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { useToast } from "@/lib/stores/ui-store";
import { useReportRetention, useUpdateRetentionPolicy } from "@/lib/hooks/use-report-retention";
import { ConfirmDialog, type Change } from "./confirm-dialog";

type TimeUnit = "days" | "months" | "years";

interface FormState {
  trashDays: number;
  draftDays: number;
  locked: Record<string, { value: number; unit: TimeUnit }>;
}

interface LockedRow {
  key: string;
  category: string;
  reports: string;
  legalBasis: string;
  isLegalRequired: boolean;
}

const UNIT_OPTIONS = [
  { label: "days", value: "days" },
  { label: "months", value: "months" },
  { label: "years", value: "years" },
];

const LOCKED_ROWS: LockedRow[] = [
  { key: "financial_statements", category: "Financial Statements / งบการเงิน", reports: "Trial Balance, P&L, Balance Sheet, Cash Flow", legalBasis: "พ.ร.บ.การบัญชี ม.14", isLegalRequired: true },
  { key: "tax_reports", category: "Tax Reports / รายงานภาษี", reports: "ภ.พ.30, ภ.ง.ด.3, ภ.ง.ด.53, VAT Registers", legalBasis: "ป.รัษฎากร ม.87/3", isLegalRequired: true },
  { key: "wht_certificates", category: "WHT Certificates / หนังสือรับรองหัก ณ ที่จ่าย", reports: "50 ทวิ", legalBasis: "ป.รัษฎากร ม.50 ทวิ", isLegalRequired: true },
  { key: "management_reports", category: "Management Reports / รายงานบริหาร", reports: "Monthly Comparison, GL Detail, Journal Listing", legalBasis: "No legal requirement", isLegalRequired: false },
];

const DEFAULT_LOCKED: Record<string, { value: number; unit: TimeUnit }> = {
  financial_statements: { value: 7, unit: "years" },
  tax_reports: { value: 7, unit: "years" },
  wht_certificates: { value: 7, unit: "years" },
  management_reports: { value: 2, unit: "years" },
};

function retentionInYears(val: number, unit: TimeUnit): number {
  if (unit === "years") return val;
  if (unit === "months") return val / 12;
  return val / 365;
}

function toLabel(val: number, unit: TimeUnit): string {
  return `${val} ${unit}`;
}

/* Validation */

interface ValidationErrors {
  trashDays?: string;
  draftDays?: string;
  locked?: Record<string, string>;
}

function validate(form: FormState): ValidationErrors {
  const errors: ValidationErrors = {};
  if (form.trashDays < 1 || form.trashDays > 30) errors.trashDays = "Must be between 1 and 30 days";
  if (form.draftDays < 1 || form.draftDays > 90) errors.draftDays = "Must be between 1 and 90 days";
  const lockedErrors: Record<string, string> = {};
  for (const row of LOCKED_ROWS) {
    const entry = form.locked[row.key];
    if (!entry) continue;
    if (entry.value < 1) lockedErrors[row.key] = "Value must be at least 1";
    else if (retentionInYears(entry.value, entry.unit) > 99) lockedErrors[row.key] = "Maximum retention is 99 years";
  }
  if (Object.keys(lockedErrors).length > 0) errors.locked = lockedErrors;
  return errors;
}

function hasErrors(e: ValidationErrors): boolean {
  return !!(e.trashDays || e.draftDays || (e.locked && Object.keys(e.locked).length > 0));
}

function detectChanges(initial: FormState, current: FormState): Change[] {
  const changes: Change[] = [];
  if (initial.trashDays !== current.trashDays)
    changes.push({ field: "Trash Recovery Period", oldValue: `${initial.trashDays} days`, newValue: `${current.trashDays} days` });
  if (initial.draftDays !== current.draftDays)
    changes.push({ field: "Draft Reports", oldValue: `${initial.draftDays} days`, newValue: `${current.draftDays} days` });
  for (const row of LOCKED_ROWS) {
    const o = initial.locked[row.key], n = current.locked[row.key];
    if (!o || !n) continue;
    if (o.value !== n.value || o.unit !== n.unit)
      changes.push({ field: row.category, oldValue: toLabel(o.value, o.unit), newValue: toLabel(n.value, n.unit) });
  }
  return changes;
}

/* Sub-components */

function LifecyclePopover({ onClose }: { onClose: () => void }) {
  const stages = [
    { label: "Generated", sub: "Draft", color: "bg-slate-400" },
    { label: "Locked", sub: "Official", color: "bg-blue-500" },
    { label: "Expiring", sub: "Warning", color: "bg-amber-500" },
    { label: "Trash", sub: "Recovery", color: "bg-orange-500" },
    { label: "Deleted", sub: "Permanent", color: "bg-red-500" },
  ];
  return (
    <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-[var(--border)] bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">Report Lifecycle</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
      </div>
      <div className="flex items-center gap-1">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <span className={`h-3 w-3 rounded-full ${s.color}`} />
              <span className="mt-1 text-[10px] font-medium text-[var(--foreground)]">{s.label}</span>
              <span className="text-[9px] text-[var(--muted-foreground)]">{s.sub}</span>
            </div>
            {i < stages.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ icon, title, badge, badgeColor, description, children }: {
  icon: React.ReactNode; title: string; badge?: string; badgeColor?: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeColor ?? "bg-slate-100 text-slate-600"}`}>{badge}</span>}
      </div>
      <p className="mb-4 text-xs text-[var(--muted-foreground)]">{description}</p>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

/* Main content */

function RetentionPageContent() {
  const { data, isLoading } = useReportRetention();
  const mutation = useUpdateRetentionPolicy();
  const toast = useToast();
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const buildFormState = useCallback((src?: Record<string, unknown>): FormState => ({
    trashDays: Number(src?.trashDays ?? 7),
    draftDays: Number(src?.draftDays ?? 30),
    locked: LOCKED_ROWS.reduce((acc, row) => {
      const saved = (src?.locked as Record<string, { value: number; unit: TimeUnit }> | undefined)?.[row.key];
      acc[row.key] = saved ? { value: saved.value, unit: saved.unit } : { ...DEFAULT_LOCKED[row.key] };
      return acc;
    }, {} as Record<string, { value: number; unit: TimeUnit }>),
  }), []);

  const [initialState, setInitialState] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  if (data && !initialState) {
    const s = buildFormState(data);
    setInitialState(s);
    setForm(s);
  }
  if (!initialState && !isLoading && !data) {
    const s = buildFormState();
    setInitialState(s);
    setForm(s);
  }

  if (isLoading || !form || !initialState) return <LoadingSkeleton />;

  const errors = validate(form);
  const changes = detectChanges(initialState, form);
  const hasChanges = changes.length > 0;

  const legalWarning = changes.some((c) => {
    const row = LOCKED_ROWS.find((r) => r.category === c.field);
    if (!row || !row.isLegalRequired || row.key === "wht_certificates") return false;
    const entry = form.locked[row.key];
    return entry && retentionInYears(entry.value, entry.unit) < 5;
  });

  const reductionWarning = changes.some((c) => {
    const row = LOCKED_ROWS.find((r) => r.category === c.field);
    if (!row) return false;
    const o = initialState.locked[row.key], n = form.locked[row.key];
    return o && n && retentionInYears(n.value, n.unit) < retentionInYears(o.value, o.unit);
  });

  function updateLocked(key: string, field: "value" | "unit", val: number | string) {
    setForm((prev) => prev ? { ...prev, locked: { ...prev.locked, [key]: { ...prev.locked[key], [field]: field === "value" ? Number(val) : val } } } : prev);
  }

  function handleSave() {
    if (hasErrors(errors)) { toast.error("Please fix validation errors before saving"); return; }
    setShowConfirm(true);
  }

  function confirmSave() {
    if (!form) return;
    mutation.mutate({ trashDays: form.trashDays, draftDays: form.draftDays, locked: form.locked }, {
      onSuccess: () => { setInitialState({ ...form }); setShowConfirm(false); },
      onSettled: () => { setShowConfirm(false); },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Report Retention Policy</h1>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">นโยบายการเก็บรักษารายงาน</p>
        </div>
        <button onClick={() => setShowLifecycle((v) => !v)} className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-slate-100 hover:text-[var(--foreground)]" aria-label="Show report lifecycle">
          <Info className="h-5 w-5" />
        </button>
        {showLifecycle && <LifecyclePopover onClose={() => setShowLifecycle(false)} />}
      </div>

      {/* Trash Recovery Period */}
      <SectionCard icon={<Trash2 className="h-4 w-4 text-orange-500" />} title="Trash Recovery Period" description="Expired or deleted reports can be restored from Trash within this period.">
        <div className="flex items-center gap-2">
          <Input type="number" value={form.trashDays} onChange={(e) => setForm({ ...form, trashDays: Number(e.target.value) })} className="w-24" min={1} max={30} error={errors.trashDays} />
          <span className="text-sm text-[var(--muted-foreground)]">days</span>
        </div>
      </SectionCard>

      {/* Draft Reports */}
      <SectionCard icon={<span className="h-2.5 w-2.5 rounded-full bg-amber-400" />} title="Draft Reports" badge="Auto-cleanup" badgeColor="bg-amber-50 text-amber-700" description="Unlocked report versions. Working copies generated during month-end close.">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">Keep for</span>
          <Input type="number" value={form.draftDays} onChange={(e) => setForm({ ...form, draftDays: Number(e.target.value) })} className="w-24" min={1} max={90} error={errors.draftDays} />
          <span className="text-sm text-[var(--muted-foreground)]">days</span>
        </div>
      </SectionCard>

      {/* Locked Reports Table */}
      <SectionCard icon={<span className="h-2.5 w-2.5 rounded-full bg-blue-500" />} title="Locked Reports (Official)" badge="Retention policy" badgeColor="bg-blue-50 text-blue-700" description="Official locked report versions subject to legal retention requirements.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                <th className="pb-2 pr-4">Report Category</th>
                <th className="pb-2 pr-4">Reports Included</th>
                <th className="pb-2 pr-4">Retention</th>
                <th className="pb-2">Legal Basis</th>
              </tr>
            </thead>
            <tbody>
              {LOCKED_ROWS.map((row) => {
                const entry = form.locked[row.key];
                const lockedError = errors.locked?.[row.key];
                return (
                  <tr key={row.key} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 pr-4 font-medium text-[var(--foreground)]">{row.category}</td>
                    <td className="py-3 pr-4 text-[var(--muted-foreground)]">{row.reports}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Input type="number" value={entry.value} onChange={(e) => updateLocked(row.key, "value", Number(e.target.value))} className="w-20" min={1} error={lockedError} />
                        <Select options={UNIT_OPTIONS} value={entry.unit} onChange={(v) => updateLocked(row.key, "unit", v)} />
                      </div>
                    </td>
                    <td className="py-3">
                      {row.isLegalRequired
                        ? <span className="text-[var(--foreground)]">{row.legalBasis}</span>
                        : <span className="italic text-[var(--muted-foreground)]">{row.legalBasis}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || mutation.isPending} loading={mutation.isPending}>Save Policy</Button>
      </div>

      <ConfirmDialog open={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={confirmSave} loading={mutation.isPending} changes={changes} reductionWarning={reductionWarning} legalWarning={legalWarning} />
    </div>
  );
}

export default function ReportRetentionPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <RetentionPageContent />
    </Suspense>
  );
}

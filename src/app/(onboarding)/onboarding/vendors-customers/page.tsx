"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Store, Trash2, X } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Tabs } from "@/components/tabs";
import { FileImport } from "@/components/file-import";
import { SuggestionPill } from "@/components/suggestion-pill";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

interface VendorRow {
  name: string;
  taxId: string;
  vendorType: string;
  branchNumber: string;
  address: string;
  defaultWhtRate: string;
  _local?: boolean;
  _duplicate?: boolean;
  [key: string]: unknown;
}

interface CustomerRow {
  name: string;
  taxId: string;
  branchNumber: string;
  address: string;
  creditTermDays: string;
  _local?: boolean;
  _duplicate?: boolean;
  [key: string]: unknown;
}

const VENDOR_TYPE_OPTIONS = [
  { value: "company", label: "Company" },
  { value: "individual", label: "Individual" },
];

const WHT_RATE_OPTIONS = [
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "5", label: "5%" },
  { value: "10", label: "10%" },
  { value: "15", label: "15%" },
];

export default function OnboardingVendorsCustomersPage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [activeTab, setActiveTab] = useState("vendors");
  const [vendorMode, setVendorMode] = useState<"manual" | "import">("manual");
  const [customerMode, setCustomerMode] = useState<"manual" | "import">("manual");
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  // Vendor form fields
  const [vName, setVName] = useState("");
  const [vTaxId, setVTaxId] = useState("");
  const [vType, setVType] = useState("company");
  const [vBranch, setVBranch] = useState("");
  const [vAddress, setVAddress] = useState("");
  const [vWhtRate, setVWhtRate] = useState("3");

  // Customer form fields
  const [cName, setCName] = useState("");
  const [cTaxId, setCTaxId] = useState("");
  const [cBranch, setCBranch] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cCreditDays, setCCreditDays] = useState("30");

  // UI state
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whtSuggestions, setWhtSuggestions] = useState<
    Array<{ vendorTaxId: string; fieldName: string; suggestedValue: string; confidence: number }>
  >([]);

  useEffect(() => {
    const tid = getWorkspaceTenantId();
    setTenantId(tid);
    if (!tid) {
      setFetching(false);
      return;
    }

    Promise.all([
      fetch(`/api/tenants/${tid}/vendors`).then((r) => r.json()),
      fetch(`/api/tenants/${tid}/customers`).then((r) => r.json()),
    ])
      .then(
        ([vJson, cJson]: [
          { success: boolean; data?: VendorRow[] },
          { success: boolean; data?: CustomerRow[] },
        ]) => {
          if (vJson.success) setVendors(vJson.data || []);
          if (cJson.success) setCustomers(cJson.data || []);
        }
      )
      .catch(() => {
        // Ignore load errors -- user can still add entries
      })
      .finally(() => setFetching(false));
  }, []);

  // Fetch WHT suggestions when vendors with tax IDs exist
  useEffect(() => {
    if (!tenantId) return;
    const taxIds = vendors.map((v) => v.taxId).filter(Boolean);
    if (taxIds.length === 0) return;
    fetch(`/api/onboarding/suggestions?step=vendors&vendorTaxIds=${taxIds.join(",")}`)
      .then((r) => r.json())
      .then((data: { suggestions?: typeof whtSuggestions }) =>
        setWhtSuggestions(data.suggestions ?? [])
      )
      .catch(() => {});
  }, [tenantId, vendors.length]);

  function resetVendorForm() {
    setVName("");
    setVTaxId("");
    setVType("company");
    setVBranch("");
    setVAddress("");
    setVWhtRate("3");
  }

  function resetCustomerForm() {
    setCName("");
    setCTaxId("");
    setCBranch("");
    setCAddress("");
    setCCreditDays("30");
  }

  function handleAddVendor() {
    if (!vName.trim() || !vTaxId.trim()) return;
    setVendors((prev) => [
      ...prev,
      {
        name: vName.trim(),
        taxId: vTaxId.trim(),
        vendorType: vType,
        branchNumber: vBranch.trim(),
        address: vAddress.trim(),
        defaultWhtRate: vWhtRate,
        _local: true,
      },
    ]);
    resetVendorForm();
  }

  function handleAddCustomer() {
    if (!cName.trim() || !cTaxId.trim()) return;
    setCustomers((prev) => [
      ...prev,
      {
        name: cName.trim(),
        taxId: cTaxId.trim(),
        branchNumber: cBranch.trim(),
        address: cAddress.trim(),
        creditTermDays: cCreditDays.trim(),
        _local: true,
      },
    ]);
    resetCustomerForm();
  }

  function handleRemoveVendor(index: number) {
    setVendors((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRemoveCustomer(index: number) {
    setCustomers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleVendorImport(rows: Record<string, string>[]) {
    const newRows: VendorRow[] = rows.map((r) => ({
      name: r.name || "",
      taxId: r.taxId || "",
      vendorType: r.vendorType || "company",
      branchNumber: r.branchNumber || "",
      address: r.address || "",
      defaultWhtRate: r.defaultWhtRate || "3",
      _local: true,
    }));
    setVendors((prev) => {
      const combined = [...prev];
      for (const row of newRows) {
        const existingIdx = combined.findIndex((v) => v.taxId === row.taxId);
        if (existingIdx >= 0) {
          combined[existingIdx] = { ...row, _duplicate: true };
        } else {
          combined.push(row);
        }
      }
      return combined;
    });
    setVendorMode("manual");
  }

  async function handleCustomerImport(rows: Record<string, string>[]) {
    const newRows: CustomerRow[] = rows.map((r) => ({
      name: r.name || "",
      taxId: r.taxId || "",
      branchNumber: r.branchNumber || "",
      address: r.address || "",
      creditTermDays: r.creditTermDays || "30",
      _local: true,
    }));
    setCustomers((prev) => {
      const combined = [...prev];
      for (const row of newRows) {
        const existingIdx = combined.findIndex((c) => c.taxId === row.taxId);
        if (existingIdx >= 0) {
          combined[existingIdx] = { ...row, _duplicate: true };
        } else {
          combined.push(row);
        }
      }
      return combined;
    });
    setCustomerMode("manual");
  }

  async function patchOnboardingStep(step: number) {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: step }),
    });
  }

  async function saveAndNext() {
    setError(null);
    setLoading(true);
    try {
      if (tenantId) {
        // Batch save all local vendors
        const localVendors = vendors.filter((v) => v._local);
        if (localVendors.length > 0) {
          const res = await fetch(`/api/tenants/${tenantId}/vendors/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: localVendors }),
          });
          if (!res.ok) {
            const json = (await res.json()) as { error?: string };
            throw new Error(json.error ?? "Failed to save vendors.");
          }
        }

        // Batch save all local customers
        const localCustomers = customers.filter((c) => c._local);
        if (localCustomers.length > 0) {
          const res = await fetch(`/api/tenants/${tenantId}/customers/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: localCustomers }),
          });
          if (!res.ok) {
            const json = (await res.json()) as { error?: string };
            throw new Error(json.error ?? "Failed to save customers.");
          }
        }
      }
      await patchOnboardingStep(4);
      router.push("/onboarding/departments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(4);
    router.push("/onboarding/departments");
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)]">
          <Store className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Vendors &amp; Customers
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Add your business partners for AP/AR tracking
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <Tabs
          tabs={[
            {
              label: "Vendors",
              value: "vendors",
              count: vendors.length || undefined,
            },
            {
              label: "Customers",
              value: "customers",
              count: customers.length || undefined,
            },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Form card */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {activeTab === "vendors"
            ? "Add vendors for accounts payable and WHT certificate generation."
            : "Add customers for accounts receivable and invoicing."}
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={(activeTab === "vendors" ? vendorMode : customerMode) === "manual" ? "primary" : "secondary"}
            size="sm"
            onClick={() => activeTab === "vendors" ? setVendorMode("manual") : setCustomerMode("manual")}
          >
            Manual Entry
          </Button>
          <Button
            variant={(activeTab === "vendors" ? vendorMode : customerMode) === "import" ? "primary" : "secondary"}
            size="sm"
            onClick={() => activeTab === "vendors" ? setVendorMode("import") : setCustomerMode("import")}
          >
            Import File
          </Button>
        </div>

        {activeTab === "vendors" && vendorMode === "import" && (
          <FileImport key="vendor-import" entityType="vendor" onImport={handleVendorImport} />
        )}
        {activeTab === "customers" && customerMode === "import" && (
          <FileImport key="customer-import" entityType="customer" onImport={handleCustomerImport} />
        )}
        {/* Cross-tenant WHT suggestions for vendors */}
        {activeTab === "vendors" && whtSuggestions.length > 0 && (
          <div className="mb-4 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
            <p className="mb-2 text-xs font-medium text-[#2563EB]">
              Suggested WHT rates based on common patterns
            </p>
            <div className="flex flex-wrap gap-2">
              {whtSuggestions.map((s, i) => (
                <SuggestionPill
                  key={i}
                  id={String(i)}
                  displayLabel={`${s.vendorTaxId}: WHT ${s.suggestedValue}%`}
                  confidence={s.confidence}
                  onAccept={() => {
                    // Apply suggested WHT rate to matching vendor
                    setVendors((prev) =>
                      prev.map((v) =>
                        v.taxId === s.vendorTaxId
                          ? { ...v, defaultWhtRate: s.suggestedValue }
                          : v
                      )
                    );
                    setWhtSuggestions((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  onDismiss={() => {
                    setWhtSuggestions((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "vendors" && vendorMode === "manual" ? (
          /* Vendor manual form */
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Vendor Name"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="Company or individual name"
              />
              <Input
                label="Tax ID"
                required
                value={vTaxId}
                onChange={(e) => setVTaxId(e.target.value)}
                maxLength={13}
                placeholder="13-digit tax ID"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Type"
                options={VENDOR_TYPE_OPTIONS}
                value={vType}
                onChange={setVType}
              />
              <Input
                label="Branch Number"
                value={vBranch}
                onChange={(e) => setVBranch(e.target.value)}
                placeholder="e.g. 00000"
              />
              <Select
                label="Default WHT Rate"
                options={WHT_RATE_OPTIONS}
                value={vWhtRate}
                onChange={setVWhtRate}
              />
            </div>
            <Input
              label="Address"
              value={vAddress}
              onChange={(e) => setVAddress(e.target.value)}
              placeholder="Full address (optional)"
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleAddVendor}
                disabled={!vName.trim() || !vTaxId.trim()}
              >
                Add Vendor
              </Button>
            </div>
          </div>
        ) : activeTab === "customers" && customerMode === "manual" ? (
          /* Customer manual form */
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Customer Name"
                required
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Company or individual name"
              />
              <Input
                label="Tax ID"
                required
                value={cTaxId}
                onChange={(e) => setCTaxId(e.target.value)}
                maxLength={13}
                placeholder="13-digit tax ID"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Branch Number"
                value={cBranch}
                onChange={(e) => setCBranch(e.target.value)}
                placeholder="e.g. 00000"
              />
              <Input
                label="Credit Term Days"
                type="number"
                value={cCreditDays}
                onChange={(e) => setCCreditDays(e.target.value)}
                placeholder="30"
              />
            </div>
            <Input
              label="Address"
              value={cAddress}
              onChange={(e) => setCAddress(e.target.value)}
              placeholder="Full address (optional)"
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleAddCustomer}
                disabled={!cName.trim() || !cTaxId.trim()}
              >
                Add Customer
              </Button>
            </div>
          </div>
        ) : null}

        {/* Data table */}
        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-[var(--border)]">
          {activeTab === "vendors" ? (
            vendors.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Tax ID
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                      WHT
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {vendors.map((row, i) => (
                    <tr key={i} className={`hover:bg-[var(--muted)] ${row._duplicate ? "bg-[var(--warning-light)]" : ""}`}>
                      <td className="px-4 py-2.5 text-[var(--foreground)]">
                        {row.name}
                        {row._duplicate && <span className="ml-1.5 text-[10px] font-medium text-[var(--warning)]">(updated)</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">
                        {row.taxId}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--muted-foreground)]">
                          {row.vendorType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--muted-foreground)]">
                        {row.defaultWhtRate ? `${row.defaultWhtRate}%` : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveVendor(i)}
                          className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive-light)] hover:text-[var(--destructive)]"
                          aria-label="Remove vendor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--muted-foreground)]">
                  No vendors added yet. You can add them here or later in
                  Settings.
                </p>
              </div>
            )
          ) : customers.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Tax ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Branch
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Credit Days
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {customers.map((row, i) => (
                  <tr key={i} className={`hover:bg-[var(--muted)] ${row._duplicate ? "bg-[var(--warning-light)]" : ""}`}>
                    <td className="px-4 py-2.5 text-[var(--foreground)]">
                      {row.name}
                      {row._duplicate && <span className="ml-1.5 text-[10px] font-medium text-[var(--warning)]">(updated)</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">
                      {row.taxId}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                      {row.branchNumber || "-"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--muted-foreground)]">
                      {row.creditTermDays || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomer(i)}
                        className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive-light)] hover:text-[var(--destructive)]"
                        aria-label="Remove customer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                No customers added yet. You can add them here or later in
                Settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive-light)] px-4 py-3 text-sm text-[var(--destructive)] flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 shrink-0 p-0.5 hover:opacity-70" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => router.push("/onboarding/chart-of-accounts")}
        >
          Back
        </Button>

        <Button variant="link" onClick={handleSkip}>
          I&apos;ll do this later
        </Button>

        <Button
          variant="primary"
          loading={loading}
          icon={<ArrowRight className="h-4 w-4" />}
          onClick={saveAndNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

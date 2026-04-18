"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/button";
import { Select } from "@/components/select";
import { useToast } from "@/lib/stores/ui-store";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

const WHT_RATE_OPTIONS = [
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "5", label: "5%" },
  { value: "10", label: "10%" },
  { value: "15", label: "15%" },
];

export default function AccountingTaxReportsPage() {
  const toast = useToast();
  const [tenantId, setTenantId] = useState("");
  const [taxId, setTaxId] = useState("");
  const [whtRate, setWhtRate] = useState("3");

  useEffect(() => {
    const id = getWorkspaceTenantId();
    setTenantId(id);

    const savedRate = localStorage.getItem("defaultWhtRate");
    if (savedRate) {
      setWhtRate(savedRate);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    async function fetchTenant() {
      try {
        const res = await fetch(`/api/tenants/${tenantId}`);
        const json = (await res.json()) as {
          success: boolean;
          data?: { taxId?: string };
          error?: string;
        };
        if (json.success && json.data?.taxId) {
          setTaxId(json.data.taxId);
        }
      } catch {
        // Silently fail — taxId will show "Not set"
      }
    }
    fetchTenant();
  }, [tenantId]);

  function handleSave() {
    localStorage.setItem("defaultWhtRate", whtRate);
    toast.success("Default WHT rate saved");
  }

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Tax Report Settings
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              No workspace selected. Please select a workspace to configure tax
              settings.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-[var(--muted-foreground)]" />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Tax Report Settings
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Configure tax reporting preferences.
          </p>
        </div>
      </div>

      {/* Card 1: Tax Filing Info */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Tax Filing Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)]">
              Filing Frequency
            </p>
            <p className="text-sm text-[var(--foreground)]">
              Monthly (required by Thai law)
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)]">
              VAT Rate
            </p>
            <p className="text-sm text-[var(--foreground)]">7%</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)]">
              Tax ID
            </p>
            <p className="text-sm font-mono text-[var(--foreground)]">
              {taxId || "Not set"}
            </p>
          </div>
          <Select
            label="Default WHT Rate"
            options={WHT_RATE_OPTIONS}
            value={whtRate}
            onChange={setWhtRate}
          />
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          WHT rate precedence: vendor-specific rate → workspace default → 3%
        </p>
        <div>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>

      {/* Card 2: Quick Links */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Tax Reports
        </h3>
        <div className="space-y-2">
          <Link
            href="/reports/tax"
            className="flex items-center gap-3 rounded-[var(--radius-input)] p-3 hover:bg-[var(--muted)] transition-colors"
          >
            <ClipboardList className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Tax Report Hub
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Generate ภ.พ.30, ภ.ง.ด.3, ภ.ง.ด.53, ภ.พ.36
              </p>
            </div>
          </Link>
          <Link
            href="/reports/wht"
            className="flex items-center gap-3 rounded-[var(--radius-input)] p-3 hover:bg-[var(--muted)] transition-colors"
          >
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                WHT Certificates
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Generate 50 ทวิ certificates
              </p>
            </div>
          </Link>
          <Link
            href="/reports/tax/purchase-vat"
            className="flex items-center gap-3 rounded-[var(--radius-input)] p-3 hover:bg-[var(--muted)] transition-colors"
          >
            <Receipt className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                VAT Registers
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Purchase & Sales VAT registers
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Users, User, CheckCircle2, KeyRound, X } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";

interface Invitation {
  email: string;
  role: "maker" | "checker";
}

const ROLE_OPTIONS = [
  { value: "maker", label: "Maker" },
  { value: "checker", label: "Checker" },
];

export default function OnboardingTeamPage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("maker");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const tid = localStorage.getItem("workspaceTenantId") || "";
    setTenantId(tid);

    if (!tid) {
      setFetching(false);
      return;
    }

    async function loadInvitations() {
      try {
        const res = await fetch(`/api/tenants/${tid}/invitations`, {
          headers: { "x-tenant-id": tid },
        });
        if (res.ok) {
          const json = (await res.json()) as { success: boolean; data: Invitation[] };
          if (json.success && Array.isArray(json.data)) {
            setInvitations(json.data);
          }
        }
      } catch {
        // Ignore load errors
      } finally {
        setFetching(false);
      }
    }

    loadInvitations();
  }, []);

  async function handleSendInvitation() {
    if (!email.trim() || !tenantId) return;
    setError(null);
    setSuccessMessage(null);
    setSending(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error ?? "Failed to send invitation.");
      }
      setInvitations((prev) => [...prev, { email: email.trim(), role: role as "maker" | "checker" }]);
      setEmail("");
      setSuccessMessage(`Invitation sent to ${email.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function patchOnboardingStep(step: number) {
    await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: step }),
    });
  }

  async function handleNext() {
    setError(null);
    setLoading(true);
    try {
      await patchOnboardingStep(6);
      router.push("/onboarding/template");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(6);
    router.push("/onboarding/template");
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
          <Users className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Invite Team</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Add team members to collaborate on your workspace</p>
        </div>
      </div>

      {/* Role descriptions card */}
      <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Roles</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-[var(--primary)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Maker</p>
              <p className="text-xs text-[var(--muted-foreground)]">Upload documents, edit extractions, create journal entries, record payments.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-[var(--success)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Checker</p>
              <p className="text-xs text-[var(--muted-foreground)]">Review & approve documents, post journal entries, generate reports and certificates.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <KeyRound className="h-4 w-4 text-[var(--warning)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Admin (workspace creator)</p>
              <p className="text-xs text-[var(--muted-foreground)]">Full access including settings, master data, member management, and workspace deletion.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
        <p className="mb-1 text-sm text-[var(--muted-foreground)]">
          As workspace creator, you already have both maker and checker roles. Invite others to collaborate.
        </p>
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Invited users will receive an email. If they haven&apos;t registered, they&apos;ll be guided to sign up first.
        </p>

        {/* Input row */}
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 min-w-48"
          />
          <Select
            options={ROLE_OPTIONS}
            value={role}
            onChange={setRole}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSendInvitation}
            disabled={!email.trim() || sending}
            loading={sending}
          >
            Send Invitation
          </Button>
        </div>

        {/* Success message */}
        {successMessage && (
          <p className="mt-3 text-sm text-[var(--success)]">{successMessage}</p>
        )}

        {/* Invitations list */}
        {invitations.length > 0 && (
          <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)]">
            <div className="bg-[var(--muted)] px-4 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Sent Invitations</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {invitations.map((inv, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-[var(--foreground)]">{inv.email}</span>
                  <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--foreground)]">
                    {inv.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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
          onClick={() => router.push("/onboarding/departments")}
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
          onClick={handleNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

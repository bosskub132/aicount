"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";

interface Invitation {
  email: string;
  role: "maker" | "checker";
}

export default function OnboardingTeamPage() {
  const router = useRouter();

  const [tenantId, setTenantId] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"maker" | "checker">("maker");
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
      setInvitations((prev) => [...prev, { email: email.trim(), role }]);
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
      await patchOnboardingStep(5);
      router.push("/onboarding/template");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await patchOnboardingStep(5);
    router.push("/onboarding/template");
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invite Team</h1>
          <p className="text-sm text-slate-500">Add team members to collaborate on your workspace</p>
        </div>
      </div>

      {/* Form card */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm text-slate-600">
          As workspace creator, you already have both maker and checker roles. Invite others to collaborate.
        </p>
        <p className="mb-4 text-xs text-slate-400">
          Invited users will receive an email. If they haven&apos;t registered, they&apos;ll be guided to sign up first.
        </p>

        {/* Input row */}
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "maker" | "checker")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="maker">Maker</option>
            <option value="checker">Checker</option>
          </select>
          <button
            type="button"
            onClick={handleSendInvitation}
            disabled={!email.trim() || sending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending…
              </>
            ) : (
              "Send Invitation"
            )}
          </button>
        </div>

        {/* Success message */}
        {successMessage && (
          <p className="mt-3 text-sm text-emerald-600">{successMessage}</p>
        )}

        {/* Invitations list */}
        {invitations.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="bg-slate-50 px-4 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sent Invitations</p>
            </div>
            <div className="divide-y divide-slate-100">
              {invitations.map((inv, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-900">{inv.email}</span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
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
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/onboarding/departments")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          I&apos;ll do this later
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving…
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

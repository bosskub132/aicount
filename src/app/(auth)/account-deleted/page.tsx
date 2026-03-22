"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AccountDeletedPage() {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  async function handleCancelDeletion() {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/auth/account/cancel-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to cancel deletion");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Account Scheduled for Deletion</h1>
          <p className="text-sm text-slate-500">
            Your account has been scheduled for deletion. You can cancel this to restore your access.
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          onClick={handleCancelDeletion}
          disabled={cancelling}
          className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <ArrowRight className="h-4 w-4" />
          {cancelling ? "Cancelling..." : "Cancel Deletion & Keep Account"}
        </button>
      </div>
    </div>
  );
}

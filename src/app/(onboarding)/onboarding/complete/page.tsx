"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    setCompleting(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnboardingComplete: true, onboardingStep: 6 }),
      });
      router.push("/dashboard");
    } catch {
      setCompleting(false);
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">You&apos;re all set!</h1>
      <p className="mb-8 text-sm text-slate-500">
        Your workspace is ready. You can always update these settings later.
      </p>
      <button
        onClick={handleComplete}
        disabled={completing}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {completing ? "Finishing..." : "Go to Dashboard"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, FileText, Users } from "lucide-react";

const INFO_CARDS = [
  {
    icon: Building2,
    title: "Create Workspace",
    description: "Set up your company profile and tax information.",
  },
  {
    icon: FileText,
    title: "Configure Accounts",
    description: "Import or customize your chart of accounts for Thai accounting.",
  },
  {
    icon: Users,
    title: "Invite Team",
    description: "Add team members and assign roles like maker and checker.",
  },
];

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStep: 1 }),
      });
    } catch {
      // Non-critical — proceed regardless
    }
    router.push("/onboarding/workspace");
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-3xl font-bold text-slate-900">Welcome to AiCount</h1>
      <p className="mt-3 max-w-md text-base text-slate-600">
        Let&apos;s set up your workspace in a few quick steps.
      </p>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
        {INFO_CARDS.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-10 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Starting…" : "Let's get started"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

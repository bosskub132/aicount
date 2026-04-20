"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, FileText, Users } from "lucide-react";
import { Button } from "@/components/button";

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
    router.push("/onboarding/workspace");
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Welcome to AiCount</h1>
      <p className="mt-3 max-w-md text-base text-[var(--muted-foreground)]">
        Let&apos;s set up your workspace in a few quick steps.
      </p>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
        {INFO_CARDS.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-light)]">
              <Icon className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
          </div>
        ))}
      </div>

      <Button variant="primary" size="lg" loading={loading} icon={<ArrowRight className="h-4 w-4" />} onClick={handleStart} className="mt-10">
        Let&apos;s get started
      </Button>
    </div>
  );
}

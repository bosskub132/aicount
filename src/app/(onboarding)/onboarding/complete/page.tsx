"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Lightbulb, Package } from "lucide-react";
import { Button } from "@/components/button";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    setCompleting(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnboardingComplete: true, onboardingStep: 7 }),
      });
      router.push("/dashboard");
    } catch {
      setCompleting(false);
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-light)]">
        <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">You&apos;re all set!</h1>
      <p className="mb-8 text-sm text-[var(--muted-foreground)]">
        Your workspace is ready. You can always update these settings later.
      </p>

      {/* Product hint card */}
      <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--info-light)] p-4 text-left">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-[var(--primary)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Speed up document processing</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Set up Products in Settings &rarr; Master Data to auto-map line items to GL accounts.
            </p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          variant="primary"
          loading={completing}
          onClick={handleComplete}
          icon={<ArrowRight className="h-4 w-4" />}
        >
          Go to Dashboard
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/settings/masterdata/products")}
          icon={<Package className="h-4 w-4" />}
        >
          Set up Products
        </Button>
      </div>
    </div>
  );
}

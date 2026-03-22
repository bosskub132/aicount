"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Welcome", path: "/onboarding" },
  { label: "Workspace", path: "/onboarding/workspace" },
  { label: "Accounts", path: "/onboarding/chart-of-accounts" },
  { label: "Departments", path: "/onboarding/departments" },
  { label: "Team", path: "/onboarding/team" },
  { label: "Template", path: "/onboarding/template" },
  { label: "Complete", path: "/onboarding/complete" },
];

function getCurrentStep(pathname: string): number {
  // Find the last matching step (most specific path wins)
  let found = 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (pathname === STEPS[i].path || pathname.startsWith(STEPS[i].path + "/")) {
      found = i;
    }
  }
  return found; // 0-based index
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentIndex = getCurrentStep(pathname);
  const totalSteps = STEPS.length;
  const stepNumber = currentIndex + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="text-lg font-semibold text-slate-900">AiCount Setup</span>
        </div>
      </header>

      {/* Progress section */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          {/* Step counter */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Step {stepNumber} of {totalSteps}
            </span>
            <span className="text-sm text-slate-500">{STEPS[currentIndex].label}</span>
          </div>

          {/* Progress bar segments */}
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= currentIndex ? "bg-blue-600" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          {/* Step labels — desktop only */}
          <div className="mt-3 hidden sm:flex">
            {STEPS.map((step, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i < currentIndex
                      ? "bg-blue-600 text-white"
                      : i === currentIndex
                        ? "border-2 border-blue-600 bg-white text-blue-600"
                        : "border border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {i < currentIndex ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                </div>
                <span
                  className={`text-xs ${
                    i <= currentIndex ? "font-medium text-slate-700" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="px-6 py-10">
        <div className="mx-auto max-w-[800px]">{children}</div>
      </main>
    </div>
  );
}

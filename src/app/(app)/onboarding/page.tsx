"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <section className="py-12 text-center">
      <p className="text-sm text-slate-500">Redirecting to settings...</p>
    </section>
  );
}

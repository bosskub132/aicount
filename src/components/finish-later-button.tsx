"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

type Tenant = { tenantId: string; isOnboardingComplete: boolean };

export function FinishLaterButton() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tenants", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: { data?: Tenant[] }) => setTenants(j.data ?? []))
      .catch(() => setTenants([]));
  }, []);

  const completeOthers = tenants.filter((t) => t.isOnboardingComplete);
  if (completeOthers.length === 0) return null;

  async function handleClick() {
    setLoading(true);
    const target = completeOthers[0].tenantId;
    await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: target }),
    });
    router.push("/");
  }

  return (
    <Button variant="secondary" type="button" onClick={handleClick} loading={loading}>
      Finish later
    </Button>
  );
}

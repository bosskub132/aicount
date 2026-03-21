/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [status, setStatus] = useState<"loading" | "ready" | "accepted" | "error">("loading");
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error || "Invalid invitation");
          setStatus("error");
          return;
        }
        setInvitation(json.data);
        setStatus("ready");
      })
      .catch(() => {
        setError("Failed to load invitation");
        setStatus("error");
      });
  }, [token]);

  async function acceptInvite() {
    setStatus("loading");
    const res = await fetch(`/api/invite/${token}`, { method: "POST" });
    const json = await res.json();

    if (!json.success) {
      setError(json.error || "Accept failed");
      setStatus("error");
      return;
    }

    if (json.data.requiresAuth) {
      router.push(`/signup?invite=${token}&email=${encodeURIComponent(json.data.email)}`);
      return;
    }

    setStatus("accepted");
    localStorage.setItem("workspaceTenantId", json.data.tenantId);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Loading invitation...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold text-red-600">Invitation Error</h1>
          <p className="text-slate-600">{error}</p>
          <button onClick={() => router.push("/login")} className="rounded bg-slate-900 px-4 py-2 text-white">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold text-emerald-600">Invitation Accepted</h1>
          <p className="text-slate-600">Redirecting to your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md space-y-4 rounded-lg border bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Workspace Invitation</h1>
        <p className="text-slate-600">
          You&apos;ve been invited to join <strong>{invitation?.tenantName}</strong> as a{" "}
          <strong>{invitation?.role}</strong>.
        </p>
        <button
          onClick={acceptInvite}
          className="w-full rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Accept Invitation
        </button>
        <button onClick={() => router.push("/login")} className="text-sm text-slate-500 hover:underline">
          Back to Login
        </button>
      </div>
    </div>
  );
}

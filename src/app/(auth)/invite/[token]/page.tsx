/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = params.token as string;
  const [status, setStatus] = useState<"loading" | "ready" | "accepted" | "error">("loading");
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error || "We couldn't load this invitation. Check the link or ask for a new one.");
          setStatus("error");
          return;
        }
        setInvitation(json.data);
        setStatus("ready");
      })
      .catch(() => {
        setError("Network error loading invitation. Please check your connection and try again.");
        setStatus("error");
      });
  }, [token]);

  async function acceptInvite() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Couldn't accept the invitation. Please try again.");
        setStatus("error");
        return;
      }

      if (json.data.requiresAuth) {
        router.push(`/signup?invite=${token}&email=${encodeURIComponent(json.data.email)}`);
        return;
      }

      setStatus("accepted");
      queryClient.clear();
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">We couldn&apos;t open this invitation</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to sign in
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

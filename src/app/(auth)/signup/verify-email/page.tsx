"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setResent(true);
    } catch {
      // silently fail — user can try again
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <Mail className="h-6 w-6 text-blue-600" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Check your email</h1>
      <p className="mb-6 text-sm text-slate-500">
        We sent a verification link to{" "}
        <span className="font-medium text-slate-700">{email || "your email"}</span>.
        Click the link to verify your account.
      </p>

      {resent ? (
        <p className="mb-4 text-sm text-green-600">Verification email resent!</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending || !email}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
          Resend verification email
        </button>
      )}

      <div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-slate-400">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md space-y-5 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="text-sm text-slate-500">
            An unexpected error occurred. Try again, or head back to the dashboard.
          </p>
          {error.digest && (
            <p className="pt-2 text-xs text-slate-400">Reference: {error.digest}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

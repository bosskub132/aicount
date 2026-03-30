"use client";

import { useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: "bg-[var(--success-light)] border-green-200 text-green-800",
  error: "bg-[var(--destructive-light)] border-red-200 text-red-800",
  warning: "bg-[var(--warning-light)] border-amber-200 text-amber-800",
  info: "bg-[var(--info-light)] border-blue-200 text-blue-800",
};

export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: { id: string; variant: "success" | "error" | "warning" | "info"; message: string; duration?: number };
  onDismiss: () => void;
}) {
  const Icon = icons[toast.variant];
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className={`flex items-center gap-2.5 rounded-[var(--radius-card)] border px-4 py-3 text-sm shadow-[var(--shadow-md)] ${styles[toast.variant]}`}
      style={{ animation: "slideInRight 200ms ease-out" }}
      role="alert"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <p className="flex-1">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 opacity-60 hover:opacity-100 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

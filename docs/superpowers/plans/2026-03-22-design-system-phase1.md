# Design System & Component Library — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish AICount's design system (tokens, typography, colors) and build 20 reusable components + app shell (sidebar, header) to replace the current inline UI.

**Architecture:** CSS design tokens in globals.css using Tailwind CSS v4 `@theme inline`. All components in `src/components/` as flat files with named exports. App shell composed from sidebar.tsx + header.tsx, replacing inline code in `(app)/layout.tsx`. UI state (sidebar, toasts, mobile menu) managed via Zustand store.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand 5, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-22-ui-ux-design-system-design.md`

---

## File Structure

### New Files

```
src/
  app/
    globals.css                    # MODIFY — full design token overhaul
    layout.tsx                     # MODIFY — swap Geist→Inter+NotoSansThai
    (app)/
      layout.tsx                   # MODIFY — replace inline sidebar/header with components
  components/
    button.tsx                     # CREATE — Button component (5 variants, 3 sizes)
    input.tsx                      # CREATE — Input component (text, number, date, password)
    select.tsx                     # CREATE — Select/Combobox with search
    checkbox.tsx                   # CREATE — Checkbox with indeterminate
    radio-group.tsx                # CREATE — Radio group
    toggle.tsx                     # CREATE — Toggle/Switch
    badge.tsx                      # CREATE — Status badges (9 document statuses)
    data-table.tsx                 # CREATE — Sortable, paginated data table
    card.tsx                       # CREATE — Content card
    stat-card.tsx                  # CREATE — Dashboard stat card with trend
    tabs.tsx                       # CREATE — Tab navigation with count badges
    modal.tsx                      # CREATE — Dialog with focus trap
    toast.tsx                      # CREATE — Toast notifications + provider + hook
    tooltip.tsx                    # CREATE — Hover/focus tooltip
    dropdown-menu.tsx              # CREATE — Click-triggered action menu
    skeleton.tsx                   # CREATE — Loading placeholder shimmer
    pagination.tsx                 # CREATE — Page navigation
    breadcrumbs.tsx                # CREATE — Navigation breadcrumb trail
    avatar.tsx                     # CREATE — User avatar with initials fallback
    empty-state.tsx                # CREATE — Empty list/table state
    sidebar.tsx                    # CREATE — App shell sidebar
    header.tsx                     # CREATE — App shell header
    global-search.tsx              # MODIFY — restyle to match design system
    offline-banner.tsx             # MODIFY — restyle to match design system
    workspace-selector.tsx         # MODIFY — restyle + move to sidebar context
    onboarding-modal.tsx           # MODIFY — refactor to use new Modal component
  lib/
    stores/
      ui-store.ts                  # CREATE — Zustand store for sidebar, toasts, mobile menu
```

---

## Task 1: Design Tokens & globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace globals.css with full design token set**

Replace the entire contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

@layer base {
  :root {
    /* Primary */
    --primary: #2563EB;
    --primary-hover: #1D4ED8;
    --primary-light: #EFF6FF;

    /* Secondary */
    --secondary: #475569;
    --secondary-hover: #334155;

    /* Semantic */
    --success: #059669;
    --success-light: #D1FAE5;
    --destructive: #DC2626;
    --destructive-light: #FEE2E2;
    --warning: #F59E0B;
    --warning-light: #FEF3C7;
    --info: #2563EB;
    --info-light: #DBEAFE;

    /* Surfaces */
    --background: #F8FAFC;
    --foreground: #0F172A;
    --card: #FFFFFF;
    --card-foreground: #0F172A;
    --muted: #F1F5F9;
    --muted-foreground: #64748B;
    --border: #E2E8F0;
    --ring: #2563EB;

    /* Document Status */
    --status-draft-bg: #F1F5F9;
    --status-draft-text: #475569;
    --status-processing-bg: #DBEAFE;
    --status-processing-text: #1D4ED8;
    --status-query-bg: #FEF3C7;
    --status-query-text: #92400E;
    --status-action-bg: #FFEDD5;
    --status-action-text: #C2410C;
    --status-pending-bg: #FEF3C7;
    --status-pending-text: #92400E;
    --status-rejected-bg: #FEE2E2;
    --status-rejected-text: #DC2626;
    --status-approved-bg: #D1FAE5;
    --status-approved-text: #065F46;
    --status-exported-bg: #EDE9FE;
    --status-exported-text: #6D28D9;
    --status-void-bg: #F1F5F9;
    --status-void-text: #64748B;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
    --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.15);

    /* Radius */
    --radius-input: 6px;
    --radius-button: 8px;
    --radius-card: 10px;
    --radius-modal: 12px;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-light: var(--primary-light);
  --color-secondary: var(--secondary);
  --color-secondary-hover: var(--secondary-hover);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-light: var(--destructive-light);
  --color-success: var(--success);
  --color-success-light: var(--success-light);
  --color-warning: var(--warning);
  --color-warning-light: var(--warning-light);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --font-sans: var(--font-inter), var(--font-noto-thai), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), monospace;
}

@layer base {
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
  }

  /* Tabular numbers for financial data */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }

  /* Focus ring utility */
  .focus-ring {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  /* Toast animation */
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 2: Verify globals.css loads without errors**

Run: `npm run dev`
Expected: Dev server starts without CSS errors. Page background should now be `#F8FAFC` (slight off-white).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add full design token set to globals.css"
```

---

## Task 2: Font Setup

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update root layout fonts**

Replace the current font imports and configuration in `src/app/layout.tsx`. The file currently imports `Geist` and `Geist_Mono` from `"next/font/google"`. Replace with:

```tsx
import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-thai",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AICount - Thai Accounting Platform",
  description: "AI-powered Thai accounting software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${inter.variable} ${notoSansThai.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify fonts load**

Run: `npm run dev`, open browser, inspect `<body>` element.
Expected: CSS variables `--font-inter`, `--font-noto-thai`, `--font-geist-mono` should be set. Text should render in Inter. Thai text (ภาษาไทย) should render in Noto Sans Thai.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: switch fonts to Inter + Noto Sans Thai, keep Geist Mono"
```

---

## Task 3: Zustand UI Store

**Files:**
- Create: `src/lib/stores/ui-store.ts`

- [ ] **Step 1: Create the stores directory and ui-store**

```ts
import { create } from "zustand";

// Toast types
interface Toast {
  id: string;
  variant: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Mobile menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Mobile menu
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// Convenience hook for toasts
export function useToast() {
  const addToast = useUIStore((s) => s.addToast);
  const removeToast = useUIStore((s) => s.removeToast);

  return {
    success: (message: string) => addToast({ variant: "success", message }),
    error: (message: string) => addToast({ variant: "error", message }),
    warning: (message: string) => addToast({ variant: "warning", message }),
    info: (message: string) => addToast({ variant: "info", message }),
    dismiss: (id: string) => removeToast(id),
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors from ui-store.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/ui-store.ts
git commit -m "feat: add Zustand UI store for sidebar, toasts, mobile menu"
```

---

## Task 4: Base Components — Primitives (Button, Input, Badge, Avatar)

**Files:**
- Create: `src/components/button.tsx`
- Create: `src/components/input.tsx`
- Create: `src/components/badge.tsx`
- Create: `src/components/avatar.tsx`

- [ ] **Step 1: Create Button component**

```tsx
// src/components/button.tsx
"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus-visible:outline-[var(--ring)]",
  secondary:
    "bg-white text-[var(--secondary)] border border-[var(--border)] hover:bg-[var(--muted)] focus-visible:outline-[var(--ring)]",
  destructive:
    "bg-[var(--destructive-light)] text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white focus-visible:outline-[var(--destructive)]",
  ghost:
    "text-[var(--secondary)] hover:bg-[var(--muted)] focus-visible:outline-[var(--ring)]",
  link:
    "text-[var(--primary)] underline hover:text-[var(--primary-hover)] p-0 h-auto",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading, disabled, icon, className = "", children, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium rounded-[var(--radius-button)] transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);
```

- [ ] **Step 2: Create Input component**

```tsx
// src/components/input.tsx
"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, helperText, required, type, className = "", id, ...props }, ref) {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const isPassword = type === "password";

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-[var(--card-foreground)]">
            {label}
            {required && <span className="text-[var(--destructive)] ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? "text" : type}
            className={`w-full rounded-[var(--radius-input)] border bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors duration-150 focus:outline-2 focus:outline-[var(--ring)] focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              error
                ? "border-[var(--destructive)] border-[1.5px]"
                : "border-[var(--border)]"
            } ${isPassword ? "pr-10" : ""} ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-[var(--muted-foreground)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
```

- [ ] **Step 3: Create Badge component**

```tsx
// src/components/badge.tsx
type BadgeVariant =
  | "default"
  | "draft"
  | "processing"
  | "query"
  | "action_required"
  | "pending"
  | "rejected"
  | "approved"
  | "exported"
  | "void";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  draft: "bg-[var(--status-draft-bg)] text-[var(--status-draft-text)]",
  processing: "bg-[var(--status-processing-bg)] text-[var(--status-processing-text)]",
  query: "bg-[var(--status-query-bg)] text-[var(--status-query-text)]",
  action_required: "bg-[var(--status-action-bg)] text-[var(--status-action-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  rejected: "bg-[var(--status-rejected-bg)] text-[var(--status-rejected-text)]",
  approved: "bg-[var(--status-approved-bg)] text-[var(--status-approved-text)]",
  exported: "bg-[var(--status-exported-bg)] text-[var(--status-exported-text)]",
  void: "bg-[var(--status-void-bg)] text-[var(--status-void-text)]",
};

// Map DOCUMENT_STATUSES constants to badge variants
const statusToVariant: Record<string, BadgeVariant> = {
  DRAFT: "draft",
  OCR_PROCESSING: "processing",
  QUERY: "query",
  ACTION_REQUIRED: "action_required",
  PENDING_APPROVAL: "pending",
  REJECTED: "rejected",
  APPROVED: "approved",
  EXPORTED: "exported",
  VOID: "void",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-button)] px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = statusToVariant[status] || "default";
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
```

- [ ] **Step 4: Create Avatar component**

```tsx
// src/components/avatar.tsx
type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizeStyles[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-[var(--primary)] text-white font-semibold ${sizeStyles[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
```

- [ ] **Step 5: Verify all 4 components compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/button.tsx src/components/input.tsx src/components/badge.tsx src/components/avatar.tsx
git commit -m "feat: add Button, Input, Badge, Avatar components"
```

---

## Task 5: Feedback Components (Toast, Modal, Tooltip, Dropdown Menu)

**Files:**
- Create: `src/components/toast.tsx`
- Create: `src/components/modal.tsx`
- Create: `src/components/tooltip.tsx`
- Create: `src/components/dropdown-menu.tsx`

- [ ] **Step 1: Create Toast component + provider**

```tsx
// src/components/toast.tsx
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
      className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm"
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
```

- [ ] **Step 2: Create Modal component**

```tsx
// src/components/modal.tsx
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, children, actions, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`${sizeStyles[size]} w-full rounded-[var(--radius-modal)] border-none p-0 shadow-[var(--shadow-lg)] backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-[var(--muted-foreground)] leading-relaxed">{children}</div>
        {actions && (
          <div className="flex justify-end gap-2 mt-6">{actions}</div>
        )}
      </div>
    </dialog>
  );
}
```

- [ ] **Step 3: Create Tooltip component**

```tsx
// src/components/tooltip.tsx
"use client";

import { useState, useRef } from "react";

interface TooltipProps {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}

const positionStyles = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
};

export function Tooltip({ content, side = "top", children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 whitespace-nowrap rounded-[var(--radius-input)] bg-[var(--foreground)] px-2.5 py-1 text-xs text-white shadow-[var(--shadow-md)] pointer-events-none ${positionStyles[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create Dropdown Menu component**

```tsx
// src/components/dropdown-menu.tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function DropdownMenu({ trigger, items, align = "right" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={`absolute top-full mt-1 z-50 min-w-[160px] rounded-[var(--radius-card)] border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-md)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t border-[var(--border)]" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors duration-100 ${
                  item.destructive
                    ? "text-[var(--destructive)] hover:bg-[var(--destructive-light)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify all compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/toast.tsx src/components/modal.tsx src/components/tooltip.tsx src/components/dropdown-menu.tsx
git commit -m "feat: add Toast, Modal, Tooltip, Dropdown Menu components"
```

---

## Task 6: Data Components (Tabs, Table, Pagination, StatCard, Card, Empty State, Skeleton)

**Files:**
- Create: `src/components/tabs.tsx`
- Create: `src/components/data-table.tsx`
- Create: `src/components/pagination.tsx`
- Create: `src/components/stat-card.tsx`
- Create: `src/components/card.tsx`
- Create: `src/components/empty-state.tsx`
- Create: `src/components/skeleton.tsx`

- [ ] **Step 1: Create Tabs component**

```tsx
// src/components/tabs.tsx
"use client";

interface Tab {
  label: string;
  value: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-0 border-b-2 border-[var(--border)]">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-5 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer -mb-[2px] ${
            activeTab === tab.value
              ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 px-1.5 py-px rounded-full text-[11px] ${
                activeTab === tab.value
                  ? "bg-[var(--info-light)] text-[var(--primary)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create DataTable component**

```tsx
// src/components/data-table.tsx
"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  selectable?: boolean;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  onSelect?: (selected: T[]) => void;
  emptyMessage?: string;
  footer?: React.ReactNode;
  keyField?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  sortable,
  selectable,
  onSort,
  onSelect,
  emptyMessage = "No data",
  footer,
  keyField = "id",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSort = (key: string) => {
    if (!sortable) return;
    const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(newDir);
    onSort?.(key, newDir);
  };

  const handleSelectAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
      onSelect?.([]);
    } else {
      const all = new Set(data.map((row) => String(row[keyField])));
      setSelected(all);
      onSelect?.(data);
    }
  };

  const handleSelectRow = (row: T) => {
    const key = String(row[keyField]);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    onSelect?.(data.filter((r) => next.has(String(r[keyField]))));
  };

  const alignClass = (align?: string) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={data.length > 0 && selected.size === data.length}
                  onChange={handleSelectAll}
                  className="cursor-pointer"
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] ${alignClass(col.align)} ${
                  col.sortable !== false && sortable ? "cursor-pointer select-none hover:text-[var(--foreground)]" : ""
                }`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable !== false && sortable && handleSort(col.key)}
                aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable !== false && sortable && (
                    sortKey === col.key ? (
                      sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-4 py-12 text-center text-[var(--muted-foreground)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={String(row[keyField]) || i}
                className={`border-b border-[var(--muted)] last:border-0 transition-colors duration-100 hover:bg-[var(--muted)]/50 ${
                  selected.has(String(row[keyField])) ? "bg-[var(--primary-light)]" : ""
                }`}
              >
                {selectable && (
                  <td className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(String(row[keyField]))}
                      onChange={() => handleSelectRow(row)}
                      className="cursor-pointer"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${alignClass(col.align)} ${
                      col.align === "right" ? "tabular-nums" : ""
                    }`}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-[var(--border)] bg-[var(--muted)] font-medium">
              {footer}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create Pagination, StatCard, Card, Empty State, Skeleton**

Create all 5 files. Each is a small focused component:

**`src/components/pagination.tsx`:**
```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
}

const perPageOptions = [25, 50, 100];

export function Pagination({ currentPage, totalPages, onPageChange, perPage, onPerPageChange }: PaginationProps) {
  if (totalPages <= 1 && !perPage) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (currentPage <= 4) return i + 1;
    if (currentPage >= totalPages - 3) return totalPages - 6 + i;
    return currentPage - 3 + i;
  });

  return (
    <div className="flex items-center justify-between">
      {perPage && onPerPageChange ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>Rows:</span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="rounded-[var(--radius-input)] border border-[var(--border)] bg-white px-2 py-1 text-sm cursor-pointer"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      ) : <div />}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[32px] h-8 px-2 rounded-[var(--radius-button)] text-sm font-medium cursor-pointer transition-colors duration-100 ${
              page === currentPage
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**`src/components/stat-card.tsx`:**
```tsx
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({ title, value, trend, trendValue }: StatCardProps) {
  const trendColor = trend === "up" ? "text-[var(--success)]" : trend === "down" ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5">
      <p className="text-xs text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
      {trendValue && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trendValue}
        </p>
      )}
    </div>
  );
}
```

**`src/components/card.tsx`:**
```tsx
interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-white ${className}`}>
      {title && (
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
```

**`src/components/empty-state.tsx`:**
```tsx
import { Button } from "@/components/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="mb-4 text-[var(--muted-foreground)]">{icon}</div>}
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}
```

**`src/components/skeleton.tsx`:**
```tsx
type SkeletonVariant = "text" | "circle" | "rect";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ variant = "text", width, height, className = "" }: SkeletonProps) {
  const base = "animate-pulse bg-[var(--muted)]";

  const variantStyles = {
    text: `${base} h-4 rounded`,
    circle: `${base} rounded-full`,
    rect: `${base} rounded-[var(--radius-card)]`,
  };

  return (
    <div
      className={`${variantStyles[variant]} ${className}`}
      style={{ width: width || "100%", height: height || (variant === "circle" ? width : undefined) }}
    />
  );
}
```

- [ ] **Step 4: Verify all compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs.tsx src/components/data-table.tsx src/components/pagination.tsx src/components/stat-card.tsx src/components/card.tsx src/components/empty-state.tsx src/components/skeleton.tsx
git commit -m "feat: add Tabs, DataTable, Pagination, StatCard, Card, EmptyState, Skeleton components"
```

---

## Task 7: Form Components (Select, Checkbox, Radio Group, Toggle, Breadcrumbs)

**Files:**
- Create: `src/components/select.tsx`
- Create: `src/components/checkbox.tsx`
- Create: `src/components/radio-group.tsx`
- Create: `src/components/toggle.tsx`
- Create: `src/components/breadcrumbs.tsx`

- [ ] **Step 1: Create Select component**

```tsx
// src/components/select.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  label?: string;
  error?: string;
  required?: boolean;
}

export function Select({ options, value, onChange, placeholder = "Select...", searchable, label, error, required }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      {label && (
        <label className="text-[13px] font-medium text-[var(--card-foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-0.5">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full rounded-[var(--radius-input)] border bg-white px-3 py-2 text-sm cursor-pointer transition-colors ${
          error ? "border-[var(--destructive)] border-[1.5px]" : "border-[var(--border)]"
        } ${selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}
      >
        {selected?.label || placeholder}
        <ChevronDown className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)] max-h-60 overflow-auto">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                autoFocus
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[var(--muted-foreground)] text-center">No results</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[var(--muted)] ${
                  option.value === value ? "text-[var(--primary)] font-medium" : "text-[var(--foreground)]"
                }`}
              >
                {option.label}
                {option.value === value && <Check className="h-4 w-4" />}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create Checkbox, RadioGroup, Toggle, Breadcrumbs**

**`src/components/checkbox.tsx`:**
```tsx
"use client";

import { forwardRef } from "react";
import { Check, Minus } from "lucide-react";

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  indeterminate?: boolean;
  disabled?: boolean;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox({ checked, onChange, label, indeterminate, disabled }, ref) {
    return (
      <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
        <button
          ref={ref}
          type="button"
          role="checkbox"
          aria-checked={indeterminate ? "mixed" : checked}
          disabled={disabled}
          onClick={() => !disabled && onChange?.(!checked)}
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-100 cursor-pointer ${
            checked || indeterminate
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-white"
          }`}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
          {indeterminate && !checked && <Minus className="h-3 w-3" strokeWidth={3} />}
        </button>
        {label && <span className="text-sm text-[var(--foreground)]">{label}</span>}
      </label>
    );
  }
);
```

**`src/components/radio-group.tsx`:**
```tsx
"use client";

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onChange: (value: string) => void;
  name: string;
}

export function RadioGroup({ options, value, onChange, name }: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {options.map((option) => (
        <label key={option.value} className="inline-flex items-center gap-2 cursor-pointer">
          <span
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-100 ${
              value === option.value
                ? "border-[var(--primary)] bg-[var(--primary)]"
                : "border-[var(--border)] bg-white"
            }`}
          >
            {value === option.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span className="text-sm text-[var(--foreground)]">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
```

**`src/components/toggle.tsx`:**
```tsx
"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
          checked ? "bg-[var(--primary)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
      {label && <span className="text-sm text-[var(--foreground)]">{label}</span>}
    </label>
  );
}
```

**`src/components/breadcrumbs.tsx`:**
```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Verify all compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/select.tsx src/components/checkbox.tsx src/components/radio-group.tsx src/components/toggle.tsx src/components/breadcrumbs.tsx
git commit -m "feat: add Select, Checkbox, RadioGroup, Toggle, Breadcrumbs components"
```

---

## Task 8: App Shell — Sidebar Component

**Files:**
- Create: `src/components/sidebar.tsx`

- [ ] **Step 1: Create Sidebar component**

```tsx
// src/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  CheckCircle2,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  BarChart3,
  ClipboardList,
  FileCheck,
  Settings,
  X,
} from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { WorkspaceSelector } from "@/components/workspace-selector";

const navGroups = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "DOCUMENTS",
    items: [
      { href: "/upload", label: "Upload & OCR", icon: Upload },
      { href: "/documents", label: "All Documents", icon: FileText },
      { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { href: "/ledger", label: "General Ledger", icon: BookOpen },
      { href: "/receivables", label: "Accounts Receivable", icon: ArrowDownToLine },
      { href: "/payables", label: "Accounts Payable", icon: ArrowUpFromLine },
      { href: "/bank-recon", label: "Bank Recon", icon: Landmark },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { href: "/reports/financial", label: "Financial Statements", icon: BarChart3 },
      { href: "/reports/tax", label: "Tax Reports", icon: ClipboardList },
      { href: "/reports/wht", label: "WHT Certificates", icon: FileCheck },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-white text-xs font-bold">
          AI
        </div>
        <span className="text-[15px] font-semibold text-[var(--foreground)]">AICount</span>

        {/* Close button for mobile */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="ml-auto p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] md:hidden cursor-pointer"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="border-b border-[var(--border)] px-4 py-2.5">
        <WorkspaceSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
                    isActive
                      ? "bg-[var(--primary-light)] text-[var(--primary)]"
                      : "text-[var(--secondary)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: Settings */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 ${
            pathname?.startsWith("/settings")
              ? "bg-[var(--primary-light)] text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[230px] md:flex-col md:shrink-0 h-screen sticky top-0 border-r border-[var(--border)] bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col bg-white shadow-[var(--shadow-lg)]">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat: add Sidebar component with grouped navigation"
```

---

## Task 9: App Shell — Header Component

**Files:**
- Create: `src/components/header.tsx`

- [ ] **Step 1: Create Header component**

```tsx
// src/components/header.tsx
"use client";

import { Menu, Search } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { Avatar } from "@/components/avatar";

interface HeaderProps {
  title: string;
  userName?: string;
}

export function Header({ title, userName = "User" }: HeaderProps) {
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--border)] bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] md:hidden cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-[var(--foreground)]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Search trigger */}
        <button
          className="flex items-center gap-2 rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors cursor-pointer min-w-[200px]"
          onClick={() => {
            // Trigger Cmd+K search — dispatch keyboard event
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex text-[11px] text-[var(--muted-foreground)] bg-white rounded px-1 py-0.5 border border-[var(--border)]">
            ⌘K
          </kbd>
        </button>
        {/* User avatar */}
        <Avatar name={userName} size="md" />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/header.tsx
git commit -m "feat: add Header component with search trigger and avatar"
```

---

## Task 10: Wire Up App Shell — Replace Inline Layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace the existing app layout**

Replace the entire contents of `src/app/(app)/layout.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { ToastProvider } from "@/components/toast";
import { GlobalSearch } from "@/components/global-search";
import { OfflineBanner } from "@/components/offline-banner";
import { OnboardingModal } from "@/components/onboarding-modal";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

// Map pathnames to page titles
const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/upload": "Upload & OCR",
  "/documents": "All Documents",
  "/approvals": "Approvals",
  "/extractions": "Extractions",
  "/query-tray": "Query Tray",
  "/export": "Export",
  "/reversal": "Reversals",
  "/ledger": "General Ledger",
  "/receivables": "Accounts Receivable",
  "/payables": "Accounts Payable",
  "/bank-recon": "Bank Reconciliation",
  "/reports/financial": "Financial Statements",
  "/reports/tax": "Tax Reports",
  "/reports/wht": "WHT Certificates",
  "/settings": "Settings",
  "/onboarding": "Onboarding",
};

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "AICount";
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Prefix match for nested routes
  const match = Object.keys(pageTitles)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(key));
  return match ? pageTitles[match] : "AICount";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const tenantId = getWorkspaceTenantId();
    if (!tenantId || tenantId === "default") {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <GlobalSearch />
      <OfflineBanner />
      <ToastProvider />
      {showOnboarding && <OnboardingModal />}
    </div>
  );
}
```

- [ ] **Step 2: Verify the dev server runs and the app renders**

Run: `npm run dev`
Expected: App loads with new sidebar (white, grouped nav) and header. Existing page content still renders in the main area.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat: replace inline layout with Sidebar + Header components"
```

---

## Task 11: Restyle Existing Components

**Files:**
- Modify: `src/components/workspace-selector.tsx`
- Modify: `src/components/offline-banner.tsx`
- Modify: `src/components/global-search.tsx`

- [ ] **Step 1: Restyle WorkspaceSelector for sidebar context**

The existing component needs minimal changes — mainly replace hardcoded colors with CSS variables and adjust sizing for the sidebar. Key changes:
- Replace `border-slate-200` → `border-[var(--border)]`
- Replace `text-gray-*` → `text-[var(--muted-foreground)]` / `text-[var(--foreground)]`
- Replace `bg-white` → `bg-[var(--muted)]` for the trigger button in sidebar
- Replace inline SVG building icon with `Building2` from lucide-react
- Replace inline SVG chevron with `ChevronDown` from lucide-react
- Adjust dropdown width to fit sidebar (full width of parent)

- [ ] **Step 2: Restyle OfflineBanner to use design tokens**

Replace hardcoded amber/yellow colors with design system tokens:
- Background: `bg-[var(--warning-light)]`
- Text: `text-amber-800`
- Border: `border-amber-200`
- Add `WifiOff` icon from lucide-react

- [ ] **Step 3: Restyle GlobalSearch to match design system**

Replace hardcoded colors with CSS variables:
- Overlay backdrop: `bg-black/40`
- Search panel: `bg-white rounded-[var(--radius-modal)] shadow-[var(--shadow-lg)]`
- Input: use design system input styling
- Results: use design system list styling with hover state `hover:bg-[var(--muted)]`
- Keyboard shortcut badges: `bg-[var(--muted)] text-[var(--muted-foreground)]`

- [ ] **Step 4: Refactor OnboardingModal to use new Modal component**

Update `src/components/onboarding-modal.tsx`:
- Replace the custom modal wrapper (fixed overlay + centered card) with the new `Modal` component
- Replace hardcoded colors with CSS variables (`var(--primary)`, `var(--border)`, etc.)
- Replace inline buttons with `Button` component
- Replace inline inputs with `Input` component
- Keep the 5-step onboarding logic and state unchanged

- [ ] **Step 5: Verify dev server renders correctly**

Run: `npm run dev`
Expected: All four components render with consistent design tokens. Workspace selector appears in sidebar. Search overlay matches new design. Onboarding modal uses new Modal component.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace-selector.tsx src/components/offline-banner.tsx src/components/global-search.tsx src/components/onboarding-modal.tsx
git commit -m "feat: restyle existing components to match design system"
```

---

## Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update fonts section**

In CLAUDE.md, update the Design Tokens & Styling section to reflect the new fonts:

Replace the fonts line:
```
- Fonts: Geist Sans (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`)
```
With:
```
- Fonts: Inter (`--font-inter`) + Noto Sans Thai (`--font-noto-thai`) for body, Geist Mono (`--font-geist-mono`) for monospace
```

- [ ] **Step 2: Add component reference to CLAUDE.md**

Add after the Icon System section:

```markdown
## Component Library

- Reusable components are in `src/components/` (flat structure)
- Use existing components (Button, Input, Badge, Modal, Toast, etc.) instead of creating inline UI
- Import design token CSS variables from `globals.css` — never hardcode colors
- Status badges: use `StatusBadge` component with document status constants
- Tables: use `DataTable` component with column definitions
- Notifications: use `useToast()` hook from `@/lib/stores/ui-store`
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new fonts and component library reference"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero type errors

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds. Note any warnings (unused imports, etc.) and fix.

- [ ] **Step 3: Visual verification**

Run: `npm run dev` and check:
- [ ] Sidebar renders with white background, grouped navigation, AICount logo
- [ ] Header renders with page title, search bar, avatar
- [ ] Navigation highlights active page correctly
- [ ] Thai text (ภาษาไทย) renders in Noto Sans Thai
- [ ] Mobile responsive: sidebar collapses at <768px, hamburger menu works
- [ ] Toast notifications work (test via browser console if needed)
- [ ] Global search opens with Cmd+K

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — design system, component library, app shell"
```

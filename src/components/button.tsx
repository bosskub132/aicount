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

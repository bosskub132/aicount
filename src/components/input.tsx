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

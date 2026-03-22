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

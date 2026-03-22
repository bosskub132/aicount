"use client";

import { useState, useCallback } from "react";

interface CurrencyInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CurrencyInput({
  value,
  onChange,
  disabled = false,
  placeholder = "0.00",
  className = "",
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawInput, setRawInput] = useState("");

  const displayValue = focused
    ? rawInput
    : value !== undefined
      ? formatNumber(value)
      : "";

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRawInput(value !== undefined ? String(value) : "");
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    if (rawInput.trim() === "") {
      onChange(undefined);
      return;
    }
    const parsed = parseFloat(rawInput);
    if (Number.isNaN(parsed)) {
      onChange(undefined);
    } else {
      onChange(Math.round(parsed * 100) / 100);
    }
  }, [rawInput, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Allow digits, dots, minus sign
      if (/^-?\d*\.?\d*$/.test(val) || val === "") {
        setRawInput(val);
      }
    },
    [],
  );

  return (
    <div
      className={`flex items-center rounded-[var(--radius-input)] border bg-white px-3 py-2 transition-colors duration-150 ${
        focused
          ? "outline-2 outline-[var(--ring)] outline-offset-0"
          : ""
      } border-[var(--border)] ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      <span className="text-sm font-medium text-[var(--muted-foreground)] mr-1.5 select-none">
        ฿
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 text-sm text-[var(--foreground)] tabular-nums bg-transparent outline-none placeholder:text-[var(--muted-foreground)] disabled:cursor-not-allowed min-w-0 text-right"
      />
    </div>
  );
}

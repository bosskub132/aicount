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
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    // Determine if dropdown should open upward (not enough space below)
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 260); // 260 = max-h-60 (240px) + margin
    }

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
        ref={buttonRef}
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
        <div
          className={`absolute left-0 right-0 z-[9999] rounded-[var(--radius-card)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)] max-h-60 overflow-auto ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
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

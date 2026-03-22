"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

interface Account {
  accountCode: string;
  accountName: string;
  category: string;
}

interface AccountSelectProps {
  value: string | undefined;
  onChange: (accountCode: string) => void;
  accounts: Account[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const CATEGORY_ORDER = ["Asset", "Liability", "Equity", "Revenue", "Expense"];

const categoryBadgeStyles: Record<string, string> = {
  Asset: "bg-blue-100 text-blue-700",
  Liability: "bg-red-100 text-red-700",
  Equity: "bg-purple-100 text-purple-700",
  Revenue: "bg-green-100 text-green-700",
  Expense: "bg-amber-100 text-amber-700",
};

export function AccountSelect({
  value,
  onChange,
  accounts,
  disabled = false,
  placeholder = "Select account...",
  className = "",
}: AccountSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = accounts.find((a) => a.accountCode === value);

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.accountCode.toLowerCase().includes(q) ||
        a.accountName.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const account of filtered) {
      const cat = account.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(account);
    }
    return CATEGORY_ORDER.filter((cat) => groups[cat]?.length).map((cat) => ({
      category: cat,
      accounts: groups[cat],
    }));
  }, [filtered]);

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

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={ref} className={`relative flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        className={`flex items-center justify-between w-full rounded-[var(--radius-input)] border bg-white px-3 py-2 text-sm cursor-pointer transition-colors border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed ${
          selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
        }`}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            <span className="font-mono font-bold text-xs">{selected.accountCode}</span>
            <span className="truncate">{selected.accountName}</span>
          </span>
        ) : (
          placeholder
        )}
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)] max-h-72 overflow-auto">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 sticky top-0 bg-white">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name..."
              className="flex-1 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          {grouped.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[var(--muted-foreground)] text-center">
              No accounts found
            </div>
          ) : (
            grouped.map(({ category, accounts: catAccounts }) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider bg-[var(--surface-raised)]">
                  {category}
                </div>
                {catAccounts.map((account) => (
                  <button
                    key={account.accountCode}
                    type="button"
                    onClick={() => {
                      onChange(account.accountCode);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[var(--muted)] ${
                      account.accountCode === value
                        ? "text-[var(--primary)] font-medium"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    <span className="font-mono font-bold text-xs min-w-[4rem]">
                      {account.accountCode}
                    </span>
                    <span className="flex-1 truncate text-left">
                      {account.accountName}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-[var(--radius-button)] px-1.5 py-0.5 text-[10px] font-medium ${
                        categoryBadgeStyles[account.category] ?? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {account.category}
                    </span>
                    {account.accountCode === value && (
                      <Check className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

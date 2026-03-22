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

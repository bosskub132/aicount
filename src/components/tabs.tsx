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

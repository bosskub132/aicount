"use client";

interface SuggestionPillProps {
  id: string;
  displayLabel: string;
  confidence: number;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function SuggestionPill({
  id,
  displayLabel,
  confidence,
  onAccept,
  onDismiss,
}: SuggestionPillProps) {
  return (
    <div
      className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-1.5"
      onClick={() => onAccept(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onAccept(id);
      }}
    >
      <span className="text-xs font-medium text-[#2563EB]">
        {displayLabel}
      </span>
      <span className="text-[10px] text-[#93C5FD]">
        {Math.round(confidence * 100)}%
      </span>
      <button
        className="ml-1 inline-flex h-[18px] w-[18px] items-center justify-center text-lg font-medium text-[#6B9BD2] hover:text-[#2563EB]"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(id);
        }}
        aria-label="Dismiss suggestion"
      >
        &times;
      </button>
    </div>
  );
}

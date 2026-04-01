"use client";

interface SuggestionBannerProps {
  count: number;
  onAcceptAll: () => void;
  onClearAll: () => void;
}

export function SuggestionBanner({
  count,
  onAcceptAll,
  onClearAll,
}: SuggestionBannerProps) {
  if (count < 2) return null;

  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-[#BFDBFE] border-l-[3px] border-l-[#2563EB] bg-[#EFF6FF] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm">&#10024;</span>
        <span className="text-xs font-semibold text-[#1E40AF]">
          {count} suggestions available
        </span>
        <span className="text-[11px] text-gray-500">&middot; Review below</span>
      </div>
      <div className="flex gap-1.5">
        <button
          className="rounded-md bg-[#2563EB] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#1D4ED8]"
          onClick={onAcceptAll}
        >
          Accept All
        </button>
        <button
          className="rounded-md border border-gray-300 px-3 py-1 text-[11px] text-gray-500 hover:bg-gray-50"
          onClick={onClearAll}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

"use client";

import type { DuplicateCandidate } from "@/lib/services/suggestions/types";

interface DuplicateWarningBannerProps {
  duplicates: DuplicateCandidate[];
  onCompare: (duplicate: DuplicateCandidate) => void;
  onDismiss: (id: string) => void;
}

export function DuplicateWarningBanner({
  duplicates,
  onCompare,
  onDismiss,
}: DuplicateWarningBannerProps) {
  if (duplicates.length === 0) return null;

  const dup = duplicates[0];
  const isExactMatch = dup.matchType === "file_hash";
  const matchDoc = dup.matchDocument;

  const amountDisplay = matchDoc?.grandTotal
    ? `฿${Number(matchDoc.grandTotal).toLocaleString()}`
    : "";
  const dateDisplay = matchDoc?.documentDate ?? "";

  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 border-l-[3px] border-l-amber-400 bg-amber-50 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[15px]">&#9888;</span>
        <div>
          <span className="text-xs font-semibold text-amber-800">
            {isExactMatch
              ? "This file has already been uploaded"
              : "Possible duplicate"}
          </span>
          {matchDoc && (
            <span className="ml-1.5 text-[11px] text-stone-500">
              {matchDoc.documentNumber ?? ""} from{" "}
              {matchDoc.issuerName ?? "Unknown"} ({dateDisplay}
              {amountDisplay ? `, ${amountDisplay}` : ""})
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          className="rounded-md border border-[#2563EB] px-3 py-1 text-[11px] font-medium text-[#2563EB] hover:bg-blue-50"
          onClick={() => onCompare(dup)}
        >
          Compare
        </button>
        <button
          className="rounded-md border border-gray-300 px-3 py-1 text-[11px] text-gray-500 hover:bg-gray-50"
          onClick={() => onDismiss(dup.id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

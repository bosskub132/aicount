"use client";

import { Modal } from "@/components/modal";
import type { DuplicateCandidate } from "@/lib/services/suggestions/types";

interface DuplicateCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicate: DuplicateCandidate | null;
  currentDoc: {
    issuerName: string | null;
    documentNumber: string | null;
    documentDate: string | null;
    grandTotal: string | null;
    status: string;
  } | null;
  onDismiss: (id: string) => void;
  onViewOriginal: (documentId: string) => void;
}

export function DuplicateCompareModal({
  isOpen,
  onClose,
  duplicate,
  currentDoc,
  onDismiss,
  onViewOriginal,
}: DuplicateCompareModalProps) {
  if (!duplicate || !currentDoc) return null;

  const matchDoc = duplicate.matchDocument;

  const fields = [
    { label: "Issuer", current: currentDoc.issuerName, match: matchDoc?.issuerName },
    { label: "Document #", current: currentDoc.documentNumber, match: matchDoc?.documentNumber },
    { label: "Date", current: currentDoc.documentDate, match: matchDoc?.documentDate },
    {
      label: "Amount",
      current: currentDoc.grandTotal ? `฿${Number(currentDoc.grandTotal).toLocaleString()}` : "-",
      match: matchDoc?.grandTotal ? `฿${Number(matchDoc.grandTotal).toLocaleString()}` : "-",
    },
    { label: "Status", current: currentDoc.status, match: matchDoc?.status },
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Compare Documents"
      size="xl"
      actions={
        <>
          <button
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => {
              onDismiss(duplicate.id);
              onClose();
            }}
          >
            Keep Both
          </button>
          <button
            className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
            onClick={() => {
              onViewOriginal(duplicate.matchDocumentId);
              onClose();
            }}
          >
            View Original
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-700">Current Document</h4>
          {fields.map((f) => (
            <div key={f.label} className="mb-2">
              <div className="text-[11px] font-medium text-gray-500">{f.label}</div>
              <div className="text-sm text-gray-900">{f.current ?? "-"}</div>
            </div>
          ))}
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-700">Existing Document</h4>
          {fields.map((f) => (
            <div key={f.label} className="mb-2">
              <div className="text-[11px] font-medium text-gray-500">{f.label}</div>
              <div className="text-sm text-gray-900">{f.match ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

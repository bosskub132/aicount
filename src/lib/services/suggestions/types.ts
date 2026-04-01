export type SuggestionFeature =
  | "coa_mapping"
  | "wht_rate"
  | "duplicate"
  | "smart_default";

export type SuggestionSource =
  | "vendor_history"
  | "graduated_rule"
  | "ai_model"
  | "frequency"
  | "cross_tenant";

export type SuggestionStatus =
  | "pending"
  | "accepted"
  | "dismissed"
  | "edited";

export type DuplicateMatchType = "file_hash" | "content_match";

export type DuplicateStatus = "pending" | "dismissed" | "confirmed_duplicate";

export interface SuggestionResult {
  feature: SuggestionFeature;
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  source: SuggestionSource;
  sourceContext?: Record<string, unknown>;
}

export interface Suggestion {
  id: string;
  tenantId: string;
  documentId: string | null;
  feature: SuggestionFeature;
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  source: SuggestionSource;
  sourceContext: Record<string, unknown> | null;
  status: SuggestionStatus;
  finalValue: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface DuplicateCandidate {
  id: string;
  tenantId: string;
  documentId: string;
  matchDocumentId: string;
  matchType: DuplicateMatchType;
  matchScore: number;
  matchDetails: Record<string, unknown> | null;
  status: DuplicateStatus;
  createdAt: Date;
  matchDocument?: {
    issuerName: string | null;
    documentNumber: string | null;
    documentDate: string | null;
    grandTotal: string | null;
    status: string;
  };
}

export interface SuggestionOutcome {
  id: string;
  status: "accepted" | "dismissed" | "edited";
  finalValue?: string;
}

export interface DuplicateOutcome {
  id: string;
  status: "dismissed" | "confirmed_duplicate";
}

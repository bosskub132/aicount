export type PatternType = "coa_mapping" | "wht_rate" | "smart_default";

export interface CrossTenantPattern {
  id: string;
  patternType: PatternType;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  tenantCount: number;
  sampleCount: number;
  acceptCount: number;
  dismissCount: number;
  agreementRatio: number;
  confidence: number;
  metadata: PatternMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatternMetadata {
  tenantHashes: string[];
  [key: string]: unknown;
}

export interface PatternOutcome {
  patternType: PatternType;
  triggerKey: string;
  fieldName: string;
  suggestedValue: string;
  status: "accepted" | "dismissed" | "edited";
  tenantId: string;
}

export interface AdaptiveThresholds {
  minTenants: number;
  minAgreement: number;
}

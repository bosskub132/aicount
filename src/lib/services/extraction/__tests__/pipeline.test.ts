import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TierResult, ExtractedData, ValidationResult } from "../types";

vi.mock("../tiers/tier1-haiku", () => ({ extractTier1: vi.fn() }));
vi.mock("../tiers/tier2-sonnet", () => ({ extractTier2: vi.fn() }));
vi.mock("../tiers/tier3-vision", () => ({ extractTier3: vi.fn() }));
vi.mock("../rules/rule-loader", () => ({
  loadRules: vi.fn().mockResolvedValue({ promptRules: [], graduated: [] }),
}));
vi.mock("../usage-logger", () => ({ logAiUsage: vi.fn() }));

import { extractTier1 } from "../tiers/tier1-haiku";
import { extractTier2 } from "../tiers/tier2-sonnet";
import { extractTier3 } from "../tiers/tier3-vision";
import { extractDocument } from "../pipeline";

const mockedTier1 = vi.mocked(extractTier1);
const mockedTier2 = vi.mocked(extractTier2);
const mockedTier3 = vi.mocked(extractTier3);

function makeData(overrides: Partial<ExtractedData["confidence"]> = {}): ExtractedData {
  return {
    issuer: {
      name: "Test Corp",
      tax_id: "1234567890123",
      branch_id: "00000",
      address: "123 Main St",
      postal_code: "10110",
    },
    customer: {
      name: "Customer Co",
      tax_id: "9876543210123",
      branch_id: "00000",
      address: "456 Side Rd",
      postal_code: "10120",
    },
    document: {
      document_type: "invoice",
      invoice_number: "INV-001",
      issue_date: "2026-01-15",
      due_date: "2026-02-15",
      credit_days: 30,
      credit_due_date: null,
      reference_po: null,
    },
    amounts: {
      net_amount_ex_vat: 1000,
      vat_amount: 70,
      total_amount: 1070,
      discount_amount: 0,
      currency: "THB",
      is_vat_included: false,
    },
    line_items: [
      {
        description: "Service A",
        quantity: 1,
        unit_price: 1000,
        discount: 0,
        total: 1000,
        category: null,
      },
    ],
    confidence: {
      overall: 0.9,
      weighted: 0.85,
      per_field: {
        issuer_tax_id: 0.95,
        total_amount: 0.9,
        vat_amount: 0.9,
        invoice_number: 0.92,
        issue_date: 0.88,
      },
      ...overrides,
    },
  };
}

function makeValidation(overallValid = true): ValidationResult {
  return {
    lineItemCheck: { isValid: true, failures: [] },
    subtotalCheck: { isValid: true, expected: 1000, got: 1000 },
    vatCheck: { isValid: true, expected: 70, got: 70 },
    grandTotalCheck: { isValid: true, expected: 1070, got: 1070 },
    overallValid,
  };
}

function highConfResult(): TierResult {
  return {
    tier: 1,
    data: makeData({ weighted: 0.85 }),
    validation: makeValidation(true),
    escalationReasons: [],
    costUsd: 0.001,
    inputTokens: 100,
    outputTokens: 50,
    model: "claude-haiku-4-5-20251001",
  };
}

function lowConfResult(): TierResult {
  return {
    tier: 1,
    data: makeData({ weighted: 0.5 }),
    validation: makeValidation(false),
    escalationReasons: [],
    costUsd: 0.001,
    inputTokens: 100,
    outputTokens: 50,
    model: "claude-haiku-4-5-20251001",
  };
}

describe("extractDocument pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns Tier 1 result when confidence is high", async () => {
    mockedTier1.mockResolvedValue(highConfResult());

    const result = await extractDocument("some raw text", "tenant-123", "doc-123");

    expect(result.tierUsed).toBe(1);
    expect(result.allTierResults).toHaveLength(1);
    expect(result.data.confidence.weighted).toBe(0.85);
    expect(result.totalCostUsd).toBeCloseTo(0.001);
    expect(mockedTier2).not.toHaveBeenCalled();
    expect(mockedTier3).not.toHaveBeenCalled();
  });

  it("escalates to Tier 2 when Tier 1 confidence is low", async () => {
    const lowTier1 = lowConfResult();
    mockedTier1.mockResolvedValue(lowTier1);

    const tier2Result: TierResult = {
      tier: 2,
      data: makeData({ weighted: 0.85 }),
      validation: makeValidation(true),
      escalationReasons: [],
      costUsd: 0.005,
      inputTokens: 200,
      outputTokens: 100,
      model: "claude-sonnet-4-6-20250514",
    };
    mockedTier2.mockResolvedValue(tier2Result);

    const result = await extractDocument("some raw text", "tenant-123", "doc-123");

    expect(result.tierUsed).toBe(2);
    expect(result.allTierResults).toHaveLength(2);
    expect(result.totalCostUsd).toBeCloseTo(0.006);
    expect(mockedTier1).toHaveBeenCalledOnce();
    expect(mockedTier2).toHaveBeenCalledOnce();
    expect(mockedTier3).not.toHaveBeenCalled();
  });

  it("escalates to Tier 3 when Tier 2 also fails and image is provided", async () => {
    mockedTier1.mockResolvedValue(lowConfResult());

    const lowTier2: TierResult = {
      tier: 2,
      data: makeData({ weighted: 0.5 }),
      validation: makeValidation(false),
      escalationReasons: [],
      costUsd: 0.005,
      inputTokens: 200,
      outputTokens: 100,
      model: "claude-sonnet-4-6-20250514",
    };
    mockedTier2.mockResolvedValue(lowTier2);

    const tier3Result: TierResult = {
      tier: 3,
      data: makeData({ weighted: 0.9 }),
      validation: makeValidation(true),
      escalationReasons: [],
      costUsd: 0.01,
      inputTokens: 300,
      outputTokens: 150,
      model: "claude-sonnet-4-6-20250514",
    };
    mockedTier3.mockResolvedValue(tier3Result);

    const result = await extractDocument(
      "some raw text",
      "tenant-123",
      "doc-123",
      "base64data",
      "image/jpeg"
    );

    expect(result.tierUsed).toBe(3);
    expect(result.allTierResults).toHaveLength(3);
    expect(result.totalCostUsd).toBeCloseTo(0.016);
    expect(mockedTier1).toHaveBeenCalledOnce();
    expect(mockedTier2).toHaveBeenCalledOnce();
    expect(mockedTier3).toHaveBeenCalledOnce();
  });

  it("does not escalate to Tier 3 when no image is provided", async () => {
    mockedTier1.mockResolvedValue(lowConfResult());

    const lowTier2: TierResult = {
      tier: 2,
      data: makeData({ weighted: 0.5 }),
      validation: makeValidation(false),
      escalationReasons: [],
      costUsd: 0.005,
      inputTokens: 200,
      outputTokens: 100,
      model: "claude-sonnet-4-6-20250514",
    };
    mockedTier2.mockResolvedValue(lowTier2);

    const result = await extractDocument("some raw text", "tenant-123", "doc-123");

    expect(result.tierUsed).toBe(2);
    expect(result.allTierResults).toHaveLength(2);
    expect(mockedTier3).not.toHaveBeenCalled();
  });

  it("handles Tier 1 timeout gracefully", async () => {
    mockedTier1.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(highConfResult()), 60_000))
    );

    // Override timeout by testing with a very short timeout is tricky,
    // so we test that the error is caught and empty result returned
    mockedTier1.mockRejectedValue(new Error("Tier timeout after 30000ms"));

    const result = await extractDocument("some raw text", "tenant-123", "doc-123");

    expect(result.tierUsed).toBe(1);
    expect(result.data.confidence.weighted).toBe(0);
    expect(result.allTierResults).toHaveLength(1);
  });

  it("falls back to Tier 1 result when Tier 2 fails", async () => {
    mockedTier1.mockResolvedValue(lowConfResult());
    mockedTier2.mockRejectedValue(new Error("API error"));

    const result = await extractDocument("some raw text", "tenant-123", "doc-123");

    expect(result.tierUsed).toBe(1);
    expect(result.allTierResults).toHaveLength(1);
    expect(result.data.confidence.weighted).toBe(0.5);
  });

  it("tries Tier 3 when Tier 2 fails and image is available", async () => {
    mockedTier1.mockResolvedValue(lowConfResult());
    mockedTier2.mockRejectedValue(new Error("API error"));

    const tier3Result: TierResult = {
      tier: 3,
      data: makeData({ weighted: 0.88 }),
      validation: makeValidation(true),
      escalationReasons: [],
      costUsd: 0.01,
      inputTokens: 300,
      outputTokens: 150,
      model: "claude-sonnet-4-6-20250514",
    };
    mockedTier3.mockResolvedValue(tier3Result);

    const result = await extractDocument(
      "some raw text",
      "tenant-123",
      "doc-123",
      "base64data",
      "image/png"
    );

    expect(result.tierUsed).toBe(3);
    expect(result.allTierResults).toHaveLength(2); // tier1 + tier3 (tier2 failed)
    expect(mockedTier3).toHaveBeenCalledOnce();
  });
});

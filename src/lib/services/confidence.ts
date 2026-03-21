const FIELD_WEIGHTS: Record<string, number> = {
  issuer_tax_id: 3.0,
  vat_amount: 3.0,
  document_type: 2.0,
  issuer_name: 1.5,
  invoice_date: 1.5,
  invoice_number: 1.0,
  net_amount_ex_vat: 1.0,
  total_amount: 0.5,
};

type ConfidenceField = { confidence?: number } | undefined;

export function calculateWeightedConfidence(
  fields: Record<string, ConfidenceField>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(FIELD_WEIGHTS)) {
    const field = fields[key];
    if (!field || typeof field.confidence !== "number") continue;

    weightedSum += field.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : Number((weightedSum / totalWeight).toFixed(4));
}

export function calculateOverallConfidence(
  fields: Record<string, ConfidenceField>
): number {
  const scores = Object.values(fields)
    .map((f) => f?.confidence)
    .filter((v): v is number => typeof v === "number");

  if (!scores.length) return 0;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 100) / 100;
}


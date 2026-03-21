export function validateAmountEquation({
  subtotal,
  vat,
  grandTotal,
}: {
  subtotal: number | string | null;
  vat: number | string | null;
  grandTotal: number | string | null;
}) {
  const sub = Number(subtotal);
  const vatAmount = Number(vat);
  const total = Number(grandTotal);

  if (![sub, vatAmount, total].every((value) => Number.isFinite(value))) {
    return {
      isValid: false,
      expectedTotal: null,
      tolerance: 0.05,
      difference: null,
    };
  }

  const expectedTotal = Number((sub + vatAmount).toFixed(2));
  const difference = Number((total - expectedTotal).toFixed(2));

  return {
    isValid: Math.abs(difference) <= 0.05,
    expectedTotal,
    tolerance: 0.05,
    difference,
  };
}


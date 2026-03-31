import type {
  ExtractedAmounts,
  ExtractedLineItem,
  ValidationResult,
  LineItemValidation,
  AmountCheck,
} from "../types";

const TOLERANCE = 1.0;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

function validateLineItems(lineItems: ExtractedLineItem[]): LineItemValidation {
  const failures: { index: number; expected: number; got: number }[] = [];

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    if (
      item.quantity === null ||
      item.unit_price === null ||
      item.total === null
    ) {
      continue;
    }

    const discount = item.discount ?? 0;
    const expected = item.quantity * item.unit_price - discount;

    if (!approxEqual(expected, item.total)) {
      failures.push({ index: i, expected, got: item.total });
    }
  }

  return { isValid: failures.length === 0, failures };
}

function validateSubtotal(
  amounts: ExtractedAmounts,
  lineItems: ExtractedLineItem[]
): AmountCheck {
  if (amounts.net_amount_ex_vat === null) {
    return { isValid: true, expected: null, got: null };
  }

  const itemsWithTotals = lineItems.filter((item) => item.total !== null);
  if (itemsWithTotals.length === 0) {
    return { isValid: true, expected: null, got: null };
  }

  const sumTotals = itemsWithTotals.reduce(
    (sum, item) => sum + (item.total as number),
    0
  );
  const invoiceDiscount = amounts.discount_amount ?? 0;
  const expected = sumTotals - invoiceDiscount;

  return {
    isValid: approxEqual(expected, amounts.net_amount_ex_vat),
    expected,
    got: amounts.net_amount_ex_vat,
  };
}

function validateVat(amounts: ExtractedAmounts): AmountCheck {
  if (
    amounts.net_amount_ex_vat === null ||
    amounts.vat_amount === null ||
    amounts.vat_amount === 0
  ) {
    return { isValid: true, expected: null, got: null };
  }

  const expected = amounts.net_amount_ex_vat * 0.07;

  return {
    isValid: approxEqual(expected, amounts.vat_amount),
    expected,
    got: amounts.vat_amount,
  };
}

function validateGrandTotal(amounts: ExtractedAmounts): AmountCheck {
  if (
    amounts.net_amount_ex_vat === null ||
    amounts.total_amount === null
  ) {
    return { isValid: true, expected: null, got: null };
  }

  const vat = amounts.vat_amount ?? 0;
  const expected = amounts.net_amount_ex_vat + vat;

  return {
    isValid: approxEqual(expected, amounts.total_amount),
    expected,
    got: amounts.total_amount,
  };
}

export function validateAmounts(
  amounts: ExtractedAmounts,
  lineItems: ExtractedLineItem[]
): ValidationResult {
  const lineItemCheck = validateLineItems(lineItems);
  const subtotalCheck = validateSubtotal(amounts, lineItems);
  const vatCheck = validateVat(amounts);
  const grandTotalCheck = validateGrandTotal(amounts);

  const overallValid =
    lineItemCheck.isValid &&
    subtotalCheck.isValid &&
    vatCheck.isValid &&
    grandTotalCheck.isValid;

  return {
    lineItemCheck,
    subtotalCheck,
    vatCheck,
    grandTotalCheck,
    overallValid,
  };
}

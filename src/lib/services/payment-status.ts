export type PaymentStatus = "open" | "partial" | "paid" | "overdue";

/**
 * Compute the payment status of an invoice.
 *
 * Logic (evaluated in order):
 *   1. paymentSum >= grandTotal → "paid"
 *   2. dueDate < today && paymentSum < grandTotal → "overdue"
 *   3. paymentSum > 0 && paymentSum < grandTotal → "partial"
 *   4. else → "open"
 */
export function computePaymentStatus(
  grandTotal: number,
  paymentSum: number,
  dueDate: string | null,
  today: Date = new Date(),
): PaymentStatus {
  if (paymentSum >= grandTotal) {
    return "paid";
  }

  if (dueDate) {
    const due = new Date(dueDate);
    // Strip time component for date-only comparison
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDate_ = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (dueDate_ < todayDate && paymentSum < grandTotal) {
      return "overdue";
    }
  }

  if (paymentSum > 0 && paymentSum < grandTotal) {
    return "partial";
  }

  return "open";
}

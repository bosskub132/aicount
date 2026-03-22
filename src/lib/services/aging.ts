export type AgingBucketKey = "current" | "d30" | "d60" | "d90" | "overdue";

export interface AgingBuckets {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  overdue: number;
  total: number;
}

/**
 * Determine which aging bucket a single item falls into based on days past due.
 *
 *   not yet due        → "current"
 *   1-30 days past due → "d30"
 *   31-60 days past due → "d60"
 *   61-90 days past due → "d90"
 *   90+ days past due  → "overdue"
 */
export function computeAgingBucket(
  dueDate: string,
  today: Date = new Date(),
): AgingBucketKey {
  const due = new Date(dueDate);
  // Strip time for date-only comparison
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate_ = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffMs = todayDate.getTime() - dueDate_.getTime();
  const daysPastDue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "d30";
  if (daysPastDue <= 60) return "d60";
  if (daysPastDue <= 90) return "d90";
  return "overdue";
}

/**
 * Aggregate multiple items into aging buckets by summing their amounts.
 */
export function aggregateAging(
  items: ReadonlyArray<{ dueDate: string; amount: number }>,
  today: Date = new Date(),
): AgingBuckets {
  const buckets: AgingBuckets = {
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
    overdue: 0,
    total: 0,
  };

  for (const item of items) {
    const bucket = computeAgingBucket(item.dueDate, today);
    buckets[bucket] += item.amount;
    buckets.total += item.amount;
  }

  return buckets;
}

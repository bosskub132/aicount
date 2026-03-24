/**
 * Shared period resolution utility for financial report queries.
 */

export interface PeriodDates {
  start: string; // ISO date: "2026-03-01"
  end: string;   // ISO date: "2026-03-31"
}

/**
 * Resolves a period string + scope into start/end ISO date strings.
 *
 * @param period - e.g. "2026-03", "2026", "2026-Q1"
 * @param scope  - "monthly" | "quarterly" | "yearly"
 */
export function resolvePeriodDates(period: string, scope: string): PeriodDates {
  const now = new Date();

  if (scope === "yearly") {
    const year = parseInt(period, 10) || now.getFullYear();
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }

  if (scope === "quarterly") {
    const match = period.match(/^(\d{4})-Q([1-4])$/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const quarter = parseInt(match[2], 10);
      const startMonth = (quarter - 1) * 3;
      const endDate = new Date(year, startMonth + 3, 0);
      return {
        start: formatDate(new Date(year, startMonth, 1)),
        end: formatDate(endDate),
      };
    }
    // Fallback: current quarter
    const quarter = Math.floor(now.getMonth() / 3);
    const endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    return {
      start: formatDate(new Date(now.getFullYear(), quarter * 3, 1)),
      end: formatDate(endDate),
    };
  }

  // Default: monthly
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const month = parseInt(monthStr, 10) || now.getMonth() + 1;
  const endDate = new Date(year, month, 0);
  return {
    start: formatDate(new Date(year, month - 1, 1)),
    end: formatDate(endDate),
  };
}

/**
 * Shifts a PeriodDates by a comparison mode.
 * Returns the equivalent period for prior_month or prior_year.
 */
export function shiftPeriod(
  dates: PeriodDates,
  comparison: "prior_month" | "prior_year"
): PeriodDates {
  const start = new Date(dates.start);
  const end = new Date(dates.end);

  if (comparison === "prior_year") {
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
    // Adjust end day for month-boundary edge case (e.g. Feb)
    const adjustedEnd = new Date(
      end.getFullYear(),
      end.getMonth() + 1,
      0
    );
    return {
      start: formatDate(start),
      end: formatDate(adjustedEnd),
    };
  }

  // prior_month
  start.setMonth(start.getMonth() - 1);
  const adjustedEnd = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0
  );
  return {
    start: formatDate(start),
    end: formatDate(adjustedEnd),
  };
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

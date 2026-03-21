const thaiNumberFormat = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const thaiDateFormat = new Intl.DateTimeFormat("th-TH", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatCurrency(amount: number | string | null): string {
  if (amount === null || amount === undefined) return "0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return thaiNumberFormat.format(num);
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return thaiDateFormat.format(d);
}

export function formatDateExpress(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear() + 543; // Buddhist Era
  return `${dd}/${mm}/${yyyy}`;
}

export function formatTaxId(taxId: string): string {
  if (taxId.length !== 13) return taxId;
  return `${taxId[0]}-${taxId.slice(1, 5)}-${taxId.slice(5, 10)}-${taxId.slice(10, 12)}-${taxId[12]}`;
}

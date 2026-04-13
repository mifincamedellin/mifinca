export type Currency = "COP" | "USD";

export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export function formatCurrencyCompact(amount: number, currency: Currency): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (currency === "USD") {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
    return `${sign}$${Math.round(abs)}`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export function currencyInputDisplay(raw: string, currency: Currency): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  return n.toLocaleString(currency === "USD" ? "en-US" : "es-CO");
}

export function currencyInputRaw(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

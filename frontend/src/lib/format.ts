// Money is stored in minor units (pesewas / cents). All currencies we support use 2 decimals.

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GH", { style: "currency", currency, minimumFractionDigits: 2 }).format(
      minor / 100,
    );
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

/** "79.99" → 7999. Returns null for invalid input. */
export function toMinor(major: string | number): number | null {
  const n = typeof major === "number" ? major : Number(String(major).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** 7999 → "79.99" (for form inputs). */
export function toMajorInput(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function formatDate(iso: string, withTime = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  READY: "Ready",
  DELIVERED: "Delivered",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

export function whatsappLink(number: string, text?: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

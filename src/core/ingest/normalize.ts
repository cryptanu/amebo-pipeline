export interface Money {
  amount: number | null;
  currency: "USD" | "NGN" | null;
  raw: string;
}

const EMPTYISH = new Set(["", "n/a", "na", "none", "-"]);

/**
 * Parse a free-text revenue field into a structured Money value.
 * Never throws: unparseable input yields { amount: null, currency: null }.
 * No FX conversion — the currency travels with the number.
 */
export function parseMoney(raw: string): Money {
  const trimmed = raw.trim();
  if (EMPTYISH.has(trimmed.toLowerCase())) {
    return { amount: null, currency: null, raw };
  }

  let currency: Money["currency"] = null;
  let body = trimmed;

  if (body.startsWith("₦")) {
    currency = "NGN";
    body = body.slice(1);
  } else if (/^N(?=[\d,])/.test(body)) {
    currency = "NGN";
    body = body.slice(1);
  } else if (body.startsWith("$")) {
    currency = "USD";
    body = body.slice(1);
  }

  const numeric = body.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(numeric)) {
    return { amount: null, currency: null, raw };
  }

  return { amount: Number(numeric), currency: currency ?? "USD", raw };
}

export type Recurring = "yes" | "no" | "partial" | "unknown";

export function normalizeRecurring(raw: string): Recurring {
  switch (raw.trim().toLowerCase()) {
    case "yes":
      return "yes";
    case "no":
      return "no";
    case "partially":
    case "partial":
      return "partial";
    default:
      return "unknown";
  }
}

export type Stage = "idea" | "pre_seed" | "seed" | "revenue" | "other";

export function normalizeStage(raw: string): Stage {
  switch (raw.trim().toLowerCase()) {
    case "idea":
      return "idea";
    case "pre-seed":
    case "pre seed":
    case "preseed":
      return "pre_seed";
    case "seed":
      return "seed";
    case "revenue":
      return "revenue";
    default:
      return "other";
  }
}

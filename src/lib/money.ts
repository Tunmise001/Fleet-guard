/**
 * Money arithmetic in kobo, as exact integers.
 *
 * Every amount crossing this module is a decimal STRING ("1234.56"), never a
 * number. Postgres `numeric` comes back as a string from the `postgres` driver
 * and must stay one: `parseFloat("0.1") + parseFloat("0.2")` is 0.30000000000000004,
 * and a balance that drifts by a fraction of a kobo per transaction is a
 * ledger that cannot be reconciled.
 *
 * Kobo are Nigeria's minor unit — 100 kobo to ₦1 — so two decimal places is
 * the full precision the currency has.
 */

const MINOR_UNITS = 2;
const SCALE = 100n; // 10 ** MINOR_UNITS

export class MoneyError extends Error {}

/** "1234.5" | "1234.56" | "-12" -> bigint kobo. Throws on anything else. */
export function toKobo(amount: string): bigint {
  const raw = amount.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new MoneyError(
      `Not a valid amount: ${JSON.stringify(amount)} (expected digits with up to ${MINOR_UNITS} decimal places)`,
    );
  }

  const negative = raw.startsWith("-");
  const [naira, fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  const kobo = BigInt(naira) * SCALE + BigInt(fraction.padEnd(MINOR_UNITS, "0"));
  return negative ? -kobo : kobo;
}

/** bigint kobo -> "1234.56". Always exactly two decimal places. */
export function fromKobo(kobo: bigint): string {
  const negative = kobo < 0n;
  const abs = negative ? -kobo : kobo;
  const naira = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(MINOR_UNITS, "0");
  return `${negative ? "-" : ""}${naira}.${fraction}`;
}

export function add(a: string, b: string): string {
  return fromKobo(toKobo(a) + toKobo(b));
}

export function sub(a: string, b: string): string {
  return fromKobo(toKobo(a) - toKobo(b));
}

export function mul(amount: string, factor: string): string {
  // Used for litres × unit price. Rounds half-up at the kobo, which is what a
  // pump receipt does.
  const scaled = toKobo(amount) * toKobo(factor);
  const rounded = (scaled + (scaled < 0n ? -SCALE : SCALE) / 2n) / SCALE;
  return fromKobo(rounded);
}

export function lt(a: string, b: string): boolean {
  return toKobo(a) < toKobo(b);
}

export function gte(a: string, b: string): boolean {
  return toKobo(a) >= toKobo(b);
}

export function isNegative(a: string): boolean {
  return toKobo(a) < 0n;
}

export function isPositive(a: string): boolean {
  return toKobo(a) > 0n;
}

const NGN = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Full precision: "₦1,234.56". For ledgers and balances. */
export function formatNaira(amount: string): string {
  return NGN.format(Number(amount));
}

const COMPACT = new Intl.NumberFormat("en-NG", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Abbreviated: "₦1.2M", "₦340k". For stat tiles where the exact kobo is noise.
 * Replaces the `₦{(n / 1000).toFixed(0)}k` that was inlined in two places and
 * rendered "₦0k" for everything under ₦500.
 */
export function formatNairaCompact(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1000) return `₦${Math.round(n)}`;
  return `₦${COMPACT.format(n)}`;
}

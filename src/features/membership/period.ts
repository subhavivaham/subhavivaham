// A plan's duration is free text an admin types into the plan editor ("3
// months", "30 Days", "forever"). Everything that needs an expiry date reads it
// back through here, so the memberships screen, payment approval, renewal and
// the member's own quota reads all agree on how long a plan runs.

export type PeriodUnit = "day" | "month" | "year";

export interface PlanPeriod {
  amount: number;
  unit: PeriodUnit;
}

// Reads the number and the unit out of a period string. "forever", "free" and
// anything else with no usable number mean the plan never expires, which the
// callers represent as a null date.
export function parsePeriod(period: unknown): PlanPeriod | null {
  const text = String(period ?? "").toLowerCase();
  const match = text.match(/(\d+)\s*(day|days|week|weeks|month|months|year|years)?/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2] ?? "months";
  if (unit.startsWith("day")) return { amount, unit: "day" };
  // a week is stored as seven days so addPeriod only has three branches to keep
  // in step
  if (unit.startsWith("week")) return { amount: amount * 7, unit: "day" };
  if (unit.startsWith("year")) return { amount, unit: "year" };
  return { amount, unit: "month" };
}

/** Today as YYYY-MM-DD, the same plain-date form renews_on is stored in. */
export function todayDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// The date a term starting on `from` runs out, as YYYY-MM-DD, or null when the
// plan has no readable duration (the free tier's "forever"). Dates are moved in
// utc so the value matches the utc date todayDate produces.
export function addPeriod(from: Date, period: unknown): string | null {
  const parsed = parsePeriod(period);
  if (!parsed) return null;

  const next = new Date(from);
  if (parsed.unit === "day") next.setUTCDate(next.getUTCDate() + parsed.amount);
  else if (parsed.unit === "year") next.setUTCFullYear(next.getUTCFullYear() + parsed.amount);
  else next.setUTCMonth(next.getUTCMonth() + parsed.amount);
  return todayDate(next);
}

// A subscription is live through the end of its renews_on day, so it has expired
// only once that day is behind us. A null date never expires.
export function hasExpired(renewsOn: string | null | undefined, now: Date = new Date()): boolean {
  const expiry = renewsOn ? String(renewsOn).slice(0, 10) : "";
  if (!expiry) return false;
  return expiry < todayDate(now);
}

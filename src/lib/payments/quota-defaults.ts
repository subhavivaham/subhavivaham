// Per-plan default quotas, split out of quotas.ts so client code can read the
// built-in numbers without dragging in db.ts (and mysql2 / node's net+tls) into
// the browser bundle. quotas.ts re-exports these, so existing imports are
// unaffected; the live values still come from membership_plans at read time.

export type MemberPlan = "free" | "silver" | "premium";

export const PHOTO_QUOTA: Record<MemberPlan, number> = {
  free: 1,
  silver: 5,
  premium: 10,
};

/** Monthly interest sends per plan; null means unlimited. */
export const INTEREST_QUOTA: Record<MemberPlan, number | null> = {
  free: 3,
  silver: 25,
  premium: null,
};

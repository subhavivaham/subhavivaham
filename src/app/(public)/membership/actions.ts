"use server";

// self-service paid-plan checkout. the member pays through UPI, uploads a
// screenshot and this action files a pending request; an admin reconciles it
// against the bank statement and approving the request is what actually grants
// the plan. nothing here activates a membership on its own.
//
// mysql has no row level security, so the member identity is taken from the
// session and every write is explicitly scoped to that user_id; status is
// pinned to 'pending' here so a forged payload cannot mark itself approved.
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { q1, run } from "@/lib/db";
import { assertMember } from "@/lib/data/member-dal";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import {
  MAX_PAYMENT_SCREENSHOT_BYTES,
  PAYMENT_SCREENSHOT_BUCKET,
  PAYMENT_SCREENSHOT_TYPES,
  paymentScreenshotSizeError,
  photoExtension,
} from "@/lib/constants";

export type PaymentRequestResult = { ok: true } | { ok: false; error: string };

// the id shown on the admin queue and quoted in support
function newPaymentId(): string {
  return `pay-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function submitPaymentRequest(
  planId: string,
  formData: FormData
): Promise<PaymentRequestResult> {
  let member;
  try {
    member = await assertMember();
  } catch {
    return { ok: false, error: "Please sign in to complete your payment." };
  }

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please attach your payment screenshot." };
  }
  if (!(PAYMENT_SCREENSHOT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "The screenshot must be JPEG, PNG or WebP." };
  }
  if (file.size > MAX_PAYMENT_SCREENSHOT_BYTES) {
    return { ok: false, error: paymentScreenshotSizeError(file.size) };
  }

  // the price is read here rather than trusted from the browser, so a tampered
  // payload cannot file a request for a rupee.
  const plan = await q1<{ id: string; label: string; price: number }>(
    "select id, label, price from membership_plans where id = ?",
    [planId]
  );
  if (!plan) return { ok: false, error: "That plan is no longer available." };
  if (Number(plan.price) <= 0) {
    return { ok: false, error: "This plan does not need a payment." };
  }

  // one pending request per member per plan: a second screenshot must not be
  // uploaded and filed while the admin still has the original to reconcile.
  const existing = await q1(
    "select payment_id from membership_payments where user_id = ? and plan = ? and status = 'pending' limit 1",
    [member.userId, plan.id]
  );
  if (existing) {
    return {
      ok: false,
      error:
        "You already have a pending payment request for this plan. Our team will verify it within 24 hours.",
    };
  }

  // the first folder is the member's user_id, so a member can only ever write
  // under their own prefix
  const key = `${member.userId}/${randomUUID()}.${photoExtension(file.type)}`;
  const screenshotUrl = await saveUpload(PAYMENT_SCREENSHOT_BUCKET, key, file, file.type);

  try {
    await run(
      "insert into membership_payments (payment_id, user_id, plan, plan_name, member_name, amount, screenshot_path, status) " +
        "values (?, ?, ?, ?, ?, ?, ?, 'pending')",
      [newPaymentId(), member.userId, plan.id, plan.label, member.name, Number(plan.price), screenshotUrl]
    );
  } catch (error) {
    // the row is the record the admin reconciles against, so a failed insert
    // must not leave a screenshot with nothing pointing at it
    await deleteUpload(PAYMENT_SCREENSHOT_BUCKET, key);
    return { ok: false, error: `Could not record your payment: ${error instanceof Error ? error.message : "unknown error"}` };
  }

  revalidatePath("/membership");
  return { ok: true };
}

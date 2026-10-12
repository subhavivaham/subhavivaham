"use server";

// self-service paid-plan checkout. the member pays through UPI, uploads a
// screenshot and this action files a pending request; an admin reconciles it
// against the bank statement and approving the request is what actually grants
// the plan. nothing here activates a membership on its own.
//
// the row is written with the member's own session, so rls is the boundary:
// membership_payments only admits an insert whose user_id is the caller and
// whose status is pinned to 'pending', so a forged payload cannot mark itself
// approved.
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { assertMember } from "@/lib/data/member-dal";
import {
  MAX_PAYMENT_SCREENSHOT_BYTES,
  PAYMENT_SCREENSHOT_BUCKET,
  PAYMENT_SCREENSHOT_TYPES,
  paymentScreenshotSizeError,
  photoExtension,
} from "@/lib/constants";

export type PaymentRequestResult = { ok: true } | { ok: false; error: string };

// the id shown on the admin queue and quoted in support. short and prefixed so
// it reads as a payment rather than a subscription id.
function newPaymentId(): string {
  return `pay-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
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

  const supabase = await getSupabaseServer();

  // the price is read here rather than trusted from the browser, so a tampered
  // payload cannot file a request for a rupee.
  const { data: plan, error: planError } = await supabase
    .from("membership_plans")
    .select("id, label, price")
    .eq("id", planId)
    .maybeSingle();
  if (planError) return { ok: false, error: `Could not load the plan: ${planError.message}` };
  if (!plan) return { ok: false, error: "That plan is no longer available." };
  if (Number(plan.price) <= 0) {
    return { ok: false, error: "This plan does not need a payment." };
  }

  // one pending request per member per plan. the member's own read policy lets
  // this lookup run under their session, and catching it here stops a second
  // screenshot from being uploaded and a duplicate row filed on top of the first
  // while the admin still has the original to reconcile.
  const { data: existing } = await supabase
    .from("membership_payments")
    .select("payment_id")
    .eq("user_id", member.userId)
    .eq("plan", plan.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error:
        "You already have a pending payment request for this plan. Our team will verify it within 24 hours.",
    };
  }

  // the first folder is the member's user_id, which is exactly what the storage
  // insert policy checks, so a member can only ever write under their own prefix.
  const path = `${member.userId}/${crypto.randomUUID()}.${photoExtension(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_SCREENSHOT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Could not upload the screenshot: ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from("membership_payments").insert({
    payment_id: newPaymentId(),
    user_id: member.userId,
    plan: plan.id,
    plan_name: plan.label,
    member_name: member.name,
    amount: Number(plan.price),
    screenshot_path: path,
    status: "pending",
  });
  if (insertError) {
    // the row is the record the admin reconciles against, so a failed insert
    // must not leave a screenshot with nothing pointing at it
    await supabase.storage.from(PAYMENT_SCREENSHOT_BUCKET).remove([path]);
    return { ok: false, error: `Could not record your payment: ${insertError.message}` };
  }

  revalidatePath("/membership");
  return { ok: true };
}

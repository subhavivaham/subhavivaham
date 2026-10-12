"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ArrowLeft, BadgeCheck, Check, Copy, LogIn, ShieldCheck, Upload } from "lucide-react";
import type { MembershipPlan } from "@/types";
import {
  MAX_PAYMENT_SCREENSHOT_BYTES,
  PAYMENT_SCREENSHOT_ACCEPT,
  UPI_ID,
  formatBytes,
} from "@/lib/constants";
import { submitPaymentRequest } from "@/app/(public)/membership/actions";
import { useAuth } from "@/features/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CheckboxField } from "@/components/ui/checkbox";
import qrCode from "@/assets/subha_vivaham_qr.jpeg";

// paid-plan checkout. the modal opens for everyone: a signed-out visitor sees the
// terms, the QR/UPI to pay into and a sign-in route, while a signed-in member
// reviews the same terms, agrees, then uploads a screenshot of the payment.
// Confirming files a pending request for an admin to reconcile; it does not grant
// the plan.
export function PlanCheckout({
  plan,
  open,
  onClose,
  initialStep = "terms",
}: {
  plan: MembershipPlan;
  open: boolean;
  onClose: () => void;
  initialStep?: "terms" | "pay";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"terms" | "pay">(initialStep);
  const [busy, startTransition] = useTransition();
  const { user, isLoading } = useAuth();

  // closing always starts clean, so a second plan never inherits the last
  // attempt's file or tick. done here rather than on open so no effect has to
  // synchronously reset state when the modal appears.
  const close = () => {
    setFile(null);
    setAgreed(false);
    setError("");
    setCopied(false);
    setDone(false);
    setStep("terms");
    onClose();
  };

  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setError("");
    if (picked && picked.size > MAX_PAYMENT_SCREENSHOT_BYTES) {
      setFile(null);
      setError(`The screenshot must be ${formatBytes(MAX_PAYMENT_SCREENSHOT_BYTES)} or smaller.`);
      event.target.value = "";
      return;
    }
    setFile(picked);
  };

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard is best-effort; the id is on screen regardless */
    }
  };

  const confirm = () => {
    if (!file) {
      setError("Please attach your payment screenshot.");
      return;
    }
    if (!agreed) {
      setError("Please confirm you have paid and agree to the terms.");
      return;
    }
    setError("");
    const formData = new FormData();
    formData.set("screenshot", file);
    startTransition(async () => {
      const result = await submitPaymentRequest(plan.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  };

  // the terms step shows the terms, the QR/UPI and the agreement box; Next
  // carries that agreement forward and moves on to the screenshot upload.
  const goToPay = () => {
    if (!agreed) {
      setError("Please agree to the terms to continue.");
      return;
    }
    setError("");
    setStep("pay");
  };

  // shared between the signed-out prompt and the checkout form, so the terms and
  // the way to pay are on screen whether or not the member has signed in yet.
  const termsBox = (
    <div className="rounded-2xl border border-charcoal-100 bg-ivory-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-charcoal-800">
        <ShieldCheck className="h-4 w-4 text-wine-600" />
        Please read before you pay
      </p>
      <ul className="mt-3 space-y-2 text-sm text-charcoal-600">
        <li className="flex items-start gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-wine-500" />
          {plan.label} costs ₹{plan.price.toLocaleString("en-IN")}.
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-wine-500" />
          <span>
            Pay that exact amount by UPI to the bank account name{" "}
            <strong className="font-semibold text-charcoal-700">VISWANATHAN R</strong> — scan the
            QR or pay the UPI id on the right.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-wine-500" />
          Upload a clear screenshot of the successful payment.
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-wine-500" />
          Our team verifies it within 24 hours, and your plan activates once it is confirmed.
        </li>
        <li className="flex items-start gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-wine-500" />
          Memberships are digital and non-refundable.
        </li>
      </ul>
    </div>
  );

  const qrBlock = (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-charcoal-100 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-400">
        Scan to pay ₹{plan.price.toLocaleString("en-IN")}
      </p>
      <Image
        src={qrCode}
        alt="Scan to pay"
        width={260}
        height={260}
        className="h-[260px] w-[260px] rounded-xl border border-charcoal-100 object-contain"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-charcoal-400">UPI id</span>
        <code className="rounded-lg bg-ivory-100 px-3 py-1.5 text-sm font-semibold text-charcoal-900">
          {UPI_ID}
        </code>
        <button
          type="button"
          onClick={copyUpi}
          aria-label="Copy UPI id"
          className="rounded-lg p-2 text-charcoal-500 transition-colors hover:bg-charcoal-100 hover:text-wine-700"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-charcoal-400">
        Open any UPI app or scan the QR, pay, then screenshot the receipt.
      </p>
    </div>
  );

  if (done) {
    return (
      <Modal open={open} onClose={close} size="md" title="Payment submitted">
        <div className="space-y-5 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <BadgeCheck className="h-7 w-7" />
          </span>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold text-charcoal-900">We have your payment proof</p>
            <p className="mx-auto max-w-md text-sm text-charcoal-500">
              Our team verifies the payment and your <strong>{plan.label}</strong> plan activates
              within 24 hours. You will not be charged again.
            </p>
          </div>
          <Button onClick={close} fullWidth>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  const loginHref = `/login?next=${encodeURIComponent(`/membership?plan=${plan.id}`)}`;

  // the terms/QR modal is shown to everyone, signed in or not, and the sign-in
  // button is always present. a signed-out visitor is sent to /login and returns
  // here through AutoPlanOpener; a signed-in member advances straight to the
  // screenshot upload, so the payment is filed against their own profile.
  const termsModal = (
    <Modal
      open={open && step === "terms"}
      onClose={close}
      size="xl"
      title={`Choose ${plan.label}`}
      description={`Pay ₹${plan.price.toLocaleString("en-IN")} by UPI, then sign in to upload your screenshot.`}
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
          <div className="space-y-5">
            {termsBox}

            <CheckboxField
              checked={agreed}
              onChange={(next) => {
                setAgreed(next);
                setError("");
              }}
              label="I have read and agree to the terms above."
            />

            {error && (
              <p role="alert" className="text-sm font-medium text-wine-700">
                {error}
              </p>
            )}
          </div>

          {qrBlock}
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end">
          {user ? (
            <Button
              type="button"
              size="lg"
              disabled={!agreed}
              onClick={goToPay}
              className="w-full sm:w-auto"
            >
              <LogIn className="h-4 w-4" /> Sign in to continue
            </Button>
          ) : (
            <Button
              href={loginHref}
              size="lg"
              disabled={!agreed || isLoading}
              className="w-full sm:w-auto"
            >
              <LogIn className="h-4 w-4" /> Sign in to continue
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );

  const uploadModal = (
    <Modal
      open={open && step === "pay"}
      onClose={close}
      size="sm"
      title="Upload your screenshot"
      description="Attach your payment screenshot to finish."
    >
      <div className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-charcoal-200 bg-ivory-50 px-4 py-6 text-center transition-colors hover:border-wine-300 hover:bg-wine-50/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
            <Upload className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-charcoal-700">
            {file ? file.name : "Attach payment screenshot"}
          </span>
          <span className="text-xs text-charcoal-400">
            JPEG, PNG or WebP, up to {formatBytes(MAX_PAYMENT_SCREENSHOT_BYTES)}
          </span>
          <input
            type="file"
            accept={PAYMENT_SCREENSHOT_ACCEPT}
            className="hidden"
            onChange={choose}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-wine-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("");
              setStep("terms");
            }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button type="button" onClick={confirm} disabled={!file} loading={busy}>
            <Check className="h-4 w-4" /> Confirm payment
          </Button>
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      {termsModal}
      {uploadModal}
    </>
  );
}

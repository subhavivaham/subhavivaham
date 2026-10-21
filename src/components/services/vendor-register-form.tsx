"use client";

import { useActionState, useState } from "react";
import { Building2, CheckCircle2, Store } from "lucide-react";
import { registerVendorAction, type VendorState } from "@/app/(public)/vendor-register/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { SERVICE_TYPE_LABELS, SERVICE_TYPES } from "@/features/services/types";

const initial: VendorState = { ok: false };

export function VendorRegisterForm() {
  const [state, formAction, pending] = useActionState<VendorState, FormData>(
    registerVendorAction,
    initial
  );

  // the category is mirrored into state so the address box can appear for a
  // mandapam and disappear for everything else. it is not read back from the
  // form on mount: the server rejects a mandapam without an address either way,
  // so a returning visitor is told what is missing rather than shown a box that
  // silently does not matter.
  const [type, setType] = useState("");

  if (state.ok) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-8 text-center sm:p-10">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-charcoal-900">
          Thank you — we have your details
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-600">
          Our team reviews every listing before it goes live, so this usually takes one working day.
          We will call you on the number you gave us to confirm.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="/services" size="lg">
            <Store className="h-4 w-4" /> Browse services
          </Button>
          <Button href="/" variant="outline" size="lg">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-3xl border border-charcoal-200 bg-white p-6 shadow-card sm:p-8">
      <div className="mb-6 flex items-center gap-3.5 border-b border-charcoal-100 pb-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wine-50 text-wine-700">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-charcoal-900">Your details</h2>
          <p className="text-sm text-charcoal-500">Same details our team asks for over the phone.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* field names, order and required flags mirror the admin vendor form
            exactly, so a listing can never arrive in the queue that the admin
            screen would then reject. the labels are deliberately the same words. */}
        <Select
          label="Category"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          error={state.errors?.type}
        >
          <option value="" disabled>
            Choose one
          </option>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {SERVICE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        <Input
          label="Vendor name"
          name="name"
          required
          maxLength={120}
          placeholder="e.g. Sri Murugan Kalyana Mandapam"
          error={state.errors?.name}
        />

        <Input
          label="Contact person"
          name="contact"
          maxLength={80}
          placeholder="e.g. K. Senthil"
          error={state.errors?.contact}
        />

        <Input
          label="City"
          name="city"
          required
          maxLength={80}
          placeholder="e.g. Tuticorin"
          error={state.errors?.city}
        />

        {/* only a mandapam. unmounting rather than hiding is deliberate: an input
            that is display:none is still submitted, so switching back to another
            category would keep a stale address in the payload. */}
        {type === "mandapam" && (
          <div className="sm:col-span-2">
            <Input
              label="Hall address"
              name="address"
              required
              maxLength={200}
              placeholder="e.g. 12, Gandhi Nagar, Tirunelveli Main Road"
              error={state.errors?.address}
            />
          </div>
        )}

        <Input
          label="Phone"
          name="phone"
          type="tel"
          required
          maxLength={20}
          autoComplete="tel"
          placeholder="e.g. 88839 43711"
          error={state.errors?.phone}
        />

        <div className="sm:col-span-2">
          <Textarea
            label="Details"
            name="details"
            maxLength={1000}
            rows={5}
            className="min-h-[88px]"
            placeholder="Capacity, services offered…"
            error={state.errors?.details}
          />
        </div>
      </div>

      {state.error && (
        <p className="mt-5 rounded-xl bg-wine-50 px-4 py-3 text-sm font-medium text-wine-700">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth loading={pending} className="mt-6">
        <Store className="h-4 w-4" /> Submit for review
      </Button>
    </form>
  );
}

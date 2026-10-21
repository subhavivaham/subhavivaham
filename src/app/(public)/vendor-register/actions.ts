"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/db";
import { SERVICE_TYPES, type ServiceType } from "@/features/services/types";
import { sendVendorRegistrationEmail } from "@/features/services/notify";

export interface VendorState {
  ok: boolean;
  error?: string;
  /** per-field messages, so the form can mark the offending input */
  errors?: Record<string, string>;
}

// a phone here is typed by a human and dialled by a member, so the only real
// requirement is that it is plausibly a number. anything stricter rejects the
// landline formats the offices actually publish.
const PHONE_PATTERN = /^[+()\-\s\d]{7,20}$/;

// length caps keep a single anonymous request from parking a wall of text in a
// column that renders on the public services page
const LIMITS = { name: 120, contact: 80, city: 80, address: 200, phone: 20, details: 1000 } as const;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function registerVendorAction(
  _previous: VendorState,
  formData: FormData
): Promise<VendorState> {
  const name = field(formData, "name");
  const type = field(formData, "type");
  const contact = field(formData, "contact");
  const city = field(formData, "city");
  const address = field(formData, "address");
  const phone = field(formData, "phone");
  const details = field(formData, "details");

  const errors: Record<string, string> = {};
  // name, city and phone are required, matching the admin vendor form. contact
  // stays optional there, so it is optional here too.
  if (!name) errors.name = "Vendor name is required.";
  else if (name.length > LIMITS.name) errors.name = `Keep this under ${LIMITS.name} characters.`;

  if (!SERVICE_TYPES.includes(type as ServiceType)) errors.type = "Choose the category you fall under.";

  if (contact.length > LIMITS.contact) errors.contact = `Keep this under ${LIMITS.contact} characters.`;

  if (!city) errors.city = "City is required.";
  else if (city.length > LIMITS.city) errors.city = `Keep this under ${LIMITS.city} characters.`;

  // a mandapam is the one category a family has to travel to, so the street is
  // required there. every other category is a service that comes to them.
  if (type === "mandapam") {
    if (!address) errors.address = "Hall address is required.";
    else if (address.length > LIMITS.address)
      errors.address = `Keep this under ${LIMITS.address} characters.`;
  } else if (address.length > LIMITS.address) {
    errors.address = `Keep this under ${LIMITS.address} characters.`;
  }

  if (!phone) errors.phone = "Phone number is required.";
  else if (!PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid phone number.";
  else if (phone.length > LIMITS.phone) errors.phone = `Keep this under ${LIMITS.phone} characters.`;

  if (details.length > LIMITS.details) errors.details = `Keep this under ${LIMITS.details} characters.`;

  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Please correct the highlighted fields.", errors };
  }

  try {
    await run(
      "insert into service_providers (service_id, type, name, contact, city, address, phone, details, is_approved, active) " +
        "values (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)",
      [
        `svc-${crypto.randomUUID().slice(0, 8)}`,
        type,
        name,
        contact || null,
        city || null,
        // dropped for any category that is not a mandapam: a value left over from
        // switching categories must not ride along into a catering listing
        type === "mandapam" ? address || null : null,
        phone || null,
        details || null,
      ]
    );

    // the admin list shows pending submissions, so refresh it for whoever is on
    // screen. the public services page is not revalidated: nothing about this
    // submission changed it.
    revalidatePath("/admin/services");

    // best effort: the row is safely stored, so a mail outage must not turn a
    // successful registration into an error for the vendor.
    const mail = await sendVendorRegistrationEmail({
      name,
      type: type as ServiceType,
      phone,
      contact,
      city,
      address,
      details,
    });
    if (!mail.ok) console.error("Vendor registration mail failed:", mail.error);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `We could not save that just now. Please try again, or call us on 88839 43711.`
          : "We could not save that just now. Please try again.",
    };
  }
}

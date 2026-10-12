import { Resend } from "resend";
import { SERVICE_TYPE_LABELS, type ServiceType } from "./types";

const apiKey = process.env.RESEND_API_KEY;

export const isMailConfigured = Boolean(apiKey);

const from = process.env.EMAIL_FROM || "Subha Vivaham <onboarding@resend.dev>";
const notifyTo = process.env.VENDOR_NOTIFY_EMAIL || "subhavivaham2017@gmail.com";

export interface VendorRegistrationNotifier {
  name: string;
  type: ServiceType;
  phone: string;
  contact?: string;
  city?: string;
  address?: string;
  details?: string;
}

export interface MemberRegistrationNotifier {
  fullName: string;
  email: string;
  mobile: string;
  gender: string;
  age: number | null;
  dateOfBirth?: string;
  maritalStatus: string;
  city?: string;
  district?: string;
  state?: string;
  community?: string;
  religion?: string;
  motherTongue?: string;
  education?: string;
  profession?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px;font-weight:600;white-space:nowrap;">${label}</td><td style="padding:6px 12px;">${escapeHtml(
    value
  )}</td></tr>`;
}

export async function sendVendorRegistrationEmail(
  vendor: VendorRegistrationNotifier
): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const label = SERVICE_TYPE_LABELS[vendor.type] ?? vendor.type;

  const rows = [
    row("Vendor name", vendor.name),
    row("Type", label),
    row("Phone", vendor.phone),
  ];
  if (vendor.contact) rows.push(row("Contact person", vendor.contact));
  if (vendor.city) rows.push(row("City", vendor.city));
  if (vendor.address) rows.push(row("Address", vendor.address));
  if (vendor.details) rows.push(row("Details", vendor.details));

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <h2 style="margin:0 0 4px;">New vendor registration</h2>
      <p style="margin:0 0 16px;color:#4b5563;">
        A vendor has registered on the website and needs to be verified.
      </p>
      <table style="border-collapse:collapse;font-size:14px;">${rows.join("")}</table>
      <p style="margin:16px 0 0;color:#4b5563;">
        Review and approve this submission from the admin services page.
      </p>
    </div>
  `;

  const text = [
    "New vendor registration — needs verification",
    `Vendor name: ${vendor.name}`,
    `Type: ${label}`,
    `Phone: ${vendor.phone}`,
    vendor.contact ? `Contact person: ${vendor.contact}` : null,
    vendor.city ? `City: ${vendor.city}` : null,
    vendor.address ? `Address: ${vendor.address}` : null,
    vendor.details ? `Details: ${vendor.details}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: notifyTo,
      subject: `New vendor registration: ${vendor.name} (${label})`,
      html,
      text,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown mail error.",
    };
  }
}

export async function sendMemberRegistrationEmail(
  member: MemberRegistrationNotifier
): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const age = member.age && member.age > 0 ? `${member.age} years` : member.dateOfBirth || null;
  const location = [member.city, member.district, member.state].filter(Boolean).join(", ") || null;

  const rows = [
    row("Name", member.fullName),
    row("Email", member.email),
    row("Mobile", member.mobile),
    row("Gender", member.gender),
    member.maritalStatus ? row("Marital status", member.maritalStatus) : null,
    age ? row("Age", age) : null,
    member.community ? row("Community", member.community) : null,
    member.religion ? row("Religion", member.religion) : null,
    member.motherTongue ? row("Mother tongue", member.motherTongue) : null,
    member.education ? row("Education", member.education) : null,
    member.profession ? row("Profession", member.profession) : null,
    location ? row("Location", location) : null,
  ].filter((r): r is string => r !== null);

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <h2 style="margin:0 0 4px;">New member registration</h2>
      <p style="margin:0 0 16px;color:#4b5563;">
        A new member has registered on the website and needs to be verified.
      </p>
      <table style="border-collapse:collapse;font-size:14px;">${rows.join("")}</table>
      <p style="margin:16px 0 0;color:#4b5563;">
        Review and verify this profile from the admin profiles page.
      </p>
    </div>
  `;

  const text = [
    "New member registration — needs verification",
    `Name: ${member.fullName}`,
    `Email: ${member.email}`,
    `Mobile: ${member.mobile}`,
    `Gender: ${member.gender}`,
    member.maritalStatus ? `Marital status: ${member.maritalStatus}` : null,
    age ? `Age: ${age}` : null,
    member.community ? `Community: ${member.community}` : null,
    member.religion ? `Religion: ${member.religion}` : null,
    member.motherTongue ? `Mother tongue: ${member.motherTongue}` : null,
    member.education ? `Education: ${member.education}` : null,
    member.profession ? `Profession: ${member.profession}` : null,
    location ? `Location: ${location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: notifyTo,
      subject: `New member registration: ${member.fullName}`,
      html,
      text,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown mail error.",
    };
  }
}

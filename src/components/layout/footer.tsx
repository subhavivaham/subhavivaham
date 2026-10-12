import Link from "next/link";
import {
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { BRAND, CONTAINER } from "@/lib/constants";
import { cn } from "@/lib/utils";

// mirrors PUBLIC_NAV, so the two menus can never disagree about a public page
const exploreLinks = [
  { label: "Home", href: "/" },
  { label: "Porutham", href: "/jathagam" },
  { label: "Communities", href: "/communities" },
  { label: "Temples", href: "/temples" },
  // { label: "Success Stories", href: "/success-stories" },
  { label: "Membership", href: "/membership" },
  { label: "Services", href: "/services" },
];

// only the entry points into an account. dashboard and admin are reached from
// signing in, so listing them here just invited people into a wall of redirects.
const accountLinks = [
  { label: "Admin Login", href: "/admin" },
  { label: "Profile Register", href: "/register" },
  { label: "Vendor Register", href: "/vendor-register" },
];

const contactLinks = [
  {
    icon: MessageCircle,
    label: "WhatsApp / Mobile",
    value: BRAND.whatsapp,
    href: `tel:${BRAND.phone.replace(/[^+\d]/g, "")}`,
  },
  {
    icon: Mail,
    label: "Email",
    value: BRAND.email,
    href: `mailto:${BRAND.email}`,
  },
];

const socialLinks = [
  { label: "Instagram", href: BRAND.socials.instagram },
  { label: "Facebook", href: BRAND.socials.facebook },
  { label: "X (Twitter)", href: BRAND.socials.twitter },
];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-white">
      {children}
    </h3>
  );
}

export function Footer({ officeAddress }: { officeAddress?: string }) {
  return (
    <footer className="mt-20 bg-charcoal-950 text-charcoal-300">
      <div className={cn("py-14", CONTAINER)}>
        <div className="grid gap-x-8 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5 xl:col-span-4">
            <Logo variant="light" size="lg" />
            <p className="mt-5 font-display text-lg text-gold-300">
              {BRAND.tagline}
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-charcoal-400">
              {BRAND.oneLiner}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-medium text-charcoal-300 ring-1 ring-white/10 transition-colors hover:bg-gold-500 hover:text-charcoal-950"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <FooterHeading>Explore</FooterHeading>
            <ul className="space-y-3 text-sm">
              {exploreLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-charcoal-400 transition-colors hover:text-gold-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <FooterHeading>Account</FooterHeading>
            <ul className="space-y-3 text-sm">
              {accountLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-charcoal-400 transition-colors hover:text-gold-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <FooterHeading>Registered Offices</FooterHeading>
            <ul className="space-y-4 text-sm">
              {officeAddress
                ? officeAddress
                    .split(/\r?\n/)
                    .map((a) => a.trim())
                    .filter(Boolean)
                    .map((address) => (
                      <li key={address} className="flex items-start gap-2.5 text-charcoal-400">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                        <span className="font-semibold text-charcoal-200">{address}</span>
                      </li>
                    ))
                : BRAND.offices.map((office) => (
                  <li
                    key={office.name}
                    className="flex items-start gap-2.5 text-charcoal-400"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <span>
                      <span className="block font-semibold text-charcoal-200">
                        {office.name}
                      </span>
                      {office.address}
                    </span>
                  </li>
                ))}
            </ul>
            <ul className="mt-6 space-y-3 text-sm">
              {contactLinks.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center gap-2.5 text-charcoal-400"
                >
                  <c.icon className="h-4 w-4 shrink-0 text-gold-500" />
                  <a
                    href={c.href}
                    className="transition-colors hover:text-gold-400"
                  >
                    {c.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-6 text-center text-xs text-charcoal-500">
          <p>
            © {new Date().getFullYear()} {BRAND.name} ({BRAND.nameTamil}). All
            rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
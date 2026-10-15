import type { Metadata } from "next";
import { JathagamCalculator } from "@/components/jathagam/jathagam-calculator";
import { isJathagamConfigured } from "@/features/jathagam/service";
import { pageSeo } from "@/lib/seo";

// rendered per request so the engine availability is read from the runtime
// environment. if this page were statically prerendered, isJathagamConfigured()
// would be frozen at build time, and a deploy whose build lacked
// JATHAGAM_API_URL would keep serving the "being configured" fallback forever.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageSeo({
  title: "ஜாதக பொருத்தம் — Subha Vivaham Matrimony",
  description:
    "Check Natchathram Porutham between bride and groom. Ashtakoota, the 10 Tamil poruthams and dosha checks, worked out from birth details.",
  path: "/jathagam",
});

export default function JathagamPage() {
  // the engine base url is a server-side secret, so availability is checked here
  // and passed down as a plain boolean. without it the page still renders, with an
  // explanation instead of a form that would fail on submit.
  return <JathagamCalculator enabled={isJathagamConfigured()} />;
}

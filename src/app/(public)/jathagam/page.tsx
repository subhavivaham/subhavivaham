import type { Metadata } from "next";
import { JathagamCalculator } from "@/components/jathagam/jathagam-calculator";
import { isJathagamConfigured } from "@/features/jathagam/service";

export const metadata: Metadata = {
  title: "ஜாதக பொருத்தம் — Subha Vivaham Matrimony",
  description:
    "Check Natchathram Porutham between bride and groom. Ashtakoota, the 10 Tamil poruthams and dosha checks, worked out from birth details.",
};

export default function JathagamPage() {
  // the engine base url is a server-side secret, so availability is checked here
  // and passed down as a plain boolean. without it the page still renders, with an
  // explanation instead of a form that would fail on submit.
  return <JathagamCalculator enabled={isJathagamConfigured()} />;
}

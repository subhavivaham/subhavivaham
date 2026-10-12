"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTAINER } from "@/lib/constants";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How are profiles verified?",
    a: "Every member submits a valid government ID and a live photo. Our team manually reviews each one to confirm identity before the verified badge is issued.",
  },
  {
    q: "Is my information private?",
    a: "Yes. Contact details are hidden until two people are connected. You control what is visible through granular privacy settings.",
  },
  {
    q: "How does the matching work?",
    a: "We match on community, values, education, profession, lifestyle and preferences — surfaced as a match percentage for your reference. It's a guide, not a guarantee.",
  },
  {
    q: "Can my family help manage my profile?",
    a: "Absolutely. Many Indian families prefer to be involved — you can choose to manage your profile independently or together with a parent or sibling.",
  },
  {
    q: "What if I need to report a member?",
    a: "Every profile has Report and Block options. Our trust & safety team reviews reports within 24 hours and takes appropriate action.",
  },
  {
    q: "Do you offer refunds if I don't find a match?",
    a: "Our membership plans are demo-only right now. In production, paused packets and refund policies will be clearly stated before purchase.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className={CONTAINER}>
      <SectionHeading
        eyebrow="FAQ"
        title="Questions, answered"
        description="Everything you need to know before you start your journey."
      />
      <div className="mx-auto max-w-3xl space-y-3">
        {faqs.map((faq, i) => {
          const open = openIndex === i;
          return (
            <div key={faq.q} className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white shadow-sm">
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
              >
                <span className="text-base font-semibold text-charcoal-900">{faq.q}</span>
                <ChevronDown
                  className={cn("h-5 w-5 shrink-0 text-charcoal-400 transition-transform", open && "rotate-180 text-wine-600")}
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-charcoal-600">{faq.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
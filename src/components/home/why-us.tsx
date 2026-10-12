import { ShieldCheck, Sparkles, Lock, Users } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { CONTAINER } from "@/lib/constants";

const features = [
  {
    icon: ShieldCheck,
    title: "Verified profiles",
    details:
      "Every profile is manually reviewed and identity-verified so you only connect with genuine people.",
  },
  {
    icon: Sparkles,
    title: "Thoughtful matching",
    details:
      "Our matching considers community, values, lifestyle and goals — not just filters on a form.",
  },
  {
    icon: Lock,
    title: "Privacy you control",
    details:
      "Share contact details only when you're ready. You decide what stays visible and what doesn't.",
  },
  {
    icon: Users,
    title: "Family-first support",
    details:
      "Sensitive guidance from our care team at every step — from first interest to the wedding day.",
  },
];

export function WhyChooseUs() {
  return (
    <section className={`${CONTAINER} py-20 sm:py-28`}>
      <SectionHeading
        eyebrow="Why Subha Vivaham"
        title="A better way to find your person"
        description="We combine modern technology with traditional values to help you find a life partner you can truly trust."
      />
<RevealGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <RevealItem key={f.title} className="h-full">
          <div
            className="group h-full rounded-3xl border border-charcoal-100 bg-white p-7 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-wine-50 text-wine-700 transition-colors group-hover:bg-wine-700 group-hover:text-white">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-semibold text-charcoal-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{f.details}</p>
          </div>
            </RevealItem>
          ))}
        </RevealGroup>
    </section>
  );
}
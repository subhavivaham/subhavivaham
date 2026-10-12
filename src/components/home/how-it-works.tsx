import { Phone, UserPlus, Sparkles, Heart } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { CONTAINER } from "@/lib/constants";

const steps = [
  {
    icon: Phone,
    step: "01",
    title: "Contact Us",
    tamil: "தொடர்பு கொள்ளுங்கள்",
    details:
      "Call or WhatsApp R. Viswanathan at 85086 30290. Visit our Tuticorin offices in Murappanadu or Vallanadu anytime.",
  },
  {
    icon: UserPlus,
    step: "02",
    title: "Register Profile",
    tamil: "பதிவு செய்யுங்கள்",
    details:
      "Share your details, horoscope, family background and preferences. Our team creates your profile personally — no agents involved.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "Jathagam Matching",
    tamil: "ஜாதக பொருத்தம்",
    details:
      "Our experienced team conducts a complete 10-porutham horoscope analysis to ensure genuine compatibility before any introduction.",
  },
  {
    icon: Heart,
    step: "04",
    title: "Meet & Marry",
    tamil: "சந்தித்து திருமணம் செய்யுங்கள்",
    details:
      "Arrange family meetings and finalize the match. We support you throughout — from first introduction to your Tamil wedding day.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow="எவ்வாறு செயல்படுகிறது"
          title="How It Works"
          description="A personal, trust-based process — the Subhavivaham way from Tuticorin"
        />
        <RevealGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <RevealItem key={s.step} className="h-full">
            <div className="relative h-full rounded-3xl border border-charcoal-100 bg-white p-7 shadow-card">
              <span className="absolute right-6 top-6 font-display text-4xl font-semibold text-charcoal-100" aria-hidden>
                {s.step}
              </span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-gold-700">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-semibold text-charcoal-900">{s.title}</h3>
              <p className="mt-1 text-sm font-medium text-wine-700">{s.tamil}</p>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{s.details}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="hidden h-px w-10 bg-charcoal-200 lg:absolute lg:-right-5 lg:top-1/2 lg:block xl:w-6"
                />
              )}
            </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
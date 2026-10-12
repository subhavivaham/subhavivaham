import Image from "next/image";
import { Quote } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTAINER } from "@/lib/constants";

const stories = [
  {
    names: "Shreya & Aditya",
    location: "Kochi, Kerala",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    quote:
      "We matched at 92% and connected within a week. Both families met through the platform's guided flow. Nine months later, we were married.",
  },
  {
    names: "Nisha & Rohit",
    location: "Mumbai, Maharashtra",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    quote:
      "As working professionals, we barely had time to meet people. Subha Vivaham understood what mattered — values, family and goals. It just felt right.",
  },
  {
    names: "Kavya & Arjun",
    location: "Bangalore, Karnataka",
    image: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80",
    quote:
      "The verification gave our families confidence. We talked for six weeks before meeting, and by then we already knew we were meant for each other.",
  },
];

export function SuccessStories() {
  return (
    <section className={CONTAINER}>
      <SectionHeading
        eyebrow="Success stories"
        title="Journeys that began on Subha Vivaham"
        description="Real couples who found their person — and the families who celebrated with them."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {stories.map((story) => (
          <figure
            key={story.names}
            className="relative rounded-3xl border border-charcoal-100 bg-white p-7 shadow-card transition-shadow hover:shadow-card-hover"
          >
            <Quote className="absolute right-6 top-6 h-8 w-8 text-gold-200" aria-hidden />
            <div className="mb-5 flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full">
                <Image src={story.image} alt={story.names} fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <figcaption className="font-semibold text-charcoal-900">{story.names}</figcaption>
                <p className="text-xs text-charcoal-500">{story.location}</p>
              </div>
            </div>
            <blockquote className="text-sm leading-relaxed text-charcoal-600">
              &ldquo;{story.quote}&rdquo;
            </blockquote>
          </figure>
        ))}
      </div>
    </section>
  );
}
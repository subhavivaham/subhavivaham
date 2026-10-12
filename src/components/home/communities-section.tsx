import { SectionHeading } from "@/components/ui/section-heading";
import { CONTAINER } from "@/lib/constants";

export function CommunitiesSection() {
  return (
    <section className="py-10 sm:py-12">
      <div className={CONTAINER}>
        <SectionHeading
          eyebrow="அனைத்து தமிழ் சமூகங்கள்"
          title="All Tamil Communities"
          description="Proudly serving all Tamil sub-communities from Tuticorin and across Tamil Nadu"
          className="mb-0 sm:mb-0"
        />
      </div>
    </section>
  );
}
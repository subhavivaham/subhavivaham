import { Button } from "@/components/ui/button";
import { CONTAINER } from "@/lib/constants";

export function FinalCta() {
  return (
    <section className={`${CONTAINER} py-20 sm:py-24`}>
      <div className="relative overflow-hidden rounded-[2rem] bg-wine-800 px-8 py-16 text-center shadow-soft sm:px-16 sm:py-20">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.28),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(51,8,22,0.55),transparent_60%)]"
        />
        <div className="relative">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
            இன்றே தொடங்குங்கள்
          </p>
          <h2 className="mx-auto max-w-2xl font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
            குடும்ப நம்பிக்கையுடன், அர்த்தமுள்ள வாழ்க்கைத் துணையைக் கண்டறியுங்கள்.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/70">
            Thousands of families trust Subha Vivaham to find their son&apos;s or
            daughter&apos;s life partner — with jathagam matching, verification, and
            respect.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
            <Button
              href="/register"
              size="md"
              variant="gold"
              className="w-full sm:w-auto"
            >
              இலவச சுயவிவரம் உருவாக்குங்கள்
            </Button>
            <Button
              href="/search"
              size="md"
              className="w-full border border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
            >
              சுயவிவரங்களைப் பார்க்க
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
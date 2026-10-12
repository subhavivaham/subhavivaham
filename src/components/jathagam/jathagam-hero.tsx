import { ArrowDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPlate, Rule } from "@/components/ui/hero-plate";
import { RASI_TAMIL } from "@/features/jathagam/data";

const READOUT = [
  { value: "8", label: "Koota" },
  { value: "36", label: "Ashtakoota points" },
  { value: "10", label: "Tamil Porutham" },
  { value: "Instant", label: "Free result" },
];

// the outer rim of the wheel, in viewBox units. the glow behind the wheel is
// sized from this same radius, which is what keeps the two circles aligned.
const RIM = 192;

/**
 * A point on the wheel from its radius and an angle measured clockwise from
 * twelve o'clock, which is where Mesham sits. marks are placed this way rather
 * than by rotating a parent group, so nothing depends on how a browser resolves
 * a transform origin on an svg child.
 */
function polar(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: 200 + radius * Math.cos(radians),
    y: 200 + radius * Math.sin(radians),
  };
}

/**
 * The ornamental chart wheel. Purely decorative — the numbers a visitor needs are
 * in the readout beside it — so it is hidden from assistive tech and the
 * rotating rings are slowed to a crawl rather than animated at a pace that
 * would compete with the heading for attention.
 */
function ChartWheel() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
    >
      {/* the twelve houses, each a tick on the rim carrying its rasi name */}
      <g>
        {RASI_TAMIL.map((rasi, i) => {
          const tickOuter = polar(RIM, i * 30);
          const tickInner = polar(RIM - 16, i * 30);
          const marker = polar(RIM - 30, i * 30);
          const label = polar(RIM - 52, i * 30);

          return (
            <g key={rasi}>
              <line
                x1={tickOuter.x}
                y1={tickOuter.y}
                x2={tickInner.x}
                y2={tickInner.y}
                className="stroke-gold-500/45"
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r="2"
                className="fill-gold-400/60"
                stroke="none"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-gold-200/80 text-[10px] sm:text-[12px] lg:text-[13px]"
                stroke="none"
              >
                {rasi}
              </text>
            </g>
          );
        })}
      </g>

      <circle cx="200" cy="200" r={RIM} className="stroke-gold-500/25" />
      <circle
        cx="200"
        cy="200"
        r="176"
        className="stroke-gold-400/25"
        strokeDasharray="2 10"
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "var(--animate-orbit)",
        }}
      />
      <circle cx="200" cy="200" r="122" className="stroke-gold-500/20" />

      {/* the twelve-pointed star of the rashi chakra */}
      <g
        className="stroke-gold-400/30"
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: "var(--animate-orbit-reverse)",
        }}
      >
        <circle cx="200" cy="200" r="104" strokeDasharray="14 8" />
        {Array.from({ length: 12 }, (_, i) => {
          const end = polar(104, i * 15);
          return (
            <line
              key={i}
              x1={200 - (end.x - 200)}
              y1={200 - (end.y - 200)}
              x2={end.x}
              y2={end.y}
            />
          );
        })}
      </g>

      {/* the ashtakoota octagram at the centre, drawn as a square and its
          diamond so it needs no rotation of its own */}
      <g className="stroke-gold-300/45">
        <circle cx="200" cy="200" r="66" />
        <rect x="153" y="153" width="94" height="94" rx="6" />
        <polygon points="200,133.5 266.5,200 200,266.5 133.5,200" strokeLinejoin="round" />
      </g>

      <circle
        cx="200"
        cy="200"
        r="30"
        className="fill-wine-900/70 stroke-gold-400/50"
        style={{ animation: "var(--animate-shimmer)" }}
      />
    </svg>
  );
}

export function JathagamHero() {
  return (
    <HeroPlate>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-6 pb-16 sm:px-6 sm:pt-10 sm:pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-24">
        <div className="relative z-[1] text-center lg:text-left">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.34em] text-gold-300 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            ஜாதக பொருத்தம்
          </p>

          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Jathagam{" "}
            <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent">
              Porutham
            </span>
          </h1>

          <div className="mx-auto mt-7 max-w-md lg:mx-0">
            <Rule />
          </div>

          <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
            Enter both birth details with their city, and the Rasi, Nakshatra and
            Pada are worked out for you. Every koota and porutham is checked and
            shown in full — nothing is rounded up to a flattering number.
          </p>

          <dl className="mx-auto mt-10 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4 lg:mx-0">
            {READOUT.map((item) => (
              <div key={item.label} className="bg-wine-950 px-3 py-4 sm:px-4">
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="block font-display text-xl font-semibold text-gold-300 sm:text-2xl">
                    {item.value}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase leading-tight tracking-[0.12em] text-white/50 sm:text-[11px] sm:tracking-[0.14em]">
                    {item.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex justify-center lg:justify-start">
            <Button href="#porutham-form" size="lg" variant="gold" className="w-full sm:w-auto">
              Calculate Porutham
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* one square box holds both the glow and the wheel, so the two circles
            cannot drift apart at any width */}
        <div className="relative mx-auto aspect-square w-full max-w-sm lg:max-w-none">
          <div
            aria-hidden
            className="animate-shimmer absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.22),transparent_68%)] blur-xl"
          />
          <div className="absolute inset-0">
            <ChartWheel />
          </div>
        </div>
      </div>
    </HeroPlate>
  );
}

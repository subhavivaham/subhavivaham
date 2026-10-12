"use client";

import { motion } from "framer-motion";

/**
 * The invitation card. Front cover carries the brand and bilingual title; when
 * `opening` flips true the cover rotates open in 3D (perspective comes from
 * the parent in wedding-intro) revealing the inner greeting panel. The card
 * opens on its own — there is no button to press.
 */
export function InvitationCard({
  opening,
  onOpeningComplete,
}: {
  opening: boolean;
  onOpeningComplete: () => void;
}) {
  return (
    <div className="relative w-[min(88vw,380px)] sm:w-[400px]">
      {/* soft glow that swells as the card opens */}
      <motion.div
        aria-hidden
        className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.35),transparent_70%)] blur-2xl"
        initial={{ opacity: 0.35 }}
        animate={{ opacity: opening ? 0.9 : 0.35, scale: opening ? 1.25 : 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      <div className="relative aspect-[3/4.4]" style={{ transformStyle: "preserve-3d" }}>
        {/* inner greeting, revealed as the cover rotates away */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-gold-500/50 bg-ivory-50 px-8 text-center shadow-[0_24px_80px_-16px_rgba(0,0,0,0.55)]">
          <span aria-hidden className="text-2xl text-gold-500">✦</span>
          <p className="font-display text-xl text-wine-800">நல்வரவு</p>
          <p className="font-display text-lg italic leading-snug text-charcoal-700">
            Your search for your Bride / Groom begins here
          </p>
          <span aria-hidden className="mt-1 h-px w-24 bg-gold-500/60" />
          <p className="text-xs uppercase tracking-[0.28em] text-charcoal-400">Subhavivaham</p>
        </div>

        {/* front cover */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-gold-500/60 bg-gradient-to-b from-wine-900 via-wine-950 to-charcoal-950 px-6 py-8 text-center shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)]"
          style={{ transformOrigin: "left center", backfaceVisibility: "hidden" }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: opening ? -158 : 0 }}
          transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={(definition) => {
            if (opening && typeof definition !== "string") onOpeningComplete();
          }}
        >
          {/* fine gold inner frame */}
          <div aria-hidden className="pointer-events-none absolute inset-2.5 rounded-xl border border-gold-500/40" />
          <div aria-hidden className="pointer-events-none absolute inset-4 rounded-lg border border-gold-500/20" />

          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-gold-300">
            உங்கள் திருமணத் தேடல் இங்கே தொடங்குகிறது
          </p>
          <p aria-hidden className="mt-4 text-gold-400">❦</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white sm:text-5xl">
            சுப விவாஹம்
          </h2>
          <p className="mt-1 font-display text-lg tracking-wide text-gold-200">Subhavivaham</p>
          <span aria-hidden className="my-5 h-px w-20 bg-gold-500/50" />
          <p className="max-w-[28ch] text-sm leading-relaxed text-white/80">
            You are about to search for your Bride / Groom — verified profiles,
            blessed matches, one beautiful beginning.
          </p>
        </motion.div>

      </div>
    </div>
  );
}

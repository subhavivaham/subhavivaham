"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { InvitationCard } from "@/components/wedding-intro/invitation-card";
import { OpeningHearts, OpeningPetals } from "@/components/wedding-intro/opening-animation";

type Stage = "intro" | "opening" | "transition" | "home";

// the card shows for this long before opening on its own — long enough to
// read the cover copy
const AUTO_OPEN_MS = 2000;

// survives client-side navigation but resets on a full reload — so the
// invitation plays on entry/refresh, never when tapping Home mid-session
let playedThisSession = false;

function readReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Full-screen wedding invitation overlay shown on every home-page load. The
 * card opens by itself after a beat (or immediately on button tap), little
 * hearts float up, then it hands off to Home. Lives only on the home page so
 * routing, auth and every other page are untouched; the Home content stays
 * mounted behind and this overlay unmounts after the handoff.
 */
export function WeddingIntro() {
  // matchMedia stays out of effects and the server render this way
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, readReducedMotion, () => false);
  const [stage, setStage] = useState<Stage>(() => (playedThisSession ? "home" : "intro"));

  // lock page scroll behind the overlay; the lock releases the moment the
  // handoff finishes, not on unmount (this component stays mounted)
  useEffect(() => {
    if (stage === "home") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [stage]);

  const finish = useCallback(() => {
    playedThisSession = true;
    setStage("home");
  }, []);

  const beginOpening = useCallback(() => {
    setStage((current) => {
      if (current !== "intro") return current;
      // reduced-motion visitors get a minimal fade instead of the full sequence
      return reducedMotion ? "transition" : "opening";
    });
  }, [reducedMotion]);

  // the invitation opens on its own shortly after it appears
  useEffect(() => {
    if (stage !== "intro") return;
    const timer = window.setTimeout(beginOpening, AUTO_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [stage, beginOpening]);

  const effectsVisible = (stage === "opening" || stage === "transition") && !reducedMotion;

  return (
    <AnimatePresence>
      {stage !== "home" && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Wedding invitation opening"
          // present from the very first paint (server HTML included) so the
          // home page never flashes before the invitation on a refresh
          initial={false}
          animate={{
            opacity: 1,
            // melt into the home hero's ivory ground during the handoff, so the
            // page revealed behind no longer feels like a different scene
            backgroundColor: stage === "transition" ? "#fffdf4" : "#330816",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: stage === "transition" ? 0.9 : 0.35 }}
        >
          {/* gold washes + faint motif texture, echoing the site hero plates */}
          <motion.div
            aria-hidden
            className="absolute inset-0"
            initial={false}
            animate={{ opacity: stage === "transition" ? 0 : 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.18),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(122,24,50,0.6),transparent_65%)]" />
            <div className="absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(45deg,rgba(212,175,55,0.25)_0px,rgba(212,175,55,0.25)_1px,transparent_1px,transparent_14px)]" />
          </motion.div>

          {effectsVisible && <OpeningPetals />}
          {effectsVisible && <OpeningHearts />}

          <button
            type="button"
            onClick={finish}
            aria-label="Skip the invitation and go to the home page"
            className="absolute right-4 top-4 z-10 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 sm:right-6 sm:top-6"
          >
            Skip →
          </button>

          {/* perspective stage for the 3D card opening */}
          <motion.div
            style={{ perspective: 1400 }}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={
              stage === "transition"
                ? { opacity: 0, scale: 1.06, y: -24 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={{ duration: reducedMotion ? 0.3 : 0.9, ease: "easeInOut" }}
            onAnimationComplete={(definition) => {
              if (stage === "transition" && typeof definition !== "string") finish();
            }}
          >
            <InvitationCard
              opening={stage === "opening" || stage === "transition"}
              onOpeningComplete={() => setStage("transition")}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

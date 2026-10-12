"use client";

import { Heart } from "lucide-react";

/**
 * Lightweight petal burst for the card-opening moment. Pure CSS keyframe
 * animation (GPU-friendly transform/opacity only, no JS loops). Positions are
 * fixed constants so server and client render identically. Petals past index 5
 * are hidden on phones to keep the effect cheap on mobile.
 */
const PETALS = [
  { left: "6%", delay: "0s", duration: "2.6s", size: 10, drift: "60px", tone: "#e0c34b" },
  { left: "14%", delay: "0.25s", duration: "2.9s", size: 7, drift: "-50px", tone: "#f4e7ab" },
  { left: "24%", delay: "0.1s", duration: "2.4s", size: 9, drift: "70px", tone: "#d05c81" },
  { left: "36%", delay: "0.4s", duration: "3.1s", size: 7, drift: "-60px", tone: "#e0c34b" },
  { left: "48%", delay: "0s", duration: "2.5s", size: 10, drift: "50px", tone: "#f4e7ab" },
  { left: "60%", delay: "0.3s", duration: "2.8s", size: 8, drift: "-55px", tone: "#d05c81" },
  { left: "70%", delay: "0.15s", duration: "2.6s", size: 9, drift: "65px", tone: "#e0c34b" },
  { left: "80%", delay: "0.45s", duration: "3s", size: 7, drift: "-45px", tone: "#f4e7ab" },
  { left: "90%", delay: "0.2s", duration: "2.7s", size: 10, drift: "55px", tone: "#d05c81" },
  { left: "43%", delay: "0.55s", duration: "2.9s", size: 6, drift: "-40px", tone: "#e0c34b" },
  { left: "55%", delay: "0.5s", duration: "2.5s", size: 6, drift: "45px", tone: "#f4e7ab" },
  { left: "30%", delay: "0.6s", duration: "3.2s", size: 6, drift: "35px", tone: "#e0c34b" },
] as const;

export function OpeningPetals() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PETALS.map((petal, i) => (
        <span
          key={i}
          className={i > 5 ? "hidden sm:block" : "block"}
          style={{
            position: "absolute",
            top: 0,
            left: petal.left,
            width: petal.size,
            height: petal.size * 1.25,
            borderRadius: "70% 0 70% 0",
            background: petal.tone,
            opacity: 0,
            ["--petal-drift" as string]: petal.drift,
            animation: `petal-fall ${petal.duration} linear ${petal.delay} both`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A few little hearts that float up from the card as it opens. Same
 * zero-JS approach as the petals: fixed positions, one CSS keyframe each.
 */
const HEARTS = [
  { left: "38%", delay: "0.1s", duration: "2.2s", size: 16, drift: "-46px", tone: "#e0c34b" },
  { left: "47%", delay: "0.35s", duration: "2.5s", size: 12, drift: "30px", tone: "#d05c81" },
  { left: "55%", delay: "0.2s", duration: "2.3s", size: 18, drift: "52px", tone: "#f4e7ab" },
  { left: "62%", delay: "0.5s", duration: "2.6s", size: 12, drift: "-34px", tone: "#e0c34b" },
  { left: "44%", delay: "0.65s", duration: "2.4s", size: 13, drift: "42px", tone: "#d05c81" },
  { left: "51%", delay: "0.8s", duration: "2.7s", size: 10, drift: "-40px", tone: "#f4e7ab" },
] as const;

export function OpeningHearts() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {HEARTS.map((heart, i) => (
        <span
          key={i}
          className={i > 3 ? "hidden sm:block" : "block"}
          style={{
            position: "absolute",
            bottom: "18%",
            left: heart.left,
            color: heart.tone,
            opacity: 0,
            ["--heart-drift" as string]: heart.drift,
            animation: `heart-rise ${heart.duration} ease-out ${heart.delay} both`,
          }}
        >
          <Heart style={{ width: heart.size, height: heart.size }} fill="currentColor" strokeWidth={0} />
        </span>
      ))}
    </div>
  );
}

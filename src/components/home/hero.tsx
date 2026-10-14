"use client";

import Image from "next/image";
import { BadgeCheck, ShieldCheck, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchWidget } from "@/components/search/search-widget";
import { CONTAINER } from "@/lib/constants";
import heroImage from "@/assets/hero_image.jpeg";

export function Hero() {
  return (
    <section className="relative overflow-x-clip bg-ivory-50">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(122,24,50,0.09),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(212,175,55,0.16),transparent_55%)]"
      />
      <div className={`${CONTAINER} relative pt-10 pb-16 sm:pt-12 sm:pb-24`}>
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="relative z-[1] text-center lg:text-left">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400 bg-gradient-to-r from-gold-100 via-gold-50 to-gold-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-800 shadow-sm ring-1 ring-gold-200/70">
              <HeartHandshake className="h-3.5 w-3.5 text-gold-600" />
              Subhavivaham • பாரம்பரிய மதிப்புகளுடன்
            </p>
            <h1 className="font-display text-3xl font-semibold leading-[1.7] tracking-tight text-wine-800 sm:text-4xl sm:leading-[1.6] lg:text-5xl lg:leading-[1.4]">
              உங்கள் வாழ்க்கைத் துணையை{" "}
              <span className="text-gold-600 italic">ஜாதகமும் மனமும் </span>
              இணைந்து தேடுங்கள்.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-charcoal-600 sm:text-lg lg:mx-0">
              Verified profiles, horan porutham and family trust — a Tamil
              matrimony site to find your life partner.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:items-center sm:gap-3">
              <Button
                href="/#featured-profiles"
                size="lg"
                className="w-full whitespace-nowrap px-2 text-sm sm:w-auto sm:px-7 sm:text-base"
              >
                Find Your Partner
              </Button>
              <Button
                href="/register"
                size="lg"
                variant="gold"
                className="w-full whitespace-nowrap px-2 text-sm sm:w-auto sm:px-7 sm:text-base"
              >
                Create Your Profile
              </Button>
            </div>

          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-charcoal-100">
              <Image
                src={heroImage}
                alt="A joyful Indian couple looking ahead together"
                fill
                priority
                sizes="(max-width: 1024px) 512px, 640px"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_top,rgba(122,24,50,0.22),transparent_45%)]"
              />
            </div>
            <div className="absolute -left-6 top-10 hidden rounded-2xl border border-charcoal-100 bg-white px-4 py-3 shadow-card sm:block lg:-left-8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">Verified profiles</p>
                  <p className="text-xs text-charcoal-500">Identity &amp; photo checked</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 bottom-16 hidden rounded-2xl border border-charcoal-100 bg-white px-4 py-3 shadow-card sm:block lg:-right-8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wine-50 text-wine-700">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">Privacy first</p>
                  <p className="text-xs text-charcoal-500">Your data stays yours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${CONTAINER} relative z-[2] pb-14`}>
        <div className="mx-auto max-w-5xl">
          <SearchWidget compact />
        </div>
      </div>
    </section>
  );
}
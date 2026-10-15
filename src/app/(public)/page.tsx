import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { WhyChooseUs } from "@/components/home/why-us";
import { HowItWorks } from "@/components/home/how-it-works";
import { CommunitiesSection } from "@/components/home/communities-section";
// import { JathagamSection } from "@/components/home/jathagam-section";
import { Faq } from "@/components/home/trust-faq";

import { FinalCta } from "@/components/home/cta";
import { FeaturedProfiles } from "@/components/home/featured-profiles";
import { WeddingIntro } from "@/components/wedding-intro/wedding-intro";
import { HomeSearchProvider } from "@/features/search/home-search";
import { loadSearchProfiles } from "@/features/profiles/queries";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "சுப விவாஹம் — Subha Vivaham Matrimony",
  description:
    "தமிழ் பாரம்பரியத்தின் நம்பிக்கையுடன், நவீன தொழில்நுட்பத்தில் உங்கள் வாழ்க்கைத் துணையைத் தேடும் தளம். Verified profiles, jathagam matching and family-trust matrimony.",
  path: "/",
});

export default async function HomePage() {
  // unfiltered and uncapped: the featured grid narrows this in the browser, so
  // slicing here would leave a narrow search with nothing to show
  const profiles = await loadSearchProfiles();

  return (
    <HomeSearchProvider>
      {/* first-visit invitation overlay; renders nothing on repeat visits */}
      <WeddingIntro />
      <Hero />

      <FeaturedProfiles profiles={profiles} />

      <WhyChooseUs />

      <HowItWorks />

      <CommunitiesSection />

      {/* <JathagamSection /> */}

      <Faq />

      <FinalCta />
    </HomeSearchProvider>
  );
}

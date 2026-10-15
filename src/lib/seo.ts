import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

// served straight from public/, so it bypasses the image optimizer and is safe
// to hand to link previews as an absolute url.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/hero_image.jpeg`;

export type PageSeo = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  indexed?: boolean;
};

// one place that turns a page's title/description into the full metadata block
// every public route needs: canonical url, open graph and twitter card. pages
// call this instead of hand-writing those fields so the site name, locale and
// absolute url stay identical across them.
export function pageSeo({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  indexed = true,
}: PageSeo): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Subha Vivaham",
      locale: "ta_IN",
      type,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    ...(indexed ? {} : { robots: { index: false, follow: false } }),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Subha Vivaham",
    alternateName: "சுப விவாஹம்",
    url: SITE_URL,
    logo: `${SITE_URL}/assets/logo/Subhavivaham_favicon.png`,
    description:
      "Tamil matrimony service offering verified profiles, jathagam porutham matching and community-wise bride and groom search.",
    email: "subhavivaham2017@gmail.com",
    telephone: "+91 88839 43711",
    foundingLocation: "Tuticorin, Tamil Nadu, India",
    areaServed: "IN",
    address: {
      "@type": "PostalAddress",
      streetAddress: "1-56/1, Sub Register Off Street, Murappanadu",
      addressLocality: "Tuticorin",
      addressRegion: "Tamil Nadu",
      postalCode: "628 252",
      addressCountry: "IN",
    },
    sameAs: ["https://instagram.com/subhavivaham", "https://www.facebook.com/share/1DvYi71ep3/"],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "Subha Vivaham",
    url: SITE_URL,
    inLanguage: "ta-IN",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

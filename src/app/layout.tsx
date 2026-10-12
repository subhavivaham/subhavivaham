import type { Metadata } from "next";
import { Inter, Playfair_Display, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-tamil",
  subsets: ["latin", "tamil"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "சுப விவாஹம் — Subha Vivaham Matrimony",
  description:
    "தமிழ் பாரம்பரியத்தின் நம்பிக்கையுடன், நவீன தொழில்நுட்பத்தில் உங்கள் வாழ்க்கைத் துணையைத் தேடும் தளம். Verified profiles, jathagam matching and family-trust matrimony.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ta" className={`${inter.variable} ${playfair.variable} ${notoTamil.variable} h-full`} data-scroll-behavior="smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-full flex flex-col bg-ivory-50 text-charcoal-900 antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
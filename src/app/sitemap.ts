import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { fetchCommunities, fetchStories, fetchTemples } from "@/lib/data/queries";

const PUBLIC_PAGES = [
  "/",
  "/jathagam",
  "/communities",
  "/temples",
  "/success-stories",
  "/membership",
  "/services",
  "/register",
  "/vendor-register",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [temples, communities, stories] = await Promise.all([
    fetchTemples(),
    fetchCommunities(),
    fetchStories(),
  ]);

  const staticPages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  return [
    ...staticPages,
    ...temples.map((temple) => ({
      url: `${SITE_URL}/temples/${temple.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...communities.map((community) => ({
      url: `${SITE_URL}/communities/${community.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...stories.map((story) => ({
      url: `${SITE_URL}/success-stories/${story.id}`,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}

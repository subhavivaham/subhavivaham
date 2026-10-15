import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/dashboard",
          "/search",
          "/matches",
          "/interests",
          "/profile",
          "/brides",
          "/grooms",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

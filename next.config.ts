import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "randomuser.me" },
      // member photos live in the supabase storage bucket created by
      // migrations/0001_registration_photo_uploads.sql
      { protocol: "https", hostname: "*.supabase.co" },
      // temple photographs in seed_data.sql point at wikimedia commons, because
      // public/assets holds none. any commons file can be served from this host.
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  experimental: {
    serverActions: {
      // Vercel reports its own host in `x-forwarded-host`, which does not match
      // the host in the browser's `Origin` header. Next.js aborts the action on
      // that CSRF check with a 500 and no message, so every form (admin login
      // included) fails before its action ever runs. Allow the public host.
      allowedOrigins: ["subhavivahamdemo.vercel.app"],
    },
  },
};

export default nextConfig;
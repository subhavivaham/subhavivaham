import type { Metadata } from "next";

// the admin console is for internal use only, so the whole group is kept out of
// search results. the auth guard still lives in admin/(protected)/layout.tsx
// and every server action, because robots directives protect nothing.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// route group root only. the admin guard lives in
// admin/(protected)/layout.tsx so that /admin/login stays reachable.
export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

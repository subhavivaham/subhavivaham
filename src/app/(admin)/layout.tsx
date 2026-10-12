// route group root only. the admin guard lives in
// admin/(protected)/layout.tsx so that /admin/login stays reachable.
export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

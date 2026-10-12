import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentAdmin } from "@/lib/data/admin-dal";
import { AdminLoginForm } from "./admin-login-form";

// never cache, otherwise a fresh visit could bounce a signed-in admin to login
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wine-50 text-wine-700">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-center font-display text-2xl font-semibold text-charcoal-900">
          Admin area
        </h1>
        <p className="mt-2 text-center text-sm text-charcoal-500">
          Restricted access. Sign in with your admin credentials.
        </p>
        <AdminLoginForm />
      </div>
    </div>
  );
}

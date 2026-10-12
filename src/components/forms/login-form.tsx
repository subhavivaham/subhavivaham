"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/features/auth/auth-provider";
import { useToast } from "@/lib/state/toast-provider";
import { STATIC_IMAGES } from "@/lib/constants";

export function LoginForm({ justRegistered = false, next = null }: { justRegistered?: boolean; next?: string | null }) {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // an open redirect would turn /login?next= into a phishing hop, so only a
  // same-origin path is honoured and everything else becomes the dashboard.
  const safeNext = (value: string | null): string => {
    if (value && value.startsWith("/") && !value.startsWith("//")) return value;
    return "/dashboard";
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    let result: Awaited<ReturnType<typeof login>>;
    try {
      result = await login(email, password);
    } catch {
      result = { ok: false, error: "Could not reach the server. Please try again." };
    }
    setSubmitting(false);
    if (result.ok) {
      toast(`Welcome, ${result.user.name.split(" ")[0]}!`);
      // back to where the member was headed (a pending plan checkout keeps its
      // plan query so the modal reopens). only same-origin paths are honoured.
      router.push(safeNext(next));
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl items-stretch gap-14 px-4 py-14 sm:px-6 lg:px-8">
      <div className="hidden max-h-[490px] flex-1 lg:block">
        <div className="relative h-full overflow-hidden rounded-[2rem] shadow-soft">
          <Image
            src={STATIC_IMAGES.heroAlt}
            alt="A happy couple beginning their journey"
            width={640}
            height={800}
            priority
            unoptimized
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-charcoal-950/20 to-transparent" />
          <div className="absolute bottom-0 p-8 text-white">
            <p className="font-display text-3xl font-semibold leading-snug">
              &ldquo;A happy couple beginning their journey.&rdquo;
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1">
        <div className="rounded-3xl border border-charcoal-100 bg-white p-8 shadow-card sm:p-10">
          <h1 className="font-display text-3xl font-semibold text-charcoal-900">Welcome back</h1>
          <p className="mt-2 text-sm text-charcoal-500">
            Sign in to continue your search for the right person.
          </p>

          <form onSubmit={onLogin} className="mt-8 space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
              <div>
                <PasswordInput
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              <div className="mt-3 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-[#7a1832]"
                  />
                  Remember me
                </label>
              </div>
            </div>

            {justRegistered && (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your profile is created. Sign in with the email and password you just
                chose.
              </p>
            )}

            {error && (
              <p className="rounded-xl border border-wine-100 bg-wine-50 px-4 py-3 text-sm text-wine-700">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Login
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal-600">
            New to Subha Vivaham?{" "}
            <Link href="/register" className="font-semibold text-wine-700 hover:text-wine-800">
              Create free profile
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-500 transition-colors hover:text-wine-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
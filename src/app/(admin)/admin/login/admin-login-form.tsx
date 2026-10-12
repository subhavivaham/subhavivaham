"use client";

import { useActionState } from "react";
import { LogIn, ArrowLeft } from "lucide-react";
import { adminSignIn, type LoginState } from "@/app/(admin)/admin/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    adminSignIn,
    null
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Input
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="username"
        placeholder="admin@subhavivaham.com"
      />
      <PasswordInput
        label="Password"
        name="password"
        required
        autoComplete="current-password"
      />
      {state?.error && <p className="text-sm font-medium text-wine-600">{state.error}</p>}
      <Button type="submit" fullWidth size="lg" loading={pending}>
        <LogIn className="h-4 w-4" /> Sign in to Admin
      </Button>
      <Button href="/" variant="outline" fullWidth>
        <ArrowLeft className="h-4 w-4" /> Back to site
      </Button>
    </form>
  );
}

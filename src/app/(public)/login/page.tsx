import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  title: "Login — Subha Vivaham Matrimony",
  description: "Sign in to your Subha Vivaham account to view matches, messages and more.",
  path: "/login",
  indexed: false,
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // set by the register action's redirect, so the form can confirm the account
  // exists before asking for the password. read here rather than with
  // useSearchParams in the form, which keeps the client component prop-driven
  const params = await searchParams;
  const justRegistered = params.registered === "1";
  const next = typeof params.next === "string" ? params.next : null;

  return <LoginForm justRegistered={justRegistered} next={next} />;
}

"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/lib/state/toast-provider";
import { AuthProvider } from "@/features/auth/auth-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
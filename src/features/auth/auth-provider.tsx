"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/types";

// the sv_session cookie behind /api/auth/session is the only source of truth for
// who is signed in. there is deliberately no copy of the member in localStorage:
// a stored copy is not a session, and honouring one would let a stale browser
// profile stand in for a session that no longer exists.

export type LoginResult = { ok: true; user: AppUser } | { ok: false; error: string };

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  registerWithProfile: (name: string, email: string, profileId: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data: { user: AppUser | null }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user) {
      return { ok: false, error: data.error || "Incorrect email or password." };
    }
    setUser(data.user);
    router.refresh();
    return { ok: true, user: data.user };
  }, [router]);

  // the register action has already written every row and set the session
  // cookie by the time this runs, so the real member is preferred and the
  // form's own values are only the fallback
  const registerWithProfile = useCallback(
    (name: string, email: string, profileId: string) => {
      const fallback: AppUser = {
        id: `user-${profileId}`,
        email,
        mobile: "",
        name,
        profileId,
        gender: null,
        plan: "free",
      };
      fetch("/api/auth/session")
        .then((res) => res.json())
        .then((data: { user: AppUser | null }) => setUser(data.user ?? fallback))
        .catch(() => setUser(fallback));
    },
    []
  );

  // the redirect lives here rather than in each caller, so no sign out button can
  // leave a member standing on a page that is now behind the login wall.
  const logout = useCallback(async () => {
    setUser(null);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: Boolean(user),
        login,
        registerWithProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

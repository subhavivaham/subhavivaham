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
import type { User } from "@supabase/supabase-js";
import type { AppUser } from "@/types";
import { hasExpired } from "@/features/membership/period";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// the supabase session is the only source of truth for who is signed in. there is
// deliberately no copy of the member in localStorage: a stored copy is not a
// session, and honouring one would let a stale browser profile stand in for a
// session that no longer exists.

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

// the two rows the lookup below reads. postgrest is untyped in this project, so
// the shape is declared once here instead of cast at every use.
interface AccountRow {
  user_id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  is_membership_user: boolean | null;
  membership_plan: string | null;
}

interface ProfileKeyRow {
  profile_id: string;
  gender: string | null;
}

// profiles.gender holds 'male' or 'female' and nothing else, but postgrest is
// untyped so the value is narrowed here rather than cast at every use.
function toGender(value: unknown): AppUser["gender"] {
  return value === "male" || value === "female" ? value : null;
}

// follows the chain the schema defines: auth.uid -> public.users.user_id ->
// profiles.profile_id. rls already allows exactly these two reads for the
// signed-in member and for nobody else, so no extra check is needed here.
async function resolveAppUser(authUser: User): Promise<AppUser | null> {
  const supabase = getSupabase();

  const { data: accountData, error: accountError } = await supabase
    .from("users")
    .select("user_id, name, email, phone_number, is_membership_user, membership_plan")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (accountError) return null;

  const account = accountData as unknown as AccountRow | null;
  if (!account) return null;

  // the live tier, read with everything else so nav gates never need a second
  // query. a subscription's renews_on decides whether it is still live: a plan
  // that expired since the last sync must not keep showing premium nav. when the
  // member has no subscription rows at all the denormalised flags are the only
  // source, same as the quota resolver.
  const { data: subData } = await supabase
    .from("subscriptions")
    .select("plan, renews_on, status")
    .eq("user_id", account.user_id)
    .order("created_at", { ascending: false });
  const subs = (subData ?? []) as {
    plan: string | null;
    renews_on: string | null;
    status: string | null;
  }[];

  const liveSub = subs.find((row) => row.status === "active" && !hasExpired(row.renews_on));
  const tier = subs.length > 0 ? liveSub?.plan : account.membership_plan;
  const isPaid = subs.length > 0 ? Boolean(liveSub) : Boolean(account.is_membership_user);
  const plan: AppUser["plan"] = !isPaid
    ? "free"
    : tier === "premium"
      ? "premium"
      : tier === "silver"
        ? "silver"
        : "free";

  const { data: profileData } = await supabase
    .from("profiles")
    .select("profile_id, gender")
    .eq("user_id", account.user_id)
    .maybeSingle();

  const profile = profileData as unknown as ProfileKeyRow | null;

  return {
    id: account.user_id,
    email: account.email ?? authUser.email ?? "",
    mobile: account.phone_number ?? authUser.phone ?? "",
    name: account.name || authUser.user_metadata?.full_name || "Member",
    profileId: profile?.profile_id ?? "",
    gender: toGender(profile?.gender),
    plan,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const settle = (next: AppUser | null) => {
      if (cancelled) return;
      setUser(next);
      setIsLoading(false);
    };

    async function boot() {
      if (isSupabaseConfigured) {
        try {
          const { data } = await getSupabase().auth.getSession();
          if (data.session) {
            const member = await resolveAppUser(data.session.user);
            if (member) return settle(member);
          }
        } catch {
          // a lookup that fails leaves the visitor signed out rather than hanging
          // on the spinner
        }
      }
      settle(null);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // keeps the session and the react state in step: a token refresh, a second
  // tab signing out, or the register action setting the cookie all arrive here.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      if (!session) return;
      // deferred on purpose: supabase holds an internal lock for the duration of
      // this callback, so awaiting a query inside it deadlocks
      window.setTimeout(() => {
        void resolveAppUser(session.user).then((member) => {
          if (member) setUser(member);
        });
      }, 0);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const adopt = useCallback((member: AppUser) => {
    setUser(member);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const input = email.trim().toLowerCase();

    if (!isSupabaseConfigured) {
      return { ok: false, error: "Sign-in is unavailable right now. Please try again later." };
    }

    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: input,
      password,
    });
    if (error || !data.user) {
      return { ok: false, error: "Incorrect email or password." };
    }

    const member = await resolveAppUser(data.user);
    if (!member) {
      // signed in but with no account row, so nothing behind the members area
      // would resolve. sign back out instead of leaving a dead session.
      await getSupabase().auth.signOut();
      return { ok: false, error: "This account is not linked to a profile yet." };
    }

    adopt(member);
    return { ok: true, user: member };
  }, [adopt]);

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
        // brand-new accounts have no entitlement yet; the next session resolve
        // corrects this if a plan was somehow attached already
        plan: "free",
      };
      if (!isSupabaseConfigured) {
        adopt(fallback);
        return;
      }
      void getSupabase()
        .auth.getSession()
        .then(({ data }) => (data.session ? resolveAppUser(data.session.user) : null))
        .then((member) => adopt(member ?? fallback));
    },
    [adopt]
  );

  // the redirect lives here rather than in each caller, so no sign out button can
  // leave a member standing on a page that is now behind the login wall. the
  // (app) layout is not re-run on a client navigation, which is exactly why the
  // navigation has to be explicit. the cookie is cleared before the move, or the
  // home page could render as a signed in member.
  const logout = useCallback(async () => {
    setUser(null);
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
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

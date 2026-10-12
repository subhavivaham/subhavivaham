"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function ProfileGateLink({
  href,
  className,
  children,
  title = "Sign in to view this profile",
  description = "Log in to see full profile details, or create a free profile to start connecting.",
}: {
  href: string;
  className?: string;
  children: ReactNode;
  // the gate is reused by the browse calls to action, which are not looking at
  // one profile, so the wording is overridable rather than hardcoded to a card
  title?: string;
  description?: string;
}) {
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isLoggedIn) return;
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        centerOnMobile
      >
        <div className="space-y-3">
          <Button href="/login" size="lg" fullWidth>
            Login
          </Button>
          <Button href="/register" variant="gold" size="lg" fullWidth>
            Register
          </Button>
          <p className="pt-1 text-center text-xs text-charcoal-400">
            Free to join. Your contact details stay private.
          </p>
        </div>
      </Modal>
    </>
  );
}

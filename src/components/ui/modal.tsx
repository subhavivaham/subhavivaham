"use client";

import { useEffect, useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

// false during SSR and the hydration pass, true once the client has mounted, so
// the portal target is guaranteed to exist before anything is rendered into it
function useIsHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  hideClose?: boolean;
  centerOnMobile?: boolean;
  // long forms pass false so a stray tap outside the panel cannot throw away
  // what has been typed; the close button and Escape still work
  dismissOnBackdrop?: boolean;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  hideClose,
  centerOnMobile,
  dismissOnBackdrop = true,
}: ModalProps) {
  const titleId = useId();
  const isHydrated = useIsHydrated();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // the panel keeps its own transform so the containing-block warning below still
  // applies, but the entrance is driven by variants instead of the
  // animate-scale-in / animate-slide-up keyframes, which cannot play an exit
  const duration = reduceMotion ? 0 : 0.25;
  const panelOffset = centerOnMobile ? { opacity: 0, scale: 0.97 } : { opacity: 0, y: 24 };
  const panelShown = { opacity: 1, scale: 1, y: 0 };

  // hydrated but closed still renders the portal: AnimatePresence needs the
  // subtree mounted to play the exit, and while closed it renders nothing
  if (!isHydrated) return null;

  // portalled to <body> on purpose: a transformed or overflow-hidden ancestor
  // becomes the containing block for position:fixed, which would anchor the
  // overlay to that ancestor instead of the viewport and make it jump on hover
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal"
          className={cn(
            "fixed inset-0 z-[90] flex justify-center sm:items-center sm:p-6",
            centerOnMobile ? "items-center p-4" : "items-end"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {dismissOnBackdrop ? (
            <motion.button
              aria-label="Close dialog"
              className="absolute inset-0 bg-charcoal-950/50 backdrop-blur-[2px]"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          ) : (
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-charcoal-950/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              // capped and column-flexed so a long form scrolls inside the panel
              // instead of growing past the viewport. dvh tracks the mobile URL bar,
              // which vh does not, so the sheet cannot slide under it.
              "relative z-[1] flex max-h-[92dvh] w-full flex-col bg-white shadow-soft sm:max-h-[88vh] sm:rounded-3xl",
              centerOnMobile ? "rounded-3xl" : "rounded-t-3xl",
              sizes[size]
            )}
            initial={panelOffset}
            animate={panelShown}
            exit={panelOffset}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          >
            {!hideClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-1.5 text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-800"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            {(title || description) && (
              <div className="shrink-0 border-b border-charcoal-100 px-6 py-5">
                {title && (
                  <h2 id={titleId} className="font-display text-xl font-semibold text-charcoal-900">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-1 pr-8 text-sm text-charcoal-500">{description}</p>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
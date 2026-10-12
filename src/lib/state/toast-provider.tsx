"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { uid } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastKind, { icon: ReactNode; classes: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />,
    classes: "border-emerald-100 bg-white",
  },
  error: {
    icon: <AlertTriangle className="h-4.5 w-4.5 text-red-600" />,
    classes: "border-red-100 bg-white",
  },
  info: {
    icon: <Info className="h-4.5 w-4.5 text-gold-600" />,
    classes: "border-gold-200 bg-white",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = uid("toast");
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => {
          const style = STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium text-charcoal-800 shadow-card",
                "animate-scale-in",
                style.classes
              )}
            >
              {style.icon}
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-full p-1 text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryPageShellProps {
  title: string;
  description?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  accentClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export default function HistoryPageShell({
  title,
  description,
  onBack,
  backLabel = "Back",
  actions,
  accentClassName,
  bodyClassName,
  children,
}: HistoryPageShellProps) {
  const accent = Boolean(accentClassName);

  return (
    <div>
      <header
        className={cn(
          accent
            ? `${accentClassName} text-white`
            : "border-b border-slate-200 bg-white"
        )}
      >
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className={cn(
                    "flex items-center gap-2 text-xl transition-colors",
                    accent
                      ? "text-white/90 hover:text-white"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft className="h-5 w-5" />
                  {backLabel}
                </button>
              )}

              <div>
                <h1 className="text-4xl font-bold">{title}</h1>
                {description && (
                  <p
                    className={cn(
                      "text-2xl",
                      accent ? "text-white/80" : "text-slate-500"
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      </header>

      <main className={cn("mx-auto max-w-6xl px-6 py-10", bodyClassName)}>
        {children}
      </main>
    </div>
  );
}

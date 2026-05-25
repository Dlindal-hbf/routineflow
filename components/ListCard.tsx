"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Settings } from "lucide-react";
import React from "react";

export interface ListCardProps {
  title: string;
  emoji?: string;
  tag?: string;
  accentClass?: string; // e.g. "border-t-orange-500"
  progress?: { completed: number; total: number };
  onClick?: () => void;
  onSettings?: () => void;
  children?: React.ReactNode; // extra action buttons
}

export default function ListCard({
  title,
  emoji,
  tag,
  accentClass,
  progress,
  onClick,
  onSettings,
  children,
}: ListCardProps) {
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(onClick ? "cursor-pointer" : "")}
      onClick={onClick}
    >
      <Card
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md",
          accentClass || ""
        )}
      >
        <CardContent className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 text-2xl leading-tight">
                {emoji && <span className="mr-2">{emoji}</span>}
                <span className="text-xl font-semibold text-foreground">{title}</span>
              </div>
              {tag && (
                <span className="inline-block rounded-full border border-accent/30 bg-accent/20 px-2.5 py-0.5 text-xs font-medium capitalize text-accent-foreground">
                  {tag}
                </span>
              )}
            </div>
            {onSettings && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings();
                }}
                className="h-9 w-9 rounded-lg border border-border text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>

          {progress && (
            <>
              <div className="mb-2.5 flex items-center justify-between text-sm text-foreground/70">
                <span>Fremdrift</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {completed}/{total}
                </span>
              </div>
              <div className="mb-3 h-2 rounded-full border border-primary/10 bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}

          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

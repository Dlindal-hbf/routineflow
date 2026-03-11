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
          "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm",
          accentClass || ""
        )}
      >
        <CardContent className="p-8">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-3xl">
                {emoji && <span className="mr-3">{emoji}</span>}
                <span className="text-[22px] font-semibold">{title}</span>
              </div>
              {tag && (
                <span className="inline-block rounded-full border-0 bg-emerald-100 px-4 py-1 text-base font-medium capitalize text-emerald-700">
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
                className="h-14 w-14 rounded-2xl border-slate-200 border"
              >
                <Settings className="h-6 w-6" />
              </button>
            )}
          </div>

          {progress && (
            <>
              <div className="mb-3 flex items-center justify-between text-[18px] text-slate-500">
                <span>Progress</span>
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <CheckCircle2 className="h-5 w-5 text-slate-700" />
                  {completed}/{total}
                </span>
              </div>
              <div className="mb-6 h-3 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500"
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

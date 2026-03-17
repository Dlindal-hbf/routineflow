"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface HistoryEntryCardProps {
  title: string;
  description?: string;
  meta?: string;
  actions?: React.ReactNode;
  compact?: boolean;
  children?: React.ReactNode;
}

export default function HistoryEntryCard({
  title,
  description,
  meta,
  actions,
  compact = false,
  children,
}: HistoryEntryCardProps) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            {description && (
              <div className="mt-2 text-base text-slate-700">{description}</div>
            )}
            {meta && <div className="mt-2 text-sm text-slate-500">{meta}</div>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}

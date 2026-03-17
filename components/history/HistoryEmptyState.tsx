"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface HistoryEmptyStateProps {
  title: string;
  description?: string;
}

export default function HistoryEmptyState({
  title,
  description,
}: HistoryEmptyStateProps) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="px-8 py-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-500">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

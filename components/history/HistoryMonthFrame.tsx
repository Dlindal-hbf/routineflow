"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonthLabel, getWeekdayNames } from "@/lib/date-utils";
import type { DateKey, WeekStart } from "@/types/calendar";

interface HistoryMonthFrameProps {
  monthKey: DateKey;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  locale?: string;
  weekStartsOn?: WeekStart;
}

export default function HistoryMonthFrame({
  monthKey,
  onPreviousMonth,
  onNextMonth,
  children,
  actions,
  locale = "no-NO",
  weekStartsOn = "monday",
}: HistoryMonthFrameProps) {
  const weekdayLabels = getWeekdayNames({
    locale,
    format: "short",
    weekStartsOn,
    normalizeLabel: true,
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onPreviousMonth}
          className="rounded-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <h3 className="flex-1 text-center text-lg font-semibold capitalize text-slate-900">
          {formatMonthLabel(monthKey, locale)}
        </h3>

        <div className="flex items-center gap-2">
          {actions}
          <Button
            variant="outline"
            size="sm"
            onClick={onNextMonth}
            className="rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-7 gap-2 text-center">
        {weekdayLabels.map((day) => (
          <div key={day} className="font-medium text-slate-600">
            {day}
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}

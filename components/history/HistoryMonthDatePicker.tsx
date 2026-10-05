"use client";

import React, { useMemo } from "react";
import HistoryMonthFrame from "@/components/history/HistoryMonthFrame";
import { Button } from "@/components/ui/button";
import { buildMonthCalendar, shiftCalendarMonth } from "@/lib/calendar-utils";
import { getTodayDateKey } from "@/lib/date-utils";
import { HISTORY_TIMEZONE } from "@/lib/history-utils";
import { cn } from "@/lib/utils";
import type { DateKey, WeekStart } from "@/types/calendar";

interface HistoryMonthDatePickerProps {
  monthKey: DateKey;
  selectedDayKey: DateKey | null;
  highlightedDayKeys: DateKey[];
  onMonthKeyChange: (monthKey: DateKey) => void;
  onSelectedDayKeyChange: (dayKey: DateKey | null) => void;
  clearSelectionLabel?: string;
  locale?: string;
  weekStartsOn?: WeekStart;
}

export default function HistoryMonthDatePicker({
  monthKey,
  selectedDayKey,
  highlightedDayKeys,
  onMonthKeyChange,
  onSelectedDayKeyChange,
  clearSelectionLabel = "Show All",
  locale = "no-NO",
  weekStartsOn = "monday",
}: HistoryMonthDatePickerProps) {
  const highlightedDayKeySet = useMemo(
    () => new Set(highlightedDayKeys),
    [highlightedDayKeys]
  );
  const monthData = buildMonthCalendar(monthKey, {
    locale,
    weekStartsOn,
    todayKey: getTodayDateKey(HISTORY_TIMEZONE),
  });

  return (
    <HistoryMonthFrame
      monthKey={monthKey}
      locale={locale}
      weekStartsOn={weekStartsOn}
      onPreviousMonth={() => onMonthKeyChange(shiftCalendarMonth(monthKey, -1))}
      onNextMonth={() => onMonthKeyChange(shiftCalendarMonth(monthKey, 1))}
      actions={
        <Button
          onClick={() => onSelectedDayKeyChange(null)}
          variant={selectedDayKey ? "outline" : "default"}
          className="h-9 px-3 text-sm"
        >
          {clearSelectionLabel}
        </Button>
      }
    >
      <div className="space-y-2">
        {monthData.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-2">
            {week.map((cell, cellIndex) => {
              if (cell === null) {
                return <div key={cellIndex} className="h-12" />;
              }

              const hasEntries = highlightedDayKeySet.has(cell.dateKey);
              const isSelected = selectedDayKey === cell.dateKey;

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => onSelectedDayKeyChange(cell.dateKey)}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-lg border-2 text-sm font-medium transition",
                    isSelected && "border-primary bg-primary text-white",
                    !isSelected &&
                      hasEntries &&
                      "border-primary/30 bg-primary/10 text-primary",
                    !isSelected &&
                      !hasEntries &&
                      "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    cell.isToday && !isSelected && "ring-1 ring-slate-300"
                  )}
                >
                  {cell.dayOfMonth}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </HistoryMonthFrame>
  );
}

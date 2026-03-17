"use client";

import React, { useMemo, useState } from "react";
import HistoryEmptyState from "@/components/history/HistoryEmptyState";
import HistoryMonthDatePicker from "@/components/history/HistoryMonthDatePicker";
import {
  compareDateKeys,
  formatDateKey,
  getStartOfMonthDateKey,
  getTodayDateKey,
} from "@/lib/date-utils";
import { HISTORY_TIMEZONE } from "@/lib/history-utils";
import type { DateKey } from "@/types/calendar";

export type HistoryDateBrowserDay = {
  dayKey: DateKey;
  content: React.ReactNode;
};

interface HistoryDateBrowserProps {
  days: HistoryDateBrowserDay[];
  emptyTitle: string;
  emptyDescription?: string;
  noResultsTitle?: string;
  noResultsDescription?: string;
  initialMonthKey?: DateKey;
}

export default function HistoryDateBrowser({
  days,
  emptyTitle,
  emptyDescription,
  noResultsTitle = "No history for this month yet.",
  noResultsDescription = "Switch months or wait until new activity is archived.",
  initialMonthKey,
}: HistoryDateBrowserProps) {
  const sortedDays = useMemo(
    () => [...days].sort((a, b) => compareDateKeys(b.dayKey, a.dayKey)),
    [days]
  );
  const fallbackMonthKey = getStartOfMonthDateKey(
    initialMonthKey ??
      sortedDays[0]?.dayKey ??
      getTodayDateKey(HISTORY_TIMEZONE)
  );

  const [selectedMonthKey, setSelectedMonthKey] = useState<DateKey>(fallbackMonthKey);
  const [selectedDayKey, setSelectedDayKey] = useState<DateKey | null>(null);

  if (sortedDays.length === 0) {
    return (
      <HistoryEmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  const monthPrefix = selectedMonthKey.slice(0, 7);
  const monthDays = sortedDays.filter((day) => day.dayKey.startsWith(monthPrefix));
  const visibleDays = selectedDayKey
    ? monthDays.filter((day) => day.dayKey === selectedDayKey)
    : monthDays;

  return (
    <div className="space-y-8">
      <HistoryMonthDatePicker
        monthKey={selectedMonthKey}
        selectedDayKey={selectedDayKey}
        highlightedDayKeys={monthDays.map((day) => day.dayKey)}
        onMonthKeyChange={(nextMonthKey) => {
          setSelectedMonthKey(nextMonthKey);
          if (selectedDayKey && !selectedDayKey.startsWith(nextMonthKey.slice(0, 7))) {
            setSelectedDayKey(null);
          }
        }}
        onSelectedDayKeyChange={setSelectedDayKey}
      />

      {visibleDays.length === 0 ? (
        <HistoryEmptyState
          title={noResultsTitle}
          description={noResultsDescription}
        />
      ) : (
        visibleDays.map((day) => (
          <div key={day.dayKey} className="space-y-6">
            <h2 className="text-3xl font-semibold text-slate-900">
              {formatDateKey(day.dayKey)}
            </h2>
            {day.content}
          </div>
        ))
      )}
    </div>
  );
}

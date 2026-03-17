"use client";

import React from "react";
import HistoryMonthFrame from "@/components/history/HistoryMonthFrame";
import { buildMonthCalendar, shiftCalendarMonth } from "@/lib/calendar-utils";
import { getTodayDateKey } from "@/lib/date-utils";
import { HISTORY_TIMEZONE } from "@/lib/history-utils";
import type { DateKey, WeekStart } from "@/types/calendar";
import type { TaskCalendarStatus } from "@/lib/history-types";

interface TaskStatusCalendarProps {
  monthKey: DateKey;
  statusByDateKey: Record<string, TaskCalendarStatus>;
  onMonthKeyChange: (monthKey: DateKey) => void;
  locale?: string;
  weekStartsOn?: WeekStart;
}

export default function TaskStatusCalendar({
  monthKey,
  statusByDateKey,
  onMonthKeyChange,
  locale = "no-NO",
  weekStartsOn = "monday",
}: TaskStatusCalendarProps) {
  const monthData = buildMonthCalendar(monthKey, {
    locale,
    weekStartsOn,
    todayKey: getTodayDateKey(HISTORY_TIMEZONE),
  });

  return (
    <div className="space-y-6">
      <HistoryMonthFrame
        monthKey={monthKey}
        locale={locale}
        weekStartsOn={weekStartsOn}
        onPreviousMonth={() => onMonthKeyChange(shiftCalendarMonth(monthKey, -1))}
        onNextMonth={() => onMonthKeyChange(shiftCalendarMonth(monthKey, 1))}
      >
        <div className="space-y-2">
          {monthData.weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2">
              {week.map((cell, cellIndex) => {
                if (cell === null) {
                  return <div key={cellIndex} className="h-12" />;
                }

                const status = statusByDateKey[cell.dateKey];

                return (
                  <div
                    key={cell.dateKey}
                    className={`flex h-12 items-center justify-center rounded-lg border-2 text-sm font-medium transition ${
                      status === "complete"
                        ? "border-green-400 bg-green-50 text-green-700"
                        : status === "incomplete"
                          ? "border-black bg-black text-white"
                          : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {cell.dayOfMonth}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </HistoryMonthFrame>

      <div className="flex items-center gap-6 border-t pt-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-green-50 ring-2 ring-green-400" />
          <span className="text-sm text-slate-600">Complete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-black ring-2 ring-black" />
          <span className="text-sm text-slate-600">Incomplete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-white ring-2 ring-slate-200" />
          <span className="text-sm text-slate-600">No Record</span>
        </div>
      </div>
    </div>
  );
}

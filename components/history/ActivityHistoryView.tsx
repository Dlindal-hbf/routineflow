"use client";

import React, { useMemo } from "react";
import HistoryDateBrowser from "@/components/history/HistoryDateBrowser";
import HistoryEntryCard from "@/components/history/HistoryEntryCard";
import { formatTimestamp } from "@/lib/date-utils";
import { groupActivityHistoryEntries } from "@/lib/history-utils";
import type { ActivityHistoryEntry } from "@/lib/history-types";
import type { DateKey } from "@/types/calendar";

interface ActivityHistoryViewProps {
  entries: ActivityHistoryEntry[];
}

export default function ActivityHistoryView({
  entries,
}: ActivityHistoryViewProps) {
  const groupedHistory = useMemo(
    () => groupActivityHistoryEntries(entries),
    [entries]
  );

  const days = useMemo(
    () =>
      Object.entries(groupedHistory).map(([dayKey, categories]) => ({
        dayKey: dayKey as DateKey,
        content: (
          <div className="space-y-6">
            {Object.entries(categories).map(([category, subgroups]) => (
              <section key={category} className="space-y-4">
                <h3 className="text-2xl font-medium text-slate-900">{category}</h3>

                {Object.entries(subgroups).map(([subgroup, items]) => (
                  <div key={subgroup} className="space-y-3">
                    {subgroup !== "All" && (
                      <h4 className="pl-1 text-lg font-medium text-slate-700">
                        {subgroup}
                      </h4>
                    )}

                    <div className={subgroup !== "All" ? "space-y-3 pl-4" : "space-y-3"}>
                      {items.map((item, index) => (
                        <HistoryEntryCard
                          key={`${item.timestamp}-${item.description}-${index}`}
                          title={item.description}
                          meta={formatTimestamp(item.timestamp)}
                          compact={subgroup !== "All"}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        ),
      })),
    [groupedHistory]
  );

  return (
    <HistoryDateBrowser
      days={days}
      emptyTitle="No history recorded yet."
      emptyDescription="Complete tasks or create work-log entries to start building history."
      noResultsTitle="No history in this month."
      noResultsDescription="Try another month or clear the day filter to see more activity."
    />
  );
}

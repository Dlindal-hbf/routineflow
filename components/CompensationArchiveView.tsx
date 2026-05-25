"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import HistoryDateBrowser from "@/components/history/HistoryDateBrowser";
import HistoryEntryCard from "@/components/history/HistoryEntryCard";
import CompensationStatusBadge from "@/components/CompensationStatusBadge";
import { formatTimestamp, getDateKeyFromTimestamp, getTodayDateKey } from "@/lib/date-utils";
import { groupItemsByDayKey } from "@/lib/history-utils";
import type { CompensationCase } from "@/lib/compensation-types";
import type { DateKey } from "@/types/calendar";
import {
  getCompensationClosedAt,
  getCompensationSummary,
  resolveCompensationStatus,
} from "@/lib/compensation-utils";
import { COMPENSATION_HISTORY_TIMEZONE } from "@/lib/compensation-constants";

interface CompensationArchiveViewProps {
  cases: CompensationCase[];
  onOpen: (caseRecord: CompensationCase) => void;
}

export default function CompensationArchiveView({
  cases,
  onOpen,
}: CompensationArchiveViewProps) {
  const groupedCases = useMemo(() => {
    const archiveItems = cases.flatMap((caseRecord) => {
      const closedAt = getCompensationClosedAt(caseRecord);
      if (!closedAt) {
        return [];
      }

      return [
        {
          ...caseRecord,
          dayKey:
            getDateKeyFromTimestamp(closedAt, {
              timeZone: COMPENSATION_HISTORY_TIMEZONE,
            }) ?? getTodayDateKey(COMPENSATION_HISTORY_TIMEZONE),
          closedAt,
        },
      ];
    });

    return groupItemsByDayKey(archiveItems);
  }, [cases]);

  const days = useMemo(
    () =>
      Object.entries(groupedCases).map(([dayKey, items]) => ({
        dayKey: dayKey as DateKey,
        content: (
          <div className="space-y-4">
            {items.map((caseRecord) => {
              const resolvedStatus = resolveCompensationStatus(caseRecord);

              return (
                <HistoryEntryCard
                  key={caseRecord.id}
                  title={`${caseRecord.customerName} / ${caseRecord.caseNumber}`}
                  description={`${getCompensationSummary(caseRecord)}. ${caseRecord.issueDescription}`}
                  meta={formatTimestamp(caseRecord.closedAt)}
                  actions={
                    <Button size="sm" onClick={() => onOpen(caseRecord)}>
                      Vis
                    </Button>
                  }
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <CompensationStatusBadge status={resolvedStatus} />
                    <span className="text-sm text-slate-500">{caseRecord.customerPhone}</span>
                  </div>
                </HistoryEntryCard>
              );
            })}
          </div>
        ),
      })),
    [groupedCases, onOpen]
  );

  return (
    <HistoryDateBrowser
      days={days}
      emptyTitle="Ingen arkiverte kompensasjonssaker ennå."
      emptyDescription="Lukkede saker vises automatisk i arkivet."
      noResultsTitle="Ingen arkivsaker denne måneden."
      noResultsDescription="Bytt måned eller fjern filtre for å se eldre lukkede saker."
    />
  );
}

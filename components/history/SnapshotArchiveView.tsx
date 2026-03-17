"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import HistoryDateBrowser from "@/components/history/HistoryDateBrowser";
import HistoryEntryCard from "@/components/history/HistoryEntryCard";
import { formatTimestamp } from "@/lib/date-utils";
import {
  deleteSnapshotArchiveEntry,
  groupItemsByDayKey,
  readSnapshotArchiveEntries,
} from "@/lib/history-utils";
import type { SnapshotArchiveEntry } from "@/lib/history-types";
import type { DateKey } from "@/types/calendar";

interface SnapshotArchiveViewProps {
  storageKey: string;
  onOpen: (snapshotId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function SnapshotArchiveView({
  storageKey,
  onOpen,
  emptyTitle = "No snapshots saved yet.",
  emptyDescription = "Save a snapshot from the live module to build an archive.",
}: SnapshotArchiveViewProps) {
  const [snapshots, setSnapshots] = useState<SnapshotArchiveEntry[]>(() =>
    readSnapshotArchiveEntries(storageKey)
  );

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setSnapshots(readSnapshotArchiveEntries(storageKey));
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  const groupedSnapshots = useMemo(
    () => groupItemsByDayKey(snapshots),
    [snapshots]
  );
  const days = useMemo(
    () =>
      Object.entries(groupedSnapshots).map(([dayKey, items]) => ({
        dayKey: dayKey as DateKey,
        content: (
          <div className="space-y-4">
            {items.map((snapshot) => (
              <HistoryEntryCard
                key={snapshot.id}
                title={snapshot.name}
                meta={formatTimestamp(snapshot.createdAt)}
                actions={
                  <>
                    <Button size="sm" onClick={() => onOpen(snapshot.id)}>
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={() => {
                        if (!window.confirm("Delete this snapshot?")) {
                          return;
                        }

                        deleteSnapshotArchiveEntry(storageKey, snapshot.id);
                        setSnapshots(readSnapshotArchiveEntries(storageKey));
                      }}
                    >
                      Delete
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        ),
      })),
    [groupedSnapshots, onOpen, storageKey]
  );

  return (
    <HistoryDateBrowser
      days={days}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      noResultsTitle="No snapshots in this month."
      noResultsDescription="Switch months to browse older saved snapshots."
    />
  );
}

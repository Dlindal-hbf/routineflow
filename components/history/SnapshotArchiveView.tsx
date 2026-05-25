"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import HistoryDateBrowser from "@/components/history/HistoryDateBrowser";
import HistoryEntryCard from "@/components/history/HistoryEntryCard";
import { formatTimestamp, getDateKeyFromTimestamp, getTodayDateKey } from "@/lib/date-utils";
import type { DateKey } from "@/types/calendar";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import {
  deleteInventorySnapshot,
  fetchBunnerInventoryState,
  getCachedBunnerInventoryState,
  getCachedOstInventoryState,
  fetchOstInventoryState,
} from "@/src/services/inventoryService";

type SnapshotArchiveEntry = {
  id: string;
  name: string;
  createdAt: string;
  dayKey: DateKey;
};

interface SnapshotArchiveViewProps {
  storageKey: string;
  onOpen: (snapshotId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

function resolveInventoryType(storageKey: string): "bunner" | "ost" {
  return storageKey === "ostInventorySnapshots.v1" ? "ost" : "bunner";
}

function groupItemsByDayKey(
  items: SnapshotArchiveEntry[]
): Record<DateKey, SnapshotArchiveEntry[]> {
  return items.reduce<Record<DateKey, SnapshotArchiveEntry[]>>((acc, item) => {
    if (!acc[item.dayKey]) {
      acc[item.dayKey] = [];
    }

    acc[item.dayKey].push(item);
    return acc;
  }, {} as Record<DateKey, SnapshotArchiveEntry[]>);
}

export default function SnapshotArchiveView({
  storageKey,
  onOpen,
  emptyTitle = "No snapshots saved yet.",
  emptyDescription = "Save a snapshot from the live module to build an archive.",
}: SnapshotArchiveViewProps) {
  const inventoryType = resolveInventoryType(storageKey);
  const cachedState =
    inventoryType === "ost" ? getCachedOstInventoryState() : getCachedBunnerInventoryState();
  const hasCachedState = cachedState !== undefined;
  const [snapshots, setSnapshots] = useState<SnapshotArchiveEntry[]>(
    (cachedState?.snapshots ?? []).map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      dayKey:
        getDateKeyFromTimestamp(snapshot.createdAt, { timeZone: "Europe/Oslo" }) ??
        getTodayDateKey("Europe/Oslo"),
    }))
  );
  const [loading, setLoading] = useState(!hasCachedState);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(!hasCachedState);
        setRefreshing(hasCachedState);
        setError(null);
        await ensureLegacyBusinessDataMigrated();
        const state =
          inventoryType === "ost"
            ? await fetchOstInventoryState()
            : await fetchBunnerInventoryState();

        if (!isMounted) {
          return;
        }

        const nextSnapshots = state.snapshots.map((snapshot) => ({
          id: snapshot.id,
          name: snapshot.name,
          createdAt: snapshot.createdAt,
          dayKey:
            getDateKeyFromTimestamp(snapshot.createdAt, { timeZone: "Europe/Oslo" }) ??
            getTodayDateKey("Europe/Oslo"),
        }));
        setSnapshots(nextSnapshots);
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load snapshot archive."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [hasCachedState, inventoryType]);

  const groupedSnapshots = useMemo(() => groupItemsByDayKey(snapshots), [snapshots]);
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

                        void (async () => {
                          try {
                            await deleteInventorySnapshot(inventoryType, snapshot.id);
                            setSnapshots((current) =>
                              current.filter((entry) => entry.id !== snapshot.id)
                            );
                          } catch (deleteError) {
                            setError(
                              deleteError instanceof Error
                                ? deleteError.message
                                : "Failed to delete snapshot."
                            );
                          }
                        })();
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
    [groupedSnapshots, inventoryType, onOpen]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-500 shadow-sm">
        <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
        <span>Loading snapshots…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {refreshing && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Refreshing snapshots...
        </div>
      )}
      <HistoryDateBrowser
        days={days}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        noResultsTitle="No snapshots in this month."
        noResultsDescription="Switch months to browse older saved snapshots."
      />
    </div>
  );
}

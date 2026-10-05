"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import HistoryDateBrowser from "@/components/history/HistoryDateBrowser";
import HistoryEntryCard from "@/components/history/HistoryEntryCard";
import { formatTimestamp, getDateKeyFromTimestamp, getTodayDateKey } from "@/lib/date-utils";
import type { DateKey } from "@/types/calendar";
import { isCachedValueStale } from "@/src/services/clientCache";
import { runBackgroundSync } from "@/src/services/backgroundSync";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import {
  deleteInventorySnapshot,
  fetchBunnerInventoryState,
  fetchOstInventoryState,
  getCachedBunnerInventoryState,
  getCachedOstInventoryState,
} from "@/src/services/inventoryService";

const SNAPSHOT_STALE_AFTER_MS = 30_000;

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
  emptyTitle = "Ingen øyeblikksbilder lagret ennå.",
  emptyDescription = "Lagre et øyeblikksbilde fra aktiv visning for å bygge arkiv.",
}: SnapshotArchiveViewProps) {
  const inventoryType = resolveInventoryType(storageKey);
  const cacheKey =
    inventoryType === "ost" ? "inventory:ost:latest" : "inventory:bunner:latest";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const shouldRefresh =
      !hasCachedState || isCachedValueStale(cacheKey, SNAPSHOT_STALE_AFTER_MS);

    const load = async () => {
      if (!shouldRefresh) {
        setLoading(false);
        return;
      }

      try {
        setLoading(!hasCachedState);
        setError(null);
        const state = await runBackgroundSync(
          async () => {
            await ensureLegacyBusinessDataMigrated();
            return inventoryType === "ost"
              ? fetchOstInventoryState()
              : fetchBunnerInventoryState();
          },
          {
            errorMessage: "Kunne ikke oppdatere øyeblikksbilder. Viser sist lagrede arkiv.",
          }
        );

        if (!isMounted) {
          return;
        }

        setSnapshots(
          state.snapshots.map((snapshot) => ({
            id: snapshot.id,
            name: snapshot.name,
            createdAt: snapshot.createdAt,
            dayKey:
              getDateKeyFromTimestamp(snapshot.createdAt, { timeZone: "Europe/Oslo" }) ??
              getTodayDateKey("Europe/Oslo"),
          }))
        );
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error ? loadError.message : "Kunne ikke laste inn øyeblikksbildearkiv."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [cacheKey, hasCachedState, inventoryType]);

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
                      Vis
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={() => {
                        if (!window.confirm("Slette dette øyeblikksbildet?")) {
                          return;
                        }

                        const previousSnapshots = snapshots;
                        setSnapshots((current) =>
                          current.filter((entry) => entry.id !== snapshot.id)
                        );

                        void runBackgroundSync(
                          () => deleteInventorySnapshot(inventoryType, snapshot.id),
                          {
                            errorMessage:
                              "Kunne ikke slette øyeblikksbildet. Endringen ble rullet tilbake.",
                            onError: (deleteError) => {
                              setError(
                                deleteError instanceof Error
                                  ? deleteError.message
                                  : "Kunne ikke slette øyeblikksbilde."
                              );
                              setSnapshots(previousSnapshots);
                            },
                          }
                        ).catch(() => undefined);
                      }}
                    >
                      Slett
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        ),
      })),
    [groupedSnapshots, inventoryType, onOpen, snapshots]
  );

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          <span>Oppdaterer øyeblikksbilder i bakgrunnen...</span>
        </div>
      )}
      <HistoryDateBrowser
        days={days}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        noResultsTitle="Ingen øyeblikksbilder denne måneden."
        noResultsDescription="Bytt måned for å se eldre lagrede øyeblikksbilder."
      />
    </div>
  );
}

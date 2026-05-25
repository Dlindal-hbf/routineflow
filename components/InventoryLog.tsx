"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTimestamp, getWeekdayName } from "@/lib/date-utils";
import { isCachedValueStale } from "@/src/services/clientCache";
import { runBackgroundSync } from "@/src/services/backgroundSync";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import {
  BUNNER_CATEGORIES,
  BUNNER_METRICS,
  INVENTORY_DAYS,
  createEmptyBunnerWeek,
  deleteInventorySnapshot,
  fetchBunnerInventoryState,
  getCachedBunnerInventoryState,
  normalizeBunnerEntries,
  saveBunnerCurrentEntries,
  saveBunnerSnapshots,
  type BunnerCategory as Category,
  type BunnerInventoryData as InventoryData,
  type BunnerInventorySnapshot as InventorySnapshot,
  type BunnerMetric as Metric,
} from "@/src/services/inventoryService";

function getTodayName(): string {
  const day = new Date().getDay();
  const index = (day + 6) % 7;
  return INVENTORY_DAYS[index];
}

function formatSnapshotName(date: Date, includePrefix = false): string {
  const baseName = `${formatDate(date)} (${getWeekdayName(date, { locale: "no-NO" })})`;
  return includePrefix ? `Lager ${baseName}` : baseName;
}

const changeMetrics: Metric[] = [
  "feillaget",
  "ikke hentet",
  "tørr/ødelagt",
  "gitt ut feil",
  "forhåndsbestilt",
];

function getSnapshotId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const INVENTORY_CACHE_KEY = "inventory:bunner:latest";
const INVENTORY_STALE_AFTER_MS = 30_000;

export type { Category, Metric };

export default function InventoryLog(props?: {
  viewSnapshotId?: string;
  readOnly?: boolean;
  onOpenArchive?: () => void;
  currentDayIndex?: number;
}) {
  const { viewSnapshotId, readOnly, onOpenArchive, currentDayIndex } = props || {};
  const cachedState = getCachedBunnerInventoryState();
  const hasCachedState = Boolean(cachedState);
  const [selectedDay, setSelectedDay] = useState(getTodayName());
  const [selectedSource, setSelectedSource] = useState(viewSnapshotId || "current");
  const [entries, setEntries] = useState<InventoryData>(cachedState?.entries ?? createEmptyBunnerWeek);
  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>(cachedState?.snapshots ?? []);
  const [loading, setLoading] = useState(!hasCachedState);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(hasCachedState);
  const latestEntriesRef = useRef(entries);
  const latestSnapshotsRef = useRef(snapshots);
  const lastSyncedEntriesRef = useRef(entries);
  const lastSyncedSnapshotsRef = useRef(snapshots);

  useEffect(() => {
    latestEntriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    latestSnapshotsRef.current = snapshots;
  }, [snapshots]);

  useEffect(() => {
    let isMounted = true;
    const shouldRefresh =
      !hasCachedState || isCachedValueStale(INVENTORY_CACHE_KEY, INVENTORY_STALE_AFTER_MS);

    const load = async () => {
      if (!shouldRefresh) {
        setLoading(false);
        setHydrated(true);
        return;
      }

      try {
        setLoading(!hasCachedState);
        setError(null);
        const state = await runBackgroundSync(
          async () => {
            await ensureLegacyBusinessDataMigrated();
            return fetchBunnerInventoryState();
          },
          {
            errorMessage: "Kunne ikke oppdatere lager. Viser sist lagrede verdier.",
          }
        );
        if (!isMounted) {
          return;
        }

        setEntries(state.entries);
        setSnapshots(state.snapshots);
        setHydrated(true);
        lastSyncedEntriesRef.current = state.entries;
        lastSyncedSnapshotsRef.current = state.snapshots;
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Kunne ikke laste lager.");
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
  }, [hasCachedState]);

  useEffect(() => {
    setSelectedSource(viewSnapshotId || "current");
  }, [viewSnapshotId]);

  useEffect(() => {
    if (typeof currentDayIndex === "number") {
      const index = (currentDayIndex + 6) % 7;
      setSelectedDay(INVENTORY_DAYS[index]);
    }
  }, [currentDayIndex]);

  useEffect(() => {
    if (!hydrated || readOnly) {
      return;
    }

    if (entries === lastSyncedEntriesRef.current) {
      return;
    }

    const pendingEntries = entries;
    const previousEntries = lastSyncedEntriesRef.current;
    const timeout = window.setTimeout(() => {
      void runBackgroundSync(
        () => saveBunnerCurrentEntries(normalizeBunnerEntries(pendingEntries)),
        {
          errorMessage: "Kunne ikke lagre lagerendringer. Mislykket endring ble rullet tilbake.",
          onError: (saveError) => {
            setError(
              saveError instanceof Error
                ? saveError.message
                : "Kunne ikke lagre lagerendringer."
            );
            if (latestEntriesRef.current === pendingEntries) {
              setEntries(previousEntries);
            }
          },
        }
      )
        .then(() => {
          if (latestEntriesRef.current === pendingEntries) {
            lastSyncedEntriesRef.current = pendingEntries;
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [entries, hydrated, readOnly]);

  useEffect(() => {
    if (!hydrated || readOnly) {
      return;
    }

    if (snapshots === lastSyncedSnapshotsRef.current) {
      return;
    }

    const pendingSnapshots = snapshots;
    const previousSnapshots = lastSyncedSnapshotsRef.current;
    const timeout = window.setTimeout(() => {
      void runBackgroundSync(() => saveBunnerSnapshots(pendingSnapshots), {
        errorMessage: "Kunne ikke lagre øyeblikksbildearkivet. Endringen ble rullet tilbake.",
        onError: (saveError) => {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Kunne ikke lagre øyeblikksbildearkiv."
          );
          if (latestSnapshotsRef.current === pendingSnapshots) {
            setSnapshots(previousSnapshots);
          }
        },
      })
        .then(() => {
          if (latestSnapshotsRef.current === pendingSnapshots) {
            lastSyncedSnapshotsRef.current = pendingSnapshots;
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [snapshots, hydrated, readOnly]);

  const updateCell = (day: string, category: Category, metric: Metric, value: string) => {
    setEntries((current) => ({
      ...current,
      [day]: {
        ...(current[day] ?? createEmptyBunnerWeek()[day]),
        [category]: {
          ...(current[day]?.[category] ?? {}),
          [metric]: value,
        },
      },
    }));
  };

  const getCellValue = (category: Category, metric: Metric): string => {
    const sourceEntries =
      selectedSource === "current"
        ? entries
        : snapshots.find((snapshot) => snapshot.id === selectedSource)?.entries ?? entries;

    if (metric === "klar for idag") {
      const fromYesterday = parseFloat(sourceEntries[selectedDay][category]["fra igår"] || "0") || 0;
      const bakedToday = parseFloat(sourceEntries[selectedDay][category]["bakt idag"] || "0") || 0;
      return String(fromYesterday + bakedToday);
    }

    if (metric === "teoretisk igjen") {
      const readyForToday = parseFloat(getCellValue(category, "klar for idag")) || 0;
      const sold = parseFloat(sourceEntries[selectedDay][category]["sum solgt"] || "0") || 0;
      return String(readyForToday - sold);
    }

    if (metric === "avvik") {
      const theoreticalLeft = parseFloat(getCellValue(category, "teoretisk igjen")) || 0;
      const totalOnCold = parseFloat(sourceEntries[selectedDay][category]["totalt på kjøl"] || "0") || 0;
      const changes = changeMetrics.reduce((sum, changeMetric) => {
        const value = parseFloat(sourceEntries[selectedDay][category][changeMetric] || "0") || 0;
        return sum + value;
      }, 0);
      const difference = totalOnCold + changes - theoreticalLeft;
      return difference === 0 ? "0" : `${difference > 0 ? "+" : ""}${difference}`;
    }

    return sourceEntries[selectedDay][category][metric] || "";
  };

  const viewingSnapshot = readOnly || selectedSource !== "current";
  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSource);

  const saveSnapshot = () => {
    const now = new Date();
    const snapshot: InventorySnapshot = {
      id: getSnapshotId(),
      name: formatSnapshotName(now),
      createdAt: now.toISOString(),
      entries: JSON.parse(JSON.stringify(entries)) as InventoryData,
    };

    setSnapshots((current) => [snapshot, ...current]);
    setSelectedSource(snapshot.id);
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    const previousSnapshots = latestSnapshotsRef.current;
    setSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
    if (selectedSource === snapshotId) {
      setSelectedSource("current");
    }

    try {
      await runBackgroundSync(() => deleteInventorySnapshot("bunner", snapshotId), {
        errorMessage: "Kunne ikke slette øyeblikksbildet. Endringen ble rullet tilbake.",
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Kunne ikke slette øyeblikksbilde.");
      setSnapshots(previousSnapshots);
      if (selectedSource === "current") {
        setSelectedSource(snapshotId);
      }
    }
  };

  return (
    <Card className="overflow-auto">
      <CardContent>
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Laster inn siste lagerverdier i bakgrunnen...
          </div>
        )}
        <div className="mb-6 flex gap-2">
          {!readOnly && (
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={saveSnapshot}
              disabled={viewingSnapshot}
            >
              Lagre øyeblikksbilde
            </Button>
          )}
          {!readOnly && (
            <Button variant="outline" className="text-primary" onClick={() => onOpenArchive?.()}>
              Lagerområde
            </Button>
          )}
        </div>

        {viewingSnapshot && activeSnapshot && (
          <div className="mb-6 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <Badge variant="outline">Read only snapshot</Badge>
            <span className="text-sm text-slate-600">
              {activeSnapshot.name} - {formatTimestamp(activeSnapshot.createdAt)}
            </span>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto text-red-600"
                onClick={() => void handleDeleteSnapshot(activeSnapshot.id)}
              >
                Slett
              </Button>
            )}
          </div>
        )}

        <div className="mb-6 flex items-center gap-4">
          <span className="font-medium">Dag:</span>
          <AppSelect
            value={selectedDay}
            onValueChange={(nextValue) => setSelectedDay(nextValue)}
            options={INVENTORY_DAYS.map((day) => ({ value: day, label: day }))}
            placeholder="Velg dag"
            size="sm"
            className="w-[160px]"
          />
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="sticky left-0 border bg-slate-100 px-2 py-1" rowSpan={2}>
                  Bunner
                </th>
                {(() => {
                  const beforeCount = BUNNER_METRICS.findIndex((metric) =>
                    changeMetrics.includes(metric)
                  );
                  const changeCount = changeMetrics.length;
                  const afterCount = BUNNER_METRICS.length - beforeCount - changeCount;

                  return (
                    <>
                      <th className="border bg-slate-100 px-2 py-1" colSpan={beforeCount} />
                      <th className="border bg-slate-100 px-2 py-1 text-center" colSpan={changeCount}>
                        Endringer
                      </th>
                      <th className="border bg-slate-100 px-2 py-1" colSpan={afterCount} />
                    </>
                  );
                })()}
              </tr>
              <tr>
                {BUNNER_METRICS.map((metric) => (
                  <th
                    key={metric}
                    className={`border px-2 py-1 text-left ${
                      changeMetrics.includes(metric) ? "bg-accent-gold-muted" : ""
                    }`}
                  >
                    {metric}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUNNER_CATEGORIES.map((category) => (
                <tr key={category}>
                  <td className="border bg-slate-50 px-2 py-1 font-medium">{category}</td>
                  {BUNNER_METRICS.map((metric) => {
                    const computed =
                      metric === "klar for idag" ||
                      metric === "teoretisk igjen" ||
                      metric === "avvik";

                    return (
                      <td
                        key={metric}
                        className={`border px-1 py-1 ${
                          changeMetrics.includes(metric) ? "bg-accent-gold-muted" : ""
                        }`}
                      >
                        <Input
                          value={getCellValue(category, metric)}
                          onChange={(event) =>
                            updateCell(selectedDay, category, metric, event.target.value)
                          }
                          className={`h-8 w-full p-1 text-sm ${
                            computed || viewingSnapshot ? "bg-gray-100" : ""
                          }`}
                          readOnly={computed || viewingSnapshot}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

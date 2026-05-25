"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTimestamp, getWeekdayName } from "@/lib/date-utils";
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
  return includePrefix ? `Inventory ${baseName}` : baseName;
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(hasCachedState);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(!hasCachedState);
        setRefreshing(hasCachedState);
        setError(null);
        await ensureLegacyBusinessDataMigrated();
        const state = await fetchBunnerInventoryState();
        if (!isMounted) {
          return;
        }

        setEntries(state.entries);
        setSnapshots(state.snapshots);
        setHydrated(true);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load inventory.");
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

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setSaving(true);
          await saveBunnerCurrentEntries(normalizeBunnerEntries(entries));
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Failed to save inventory changes.");
        } finally {
          setSaving(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [entries, hydrated, readOnly]);

  useEffect(() => {
    if (!hydrated || readOnly) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setSaving(true);
          await saveBunnerSnapshots(snapshots);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Failed to save snapshot archive.");
        } finally {
          setSaving(false);
        }
      })();
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
    try {
      await deleteInventorySnapshot("bunner", snapshotId);
      setSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
      if (selectedSource === snapshotId) {
        setSelectedSource("current");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete snapshot.");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-slate-500">Loading inventory...</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-red-600">{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setHydrated(false);
              setLoading(true);
              setError(null);
              void (async () => {
                try {
                  const state = await fetchBunnerInventoryState();
                  setEntries(state.entries);
                  setSnapshots(state.snapshots);
                  setHydrated(true);
                } catch (retryError) {
                  setError(
                    retryError instanceof Error ? retryError.message : "Failed to reload inventory."
                  );
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-auto">
      <CardContent>
        <div className="mb-6 flex gap-2">
          {!readOnly && (
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={saveSnapshot}
              disabled={viewingSnapshot}
            >
              Save Snapshot
            </Button>
          )}
          {!readOnly && (
            <Button variant="outline" className="text-primary" onClick={() => onOpenArchive?.()}>
              Storage area
            </Button>
          )}
        {saving && <span className="self-center text-sm text-slate-500">Saving...</span>}
        {refreshing && !loading && (
          <span className="self-center text-sm text-slate-500">Refreshing...</span>
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
                Delete
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

"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/app-select";
import { formatDate, formatTimestamp, getWeekdayName } from "@/lib/date-utils";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import {
  INVENTORY_DAYS,
  OST_METRICS,
  createEmptyOstMeta,
  createEmptyOstWeek,
  deleteInventorySnapshot,
  fetchOstInventoryState,
  getCachedOstInventoryState,
  normalizeOstEntries,
  normalizeOstMeta,
  saveOstCurrentState,
  saveOstSnapshots,
  type OstDayMeta,
  type OstInventoryData as OstData,
  type OstInventoryMeta as OstMetaByDay,
  type OstInventorySnapshot as OstSnapshot,
  type OstMetric,
} from "@/src/services/inventoryService";

function formatSnapshotName(date: Date): string {
  return `${formatDate(date)} (${getWeekdayName(date, { locale: "no-NO" })})`;
}

function getSnapshotId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayName(): string {
  const day = new Date().getDay();
  const index = (day + 6) % 7;
  return INVENTORY_DAYS[index];
}

function sanitizeNumericInput(value: string, allowSigned: boolean): string {
  let next = value.replace(/,/g, ".");
  next = next.replace(/[^0-9+\-.]/g, "");

  if (allowSigned) {
    const sign = next.startsWith("-") ? "-" : next.startsWith("+") ? "+" : "";
    let body = next.slice(sign ? 1 : 0).replace(/[+\-]/g, "");
    const pieces = body.split(".");
    if (pieces.length > 2) {
      body = `${pieces[0]}.${pieces.slice(1).join("")}`;
    }
    return `${sign}${body}`;
  }

  next = next.replace(/[+\-]/g, "");
  const parts = next.split(".");
  if (parts.length > 2) {
    next = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return next;
}

function parseNumber(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function OstInventoryLog(props?: {
  viewSnapshotId?: string;
  readOnly?: boolean;
  onOpenArchive?: () => void;
  currentDayIndex?: number;
}) {
  const { viewSnapshotId, readOnly, onOpenArchive, currentDayIndex } = props || {};
  const cachedState = getCachedOstInventoryState();
  const hasCachedState = Boolean(cachedState);
  const [selectedDay, setSelectedDay] = useState(getTodayName());
  const [selectedSource, setSelectedSource] = useState(viewSnapshotId || "current");
  const [entries, setEntries] = useState<OstData>(cachedState?.entries ?? createEmptyOstWeek);
  const [dayMeta, setDayMeta] = useState<OstMetaByDay>(cachedState?.dayMeta ?? createEmptyOstMeta);
  const [snapshots, setSnapshots] = useState<OstSnapshot[]>(cachedState?.snapshots ?? []);
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
        const state = await fetchOstInventoryState();
        if (!isMounted) {
          return;
        }

        setEntries(state.entries);
        setDayMeta(state.dayMeta);
        setSnapshots(state.snapshots);
        setHydrated(true);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load ost inventory.");
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
          await saveOstCurrentState(normalizeOstEntries(entries), normalizeOstMeta(dayMeta));
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Failed to save ost inventory.");
        } finally {
          setSaving(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [dayMeta, entries, hydrated, readOnly]);

  useEffect(() => {
    if (!hydrated || readOnly) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setSaving(true);
          await saveOstSnapshots(snapshots);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Failed to save ost snapshots.");
        } finally {
          setSaving(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [hydrated, readOnly, snapshots]);

  const viewingSnapshot = readOnly || selectedSource !== "current";
  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSource);
  const sourceEntries =
    selectedSource === "current" ? entries : activeSnapshot?.entries ?? entries;
  const sourceMeta =
    selectedSource === "current" ? dayMeta : activeSnapshot?.dayMeta ?? dayMeta;

  const updateCell = (day: string, metric: OstMetric, value: string) => {
    const allowSigned = metric === "Korrigert";
    let sanitized = sanitizeNumericInput(value, allowSigned);
    if (
      metric === "Korrigert" &&
      sanitized.length > 0 &&
      !sanitized.startsWith("+") &&
      !sanitized.startsWith("-")
    ) {
      sanitized = `+${sanitized}`;
    }

    setEntries((current) => ({
      ...current,
      [day]: {
        ...(current[day] ?? createEmptyOstWeek()[day]),
        [metric]: sanitized,
      },
    }));
  };

  const getCellValue = (metric: OstMetric): string => {
    if (metric === "Beholdning etter forbruk") {
      const amount = parseNumber(sourceEntries[selectedDay]["Antall gram"]);
      const delivered = parseNumber(sourceEntries[selectedDay]["Levert"]);
      const corrected = parseNumber(sourceEntries[selectedDay]["Korrigert"]);
      const used = parseNumber(sourceEntries[selectedDay]["Forbruk"]);
      return String(amount + delivered + corrected - used);
    }

    if (metric === "Avvik") {
      const afterUsage = parseNumber(getCellValue("Beholdning etter forbruk"));
      const afterCount = parseNumber(sourceEntries[selectedDay]["Beholdning etter telling"] || "");
      return String(afterCount - afterUsage);
    }

    return sourceEntries[selectedDay][metric] || "";
  };

  const saveSnapshot = () => {
    const now = new Date();
    const snapshot: OstSnapshot = {
      id: getSnapshotId(),
      name: formatSnapshotName(now),
      createdAt: now.toISOString(),
      entries: JSON.parse(JSON.stringify(entries)) as OstData,
      dayMeta: JSON.parse(JSON.stringify(dayMeta)) as OstMetaByDay,
    };

    setSnapshots((current) => [snapshot, ...current]);
    setSelectedSource(snapshot.id);
  };

  const updateMeta = (field: keyof OstDayMeta, value: string) => {
    setDayMeta((current) => ({
      ...current,
      [selectedDay]: {
        ...(current[selectedDay] ?? { signature: "", notes: "" }),
        [field]: value,
      },
    }));
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    try {
      await deleteInventorySnapshot("ost", snapshotId);
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
        <CardContent className="p-6 text-slate-500">Loading ost inventory...</CardContent>
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
                  const state = await fetchOstInventoryState();
                  setEntries(state.entries);
                  setDayMeta(state.dayMeta);
                  setSnapshots(state.snapshots);
                  setHydrated(true);
                } catch (retryError) {
                  setError(
                    retryError instanceof Error ? retryError.message : "Failed to reload ost inventory."
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
    <Card className="mx-auto w-full max-w-6xl overflow-auto">
      <CardContent className="px-10 py-8">
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
          <table className="table text-lg">
            <thead>
              <tr>
                {OST_METRICS.map((metric) => (
                  <th key={metric} className="border px-4 py-2 text-left">
                    {metric}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {OST_METRICS.map((metric) => {
                  const computed = metric === "Beholdning etter forbruk";
                  return (
                    <td key={metric} className="border px-2 py-2">
                      <Input
                        value={getCellValue(metric)}
                        onChange={(event) =>
                          updateCell(selectedDay, metric, event.target.value)
                        }
                        className={`h-12 w-full p-2 text-lg ${
                          computed || viewingSnapshot ? "bg-gray-100" : ""
                        }`}
                        readOnly={computed || viewingSnapshot}
                        inputMode="decimal"
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Signatur</label>
            <Input
              value={sourceMeta[selectedDay]?.signature || ""}
              onChange={(event) => updateMeta("signature", event.target.value)}
              readOnly={viewingSnapshot}
              placeholder="Sign by person completing task"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Notater om mengde</label>
            <Textarea
              value={sourceMeta[selectedDay]?.notes || ""}
              onChange={(event) => updateMeta("notes", event.target.value)}
              readOnly={viewingSnapshot}
              placeholder="Optional note about product amount"
              rows={2}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Category = "Stor" | "Medium" | "Liten" | "Glutenfri" | "Tynn";
export type Metric =
  | "fra igår"
  | "bakt idag"
  | "klar for idag"
  | "sum solgt"
  | "teoretisk igjen"
  | "feillaget"
  | "ikke hentet"
  | "tørr/ødelagt"
  | "gitt ut feil"
  | "forhåndsbestilt"
  | "avvik"
  | "totalt på kjøl";

const categories: Category[] = [
  "Stor",
  "Medium",
  "Liten",
  "Glutenfri",
  "Tynn",
];
const metrics: Metric[] = [
  "fra igår",
  "bakt idag",
  "klar for idag",
  "sum solgt",
  "teoretisk igjen",
  "feillaget",
  "ikke hentet",
  "tørr/ødelagt",
  "gitt ut feil",
  "forhåndsbestilt",
  "avvik",
  "totalt på kjøl",
];

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getTodayName(): string {
  const day = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
  // convert to index in days array where Monday=0
  const idx = (day + 6) % 7;
  return days[idx];
}

// metrics that should be grouped as "Endringer" for clarity
const changeMetrics: Metric[] = [
  "feillaget",
  "ikke hentet",
  "tørr/ødelagt",
  "gitt ut feil",
  "forhåndsbestilt",
];

const CURRENT_LOG_STORAGE_KEY = "inventoryEntries.v1";
const SNAPSHOTS_STORAGE_KEY = "inventorySnapshots.v1";

type InventoryData = Record<string, Record<Category, Record<Metric, string>>>;

type InventorySnapshot = {
  id: string;
  name: string;
  createdAt: string;
  entries: InventoryData;
};

// helper to create empty structure for a day
function createEmptyData(): Record<Category, Record<Metric, string>> {
  const data: any = {};
  categories.forEach((cat) => {
    data[cat] = {};
    metrics.forEach((m) => {
      data[cat][m] = "";
    });
  });
  return data;
}

function createEmptyWeek(): InventoryData {
  const init: InventoryData = {};
  days.forEach((d) => {
    init[d] = createEmptyData();
  });
  return init;
}

function normalizeEntries(raw: unknown): InventoryData {
  const parsed = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const fullEntries = createEmptyWeek();

  days.forEach((d) => {
    const dayData = (parsed[d] as Record<string, unknown>) || {};
    categories.forEach((cat) => {
      const catData = (dayData[cat] as Record<string, unknown>) || {};
      metrics.forEach((m) => {
        fullEntries[d][cat][m] = typeof catData[m] === "string" ? catData[m] : "";
      });
    });
  });

  return fullEntries;
}

function getSnapshotId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function InventoryLog(props?: {viewSnapshotId?: string; readOnly?: boolean; onOpenArchive?: () => void; currentDayIndex?: number}) {
  const { viewSnapshotId, readOnly, onOpenArchive, currentDayIndex } = props || {};
  const [selectedDay, setSelectedDay] = useState(getTodayName());
  const [selectedSource, setSelectedSource] = useState<string>(
    viewSnapshotId || "current"
  );

  // initialize entries and snapshots directly from localStorage to avoid
  // overwriting existing data with empty state on first render. this also
  // keeps values in sync when the component mounts multiple times (e.g. when
  // switching between bunner/ost or opening a second tab).
  const [entries, setEntries] = useState<InventoryData>(() => {
    const stored = localStorage.getItem(CURRENT_LOG_STORAGE_KEY);
    if (stored) {
      try {
        return normalizeEntries(JSON.parse(stored));
      } catch {
        // ignore parse errors and fall through to empty week
      }
    }
    return createEmptyWeek();
  });

  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>(() => {
    const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .filter((snapshot) => snapshot && typeof snapshot === "object")
            .map((snapshot) => {
              const cast = snapshot as Partial<InventorySnapshot>;
              const fallbackDate = new Date(cast.createdAt || Date.now());
              const fallbackWeekday = fallbackDate.toLocaleDateString("no-NO", { weekday: "long" });
              const fallbackName = `Inventory ${fallbackDate.toLocaleDateString("no-NO")} (${fallbackWeekday})`;
              return {
                id: typeof cast.id === "string" ? cast.id : getSnapshotId(),
                name: typeof cast.name === "string" && cast.name.trim() ? cast.name : fallbackName,
                createdAt:
                  typeof cast.createdAt === "string" ? cast.createdAt : new Date().toISOString(),
                entries: normalizeEntries(cast.entries),
              } as InventorySnapshot;
            })
            .sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          return normalized;
        }
      } catch {
        // ignore parse errors
      }
    }
    return [];
  });

  // sync storage when our in-memory state changes
  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_LOG_STORAGE_KEY, JSON.stringify(entries));
    } catch {}
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
    } catch {}
  }, [snapshots]);

  // listen for cross-tab changes so another window can update us
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === CURRENT_LOG_STORAGE_KEY && e.newValue != null) {
        try {
          setEntries(normalizeEntries(JSON.parse(e.newValue)));
        } catch {}
      }
      if (e.key === SNAPSHOTS_STORAGE_KEY && e.newValue != null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const normalized = parsed
              .filter((snapshot) => snapshot && typeof snapshot === "object")
              .map((snapshot) => {
                const cast = snapshot as Partial<InventorySnapshot>;
                const fallbackDate = new Date(cast.createdAt || Date.now());
                const fallbackWeekday = fallbackDate.toLocaleDateString("no-NO", { weekday: "long" });
                const fallbackName = `Inventory ${fallbackDate.toLocaleDateString("no-NO")} (${fallbackWeekday})`;
                return {
                  id: typeof cast.id === "string" ? cast.id : getSnapshotId(),
                  name: typeof cast.name === "string" && cast.name.trim() ? cast.name : fallbackName,
                  createdAt:
                    typeof cast.createdAt === "string" ? cast.createdAt : new Date().toISOString(),
                  entries: normalizeEntries(cast.entries),
                } as InventorySnapshot;
              })
              .sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            setSnapshots(normalized);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);


  // if parent provides a currentDayIndex, whenever that value changes update selection
  useEffect(() => {
    if (typeof currentDayIndex === "number") {
      const idx = (currentDayIndex + 6) % 7;
      const dayName = days[idx];
      setSelectedDay(dayName);
    }
  }, [currentDayIndex]);

  const updateCell = (
    day: string,
    cat: Category,
    metric: Metric,
    value: string
  ) => {
    setEntries((prev) => {
      const dayData = prev[day] || createEmptyData();
      const catData = dayData[cat] || ({} as Record<Metric, string>);
      return {
        ...prev,
        [day]: {
          ...dayData,
          [cat]: {
            ...catData,
            [metric]: value,
          },
        },
      };
    });
  };

  const getCellValue = (cat: Category, m: Metric): string => {
    const sourceEntries =
      selectedSource === "current"
        ? entries
        : snapshots.find((snapshot) => snapshot.id === selectedSource)?.entries || entries;

    if (m === "klar for idag") {
      const fraIgar = parseFloat(sourceEntries[selectedDay][cat]["fra igår"] || "0") || 0;
      const baktIdag = parseFloat(sourceEntries[selectedDay][cat]["bakt idag"] || "0") || 0;
      return (fraIgar + baktIdag).toString();
    } else if (m === "teoretisk igjen") {
      const klarForIdag = parseFloat(getCellValue(cat, "klar for idag")) || 0;
      const sumSolgt = parseFloat(sourceEntries[selectedDay][cat]["sum solgt"] || "0") || 0;
      return (klarForIdag - sumSolgt).toString();
    } else if (m === "avvik") {
      const teoretiskIgjen = parseFloat(getCellValue(cat, "teoretisk igjen")) || 0;
      const totaltPaKol = parseFloat(sourceEntries[selectedDay][cat]["totalt på kjøl"] || "0") || 0;
      // sum of all change metrics (endringer) which should cancel out
      const changes = changeMetrics.reduce((sum, cm) => {
        const v = parseFloat(sourceEntries[selectedDay][cat][cm] || "0") || 0;
        return sum + v;
      }, 0);
      const diff = totaltPaKol + changes - teoretiskIgjen;
      return diff === 0 ? "0" : (diff > 0 ? "+" : "") + diff.toString();
    }
    return sourceEntries[selectedDay][cat][m] || "";
  };

  const isComputed = (m: Metric): boolean => {
    return m === "klar for idag" || m === "teoretisk igjen" || m === "avvik";
  };

  const isChangeMetric = (m: Metric): boolean => {
    return changeMetrics.includes(m);
  };

  const viewingSnapshot = readOnly || selectedSource !== "current";
  const activeSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSource);

  const saveSnapshot = () => {
    const now = new Date();
    const iso = now.toISOString();
    const dateStr = now.toLocaleDateString("no-NO");
    const weekday = now.toLocaleDateString("no-NO", { weekday: "long" });
    const name = `${dateStr} (${weekday})`;
    const snapshot: InventorySnapshot = {
      id: getSnapshotId(),
      name,
      createdAt: iso,
      entries: JSON.parse(JSON.stringify(entries)) as InventoryData,
    };
    setSnapshots((prev) => [snapshot, ...prev]);
    setSelectedSource(snapshot.id);
  };

  const deleteSnapshot = (snapshotId: string) => {
    setSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== snapshotId));
    if (selectedSource === snapshotId) {
      setSelectedSource("current");
    }
  };

  return (
    <Card className="overflow-auto">
      <CardContent>
        <div className="mb-6 flex gap-2">
          {!readOnly && (
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={saveSnapshot}
              disabled={viewingSnapshot}
            >
              Save Snapshot
            </Button>
          )}
          {!readOnly && (
            <Button
              variant="outline"
              onClick={() => {
                if (onOpenArchive) onOpenArchive();
              else console.warn("onOpenArchive not provided");
              }}
            >
              Storage area
            </Button>
          )}
        </div>

        {viewingSnapshot && activeSnapshot && (
          <div className="mb-6 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <Badge variant="outline">Read only snapshot</Badge>
            <span className="text-sm text-slate-600">
              {activeSnapshot.name} - {new Date(activeSnapshot.createdAt).toLocaleString("no-NO")}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <span className="font-medium">Dag:</span>
          <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Velg dag" />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th
                  className="border px-2 py-1 bg-slate-100 sticky left-0"
                  rowSpan={2}
                >
                  Bunner
                </th>
                {/* group headers: before-change, change group, after-change */}
                {(() => {
                  const beforeCount = metrics.findIndex((m) => isChangeMetric(m));
                  const changeCount = changeMetrics.length;
                  const afterCount = metrics.length - beforeCount - changeCount;
                  return (
                    <>
                      <th
                        className="border px-2 py-1 bg-slate-100"
                        colSpan={beforeCount}
                      />
                      <th
                        className="border px-2 py-1 bg-slate-100 text-center"
                        colSpan={changeCount}
                      >
                        Endringer
                      </th>
                      <th
                        className="border px-2 py-1 bg-slate-100"
                        colSpan={afterCount}
                      />
                    </>
                  );
                })()}
              </tr>
              <tr>
                {metrics.map((m) => (
                  <th
                    key={m}
                    className={`border px-2 py-1 text-left ${
                      isChangeMetric(m) ? "bg-yellow-50" : ""
                    }`}
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat}>
                  <td className="border px-2 py-1 bg-slate-50 font-medium">
                    {cat}
                  </td>
                  {metrics.map((m) => (
                    <td
                      key={m}
                      className={`border px-1 py-1 ${
                        isChangeMetric(m) ? "bg-yellow-50" : ""
                      }`}
                    >
                      <Input
                        value={getCellValue(cat, m)}
                        onChange={(e) => updateCell(selectedDay, cat, m, e.target.value)}
                        className={`w-full h-8 p-1 text-sm ${
                          isComputed(m) || viewingSnapshot ? "bg-gray-100" : ""
                        }`}
                        readOnly={isComputed(m) || viewingSnapshot}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

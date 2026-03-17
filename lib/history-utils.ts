import {
  formatDate,
  getDateKeyFromTimestamp,
  getTodayDateKey,
  getWeekdayName,
  isDateKey,
} from "@/lib/date-utils";
import type { DateKey } from "@/types/calendar";
import type {
  ActivityHistoryEntry,
  SnapshotArchiveEntry,
} from "@/lib/history-types";

export const HISTORY_TIMEZONE = "Europe/Oslo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createSnapshotFallbackName(date: Date): string {
  return `Snapshot ${formatDate(date)} (${getWeekdayName(date, { locale: "no-NO" })})`;
}

export function createActivityHistoryEntry(
  description: string,
  category: string,
  routine?: string,
  timestamp: string = new Date().toISOString(),
  timeZone: string = HISTORY_TIMEZONE
): ActivityHistoryEntry {
  return {
    timestamp,
    dayKey:
      getDateKeyFromTimestamp(timestamp, { timeZone }) ??
      getTodayDateKey(timeZone),
    description,
    category,
    routine,
  };
}

export function normalizeActivityHistoryEntry(
  value: unknown,
  timeZone: string = HISTORY_TIMEZONE
): ActivityHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const timestamp =
    typeof value.timestamp === "string"
      ? value.timestamp
      : typeof value.date === "string"
        ? value.date
        : new Date().toISOString();

  const dayKey =
    typeof value.dayKey === "string" && isDateKey(value.dayKey)
      ? (value.dayKey as DateKey)
      : getDateKeyFromTimestamp(timestamp, { timeZone }) ??
        getTodayDateKey(timeZone);

  return {
    timestamp,
    dayKey,
    description: typeof value.description === "string" ? value.description : "",
    category: typeof value.category === "string" ? value.category : "Other",
    routine: typeof value.routine === "string" ? value.routine : undefined,
  };
}

export function readActivityHistoryEntries(
  storageKey = "history",
  timeZone: string = HISTORY_TIMEZONE
): ActivityHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      const normalized = normalizeActivityHistoryEntry(entry, timeZone);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function groupItemsByDayKey<T extends { dayKey: DateKey }>(
  items: T[]
): Record<DateKey, T[]> {
  return items.reduce<Record<DateKey, T[]>>((acc, item) => {
    if (!acc[item.dayKey]) {
      acc[item.dayKey] = [];
    }
    acc[item.dayKey].push(item);
    return acc;
  }, {} as Record<DateKey, T[]>);
}

export function groupActivityHistoryEntries(entries: ActivityHistoryEntry[]) {
  const result: Record<
    DateKey,
    Record<string, Record<string, ActivityHistoryEntry[]>>
  > = {} as Record<DateKey, Record<string, Record<string, ActivityHistoryEntry[]>>>;

  entries.forEach((entry) => {
    if (!result[entry.dayKey]) {
      result[entry.dayKey] = {};
    }

    if (!result[entry.dayKey][entry.category]) {
      result[entry.dayKey][entry.category] = {};
    }

    const subgroup = entry.category === "Task" ? entry.routine || "Other" : "All";
    if (!result[entry.dayKey][entry.category][subgroup]) {
      result[entry.dayKey][entry.category][subgroup] = [];
    }

    result[entry.dayKey][entry.category][subgroup].push(entry);
  });

  Object.values(result).forEach((categories) => {
    Object.values(categories).forEach((subgroups) => {
      Object.values(subgroups).forEach((items) => {
        items.sort((a, b) => {
          const timestampCompare = b.timestamp.localeCompare(a.timestamp);
          if (timestampCompare !== 0) {
            return timestampCompare;
          }

          const descriptionCompare = a.description.localeCompare(b.description);
          if (descriptionCompare !== 0) {
            return descriptionCompare;
          }

          const categoryCompare = a.category.localeCompare(b.category);
          if (categoryCompare !== 0) {
            return categoryCompare;
          }

          return (a.routine || "").localeCompare(b.routine || "");
        });
      });
    });
  });

  return result;
}

export function readSnapshotArchiveEntries(
  storageKey: string,
  timeZone: string = HISTORY_TIMEZONE
): SnapshotArchiveEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }

        const createdAt =
          typeof entry.createdAt === "string"
            ? entry.createdAt
            : new Date().toISOString();
        const parsedDate = new Date(createdAt);
        const fallbackDate = Number.isNaN(parsedDate.getTime())
          ? new Date()
          : parsedDate;

        return [
          {
            id:
              typeof entry.id === "string" && entry.id.trim()
                ? entry.id
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name:
              typeof entry.name === "string" && entry.name.trim()
                ? entry.name
                : createSnapshotFallbackName(fallbackDate),
            createdAt,
            dayKey:
              getDateKeyFromTimestamp(createdAt, { timeZone }) ??
              getTodayDateKey(timeZone),
          },
        ];
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function deleteSnapshotArchiveEntry(
  storageKey: string,
  snapshotId: string
): void {
  if (typeof window === "undefined") {
    return;
  }

  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }

    const filtered = parsed.filter((entry) => {
      if (!isRecord(entry)) {
        return true;
      }

      return entry.id !== snapshotId;
    });

    localStorage.setItem(storageKey, JSON.stringify(filtered));
  } catch {
    // ignore malformed storage
  }
}

export function findSnapshotArchiveEntry(
  storageKey: string,
  snapshotId: string
): SnapshotArchiveEntry | null {
  const snapshots = readSnapshotArchiveEntries(storageKey);
  return snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null;
}

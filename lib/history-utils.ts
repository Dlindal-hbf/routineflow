import {
  getDateKeyFromTimestamp,
  getTodayDateKey,
  isDateKey,
} from "@/lib/date-utils";
import type { DateKey } from "@/types/calendar";
import type {
  ActivityHistoryEntry,
} from "@/lib/history-types";

export const HISTORY_TIMEZONE = "Europe/Oslo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    category: typeof value.category === "string" ? value.category : "Annet",
    routine: typeof value.routine === "string" ? value.routine : undefined,
  };
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

    const subgroup = entry.category === "Task" ? entry.routine || "Annet" : "Alle";
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

import type { DateKey } from "@/types/calendar";

export type ActivityHistoryEntry = {
  timestamp: string;
  dayKey: DateKey;
  description: string;
  category: string;
  routine?: string;
};

export type SnapshotArchiveEntry = {
  id: string;
  name: string;
  createdAt: string;
  dayKey: DateKey;
};

export type TaskCalendarStatus = "complete" | "incomplete";

"use client";

import type { ActivityHistoryEntry } from "@/lib/history-types";
import {
  DEFAULT_TIMEZONE,
  ROUTINE_TASK_HISTORY_KEY,
  type LegacyTaskList,
} from "@/src/lib/scheduling/browser-reset-store";
import type { RoutineTaskHistory } from "@/src/lib/scheduling/reset-types";
import {
  BUNNER_CATEGORIES,
  BUNNER_METRICS,
  INVENTORY_DAYS,
  OST_METRICS,
  normalizeBunnerEntries,
  normalizeOstEntries,
  normalizeOstMeta,
  saveBunnerCurrentEntries,
  saveBunnerSnapshots,
  saveOstCurrentState,
  saveOstSnapshots,
  fetchBunnerInventoryState,
  fetchOstInventoryState,
  type BunnerInventorySnapshot,
  type OstInventorySnapshot,
} from "@/src/services/inventoryService";
import {
  fetchTaskStorageBundle,
  saveRoutineTaskHistory,
  saveTaskListRecords,
} from "@/src/services/taskService";
import { fetchActivityHistoryEntries, saveActivityHistoryEntries } from "@/src/services/activityService";
import { fetchWorkLogEntries, saveWorkLogEntries, type WorkLogEntryRecord } from "@/src/services/workLogService";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

const TASK_LISTS_KEY = "taskLists";
const WORK_LOG_KEY = "workLog.v1";
const ACTIVITY_HISTORY_KEY = "history";
const BUNNER_CURRENT_KEY = "inventoryEntries.v1";
const BUNNER_SNAPSHOTS_KEY = "inventorySnapshots.v1";
const OST_CURRENT_KEY = "ostInventoryEntries.v1";
const OST_META_KEY = "ostInventoryMeta.v1";
const OST_SNAPSHOTS_KEY = "ostInventorySnapshots.v1";

let migrationPromise: Promise<void> | null = null;
const completedSessionMigrations = new Set<string>();

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getMigrationKey(userId: string): string {
  return `supabase-business-migration:v1:${userId}`;
}

function getMigrationSessionKey(userId: string): string {
  return `supabase-business-migration-session:v1:${userId}`;
}

function readLegacyTaskLists(): LegacyTaskList[] {
  return safeParse<LegacyTaskList[]>(localStorage.getItem(TASK_LISTS_KEY), []);
}

function readLegacyTaskHistory(): RoutineTaskHistory[] {
  return safeParse<RoutineTaskHistory[]>(
    localStorage.getItem(ROUTINE_TASK_HISTORY_KEY),
    []
  );
}

function readLegacyWorkLog(): WorkLogEntryRecord[] {
  return safeParse<WorkLogEntryRecord[]>(localStorage.getItem(WORK_LOG_KEY), []);
}

function readLegacyActivityHistory(): ActivityHistoryEntry[] {
  return safeParse<ActivityHistoryEntry[]>(localStorage.getItem(ACTIVITY_HISTORY_KEY), []);
}

function readLegacyBunnerCurrent() {
  return normalizeBunnerEntries(
    safeParse<Record<string, unknown>>(localStorage.getItem(BUNNER_CURRENT_KEY), {})
  );
}

function readLegacyBunnerSnapshots(): BunnerInventorySnapshot[] {
  const raw = safeParse<Array<Record<string, unknown>>>(
    localStorage.getItem(BUNNER_SNAPSHOTS_KEY),
    []
  );

  return raw.map((snapshot, index) => ({
    id:
      typeof snapshot.id === "string" && snapshot.id.trim()
        ? snapshot.id
        : `bunner-snapshot-${index + 1}`,
    name:
      typeof snapshot.name === "string" && snapshot.name.trim()
        ? snapshot.name
        : `Inventory Snapshot ${index + 1}`,
    createdAt:
      typeof snapshot.createdAt === "string"
        ? snapshot.createdAt
        : new Date().toISOString(),
    entries: normalizeBunnerEntries(snapshot.entries),
  }));
}

function readLegacyOstCurrent() {
  return normalizeOstEntries(
    safeParse<Record<string, unknown>>(localStorage.getItem(OST_CURRENT_KEY), {})
  );
}

function readLegacyOstMeta() {
  return normalizeOstMeta(
    safeParse<Record<string, unknown>>(localStorage.getItem(OST_META_KEY), {})
  );
}

function readLegacyOstSnapshots(): OstInventorySnapshot[] {
  const raw = safeParse<Array<Record<string, unknown>>>(
    localStorage.getItem(OST_SNAPSHOTS_KEY),
    []
  );

  return raw.map((snapshot, index) => ({
    id:
      typeof snapshot.id === "string" && snapshot.id.trim()
        ? snapshot.id
        : `ost-snapshot-${index + 1}`,
    name:
      typeof snapshot.name === "string" && snapshot.name.trim()
        ? snapshot.name
        : `Ost Snapshot ${index + 1}`,
    createdAt:
      typeof snapshot.createdAt === "string"
        ? snapshot.createdAt
        : new Date().toISOString(),
    entries: normalizeOstEntries(snapshot.entries),
    dayMeta: normalizeOstMeta(snapshot.dayMeta),
  }));
}

function hasBunnerLocalData() {
  return Boolean(localStorage.getItem(BUNNER_CURRENT_KEY) || localStorage.getItem(BUNNER_SNAPSHOTS_KEY));
}

function hasOstLocalData() {
  return Boolean(
    localStorage.getItem(OST_CURRENT_KEY) ||
      localStorage.getItem(OST_META_KEY) ||
      localStorage.getItem(OST_SNAPSHOTS_KEY)
  );
}

function isBunnerStateEmpty(state: Awaited<ReturnType<typeof fetchBunnerInventoryState>>) {
  if (state.snapshots.length > 0) {
    return false;
  }

  return INVENTORY_DAYS.every((day) =>
    BUNNER_CATEGORIES.every((category) =>
      BUNNER_METRICS.every((metric) => !state.entries[day]?.[category]?.[metric])
    )
  );
}

function isOstStateEmpty(state: Awaited<ReturnType<typeof fetchOstInventoryState>>) {
  if (state.snapshots.length > 0) {
    return false;
  }

  const entriesEmpty = INVENTORY_DAYS.every((day) =>
    OST_METRICS.every((metric) => !state.entries[day]?.[metric])
  );
  const metaEmpty = INVENTORY_DAYS.every(
    (day) => !state.dayMeta[day]?.signature && !state.dayMeta[day]?.notes
  );

  return entriesEmpty && metaEmpty;
}

async function runMigration() {
  if (typeof window === "undefined") {
    return;
  }

  const userId = await requireSupabaseUserId();
  const migrationKey = getMigrationKey(userId);
  const migrationSessionKey = getMigrationSessionKey(userId);

  if (
    completedSessionMigrations.has(userId) ||
    sessionStorage.getItem(migrationSessionKey) === "1"
  ) {
    return;
  }

  if (localStorage.getItem(migrationKey) === "1") {
    completedSessionMigrations.add(userId);
    sessionStorage.setItem(migrationSessionKey, "1");
    return;
  }

  const [
    remoteTaskBundle,
    remoteBunnerState,
    remoteOstState,
    remoteWorkLog,
    remoteActivityHistory,
  ] = await Promise.all([
    fetchTaskStorageBundle(),
    fetchBunnerInventoryState(),
    fetchOstInventoryState(),
    fetchWorkLogEntries(),
    fetchActivityHistoryEntries(),
  ]);

  const legacyTaskLists = readLegacyTaskLists();
  const legacyTaskHistory = readLegacyTaskHistory();
  if (
    legacyTaskLists.length > 0 &&
    remoteTaskBundle.lists.length === 0 &&
    remoteTaskBundle.history.length === 0
  ) {
    await saveTaskListRecords(legacyTaskLists);
    await saveRoutineTaskHistory(legacyTaskHistory);
  }

  if (
    hasBunnerLocalData() &&
    isBunnerStateEmpty(remoteBunnerState)
  ) {
    await saveBunnerCurrentEntries(readLegacyBunnerCurrent());
    await saveBunnerSnapshots(readLegacyBunnerSnapshots());
  }

  if (
    hasOstLocalData() &&
    isOstStateEmpty(remoteOstState)
  ) {
    await saveOstCurrentState(readLegacyOstCurrent(), readLegacyOstMeta());
    await saveOstSnapshots(readLegacyOstSnapshots());
  }

  const legacyWorkLog = readLegacyWorkLog();
  if (legacyWorkLog.length > 0 && remoteWorkLog.length === 0) {
    await saveWorkLogEntries(legacyWorkLog);
  }

  const legacyActivityHistory = readLegacyActivityHistory();
  if (legacyActivityHistory.length > 0 && remoteActivityHistory.length === 0) {
    await saveActivityHistoryEntries(legacyActivityHistory);
  }

  localStorage.setItem(migrationKey, "1");
  sessionStorage.setItem(migrationSessionKey, "1");
  completedSessionMigrations.add(userId);
}

export async function ensureLegacyBusinessDataMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration().finally(() => {
      migrationPromise = null;
    });
  }

  await migrationPromise;
}

export { DEFAULT_TIMEZONE };

"use client";

import { getDateKeyFromTimestamp, isDateKey } from "@/lib/date-utils";
import { processDueResets } from "@/src/lib/scheduling/reset-engine";
import {
  RecordMetadata,
  RecordOrigin,
  RoutineFrequency,
  RoutineList,
  RoutineTask,
  RoutineTaskHistory,
} from "@/src/lib/scheduling/reset-types";
import { calculateNextResetAt } from "@/src/lib/scheduling/reset-schedule";
import { createSeedLegacyTaskLists } from "@/src/lib/scheduling/seed-routine-records";

export const ROUTINE_LISTS_KEY = "routine_lists.v1";
export const ROUTINE_TASKS_KEY = "routine_tasks.v1";
export const ROUTINE_TASK_HISTORY_KEY = "routine_task_history.v1";
const ROUTINE_SEED_BOOTSTRAPPED_KEY = "routine_seed_bootstrapped.v1";

const LEGACY_LISTS_KEY = "taskLists";
export const DEFAULT_TIMEZONE = "Europe/Oslo";

export type LegacyTask = {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  metadata?: RecordMetadata;
  createdAt?: string;
  updatedAt?: string;
};

export type LegacyTaskList = {
  id: number;
  title: string;
  description?: string;
  color?: string;
  autoReset?: boolean;
  resetEnabled?: boolean;
  frequency?: RoutineFrequency;
  resetTime?: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  timezone?: string;
  currentPeriodStartAt?: string;
  currentPeriodEndAt?: string;
  lastArchivedAt?: string;
  nextResetAt?: string;
  metadata?: RecordMetadata;
  createdAt?: string;
  updatedAt?: string;
  tasks: LegacyTask[];
};

type ParsedStorageValue = {
  raw: string | null;
  parsed: unknown;
  parseSucceeded: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeRecordOrigin(value: unknown, fallback: RecordOrigin = "admin-created"): RecordOrigin {
  if (value === "seeded" || value === "imported" || value === "admin-created") {
    return value;
  }

  return fallback;
}

function normalizeRecordMetadata(
  value: unknown,
  fallbackOrigin: RecordOrigin = "admin-created"
): RecordMetadata {
  if (!isRecord(value)) {
    return { origin: fallbackOrigin };
  }

  return {
    organizationId: normalizeOptionalText(value.organizationId),
    departmentId: normalizeOptionalText(value.departmentId),
    origin: normalizeRecordOrigin(value.origin, fallbackOrigin),
    sourceTemplateId: normalizeOptionalText(value.sourceTemplateId),
    createdBy: normalizeOptionalText(value.createdBy),
  };
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeBoundedNumber(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  const normalized = normalizeFiniteNumber(value);
  if (normalized == null) {
    return undefined;
  }

  if (normalized < min || normalized > max) {
    return undefined;
  }

  return normalized;
}

function normalizeRoutineFrequencyValue(
  value: unknown,
  autoReset = false
): RoutineFrequency {
  if (
    value === "none" ||
    value === "daily" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly"
  ) {
    return value;
  }

  return autoReset ? "daily" : "none";
}

function normalizeResetTime(value: unknown): string {
  if (typeof value !== "string") {
    return "06:00";
  }

  const parts = value.split(":");
  if (parts.length !== 2) {
    return "06:00";
  }

  const [hourRaw, minuteRaw] = parts;
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "06:00";
  }

  return `${hourRaw.padStart(2, "0")}:${minuteRaw.padStart(2, "0")}`;
}

function parseStorageValue(key: string): ParsedStorageValue {
  try {
    const raw = localStorage.getItem(key);
    console.log(`[list-storage] raw ${key}`, raw);

    if (!raw) {
      console.log(`[list-storage] parsed ${key}`, null);
      return { raw, parsed: null, parseSucceeded: true };
    }

    const parsed = JSON.parse(raw) as unknown;
    console.log(`[list-storage] parsed ${key}`, parsed);
    return { raw, parsed, parseSucceeded: true };
  } catch (error) {
    console.warn(`[list-storage] parse failed ${key}`, error);
    console.log(`[list-storage] parsed ${key}`, null);
    return { raw: localStorage.getItem(key), parsed: null, parseSucceeded: false };
  }
}

function writeJson<T>(key: string, value: T): void {
  console.log(`[list-storage] final state written back ${key}`, value);
  localStorage.setItem(key, JSON.stringify(value));
}

function syncNormalizedJson<T>(
  key: string,
  previousRaw: string | null,
  value: T,
  parseSucceeded: boolean
): void {
  if (!parseSucceeded) {
    return;
  }

  const serialized = JSON.stringify(value);
  if (previousRaw === serialized) {
    return;
  }

  console.log(`[list-storage] final state written back ${key}`, value);
  localStorage.setItem(key, serialized);
}

function normalizeLegacyTask(task: unknown, taskIndex: number): LegacyTask | null {
  if (!isRecord(task)) {
    return null;
  }

  const id = normalizeFiniteNumber(task.id) ?? taskIndex + 1;
  return {
    id,
    title: normalizeText(task.title, `Task ${id}`),
    description: normalizeText(task.description, ""),
    completed: typeof task.completed === "boolean" ? task.completed : false,
    metadata: normalizeRecordMetadata(task.metadata),
    createdAt: normalizeOptionalText(task.createdAt),
    updatedAt: normalizeOptionalText(task.updatedAt),
  };
}

function normalizeLegacyTaskLists(value: unknown): LegacyTaskList[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((list, index) => {
    if (!isRecord(list)) {
      return [];
    }

    const id = normalizeFiniteNumber(list.id) ?? index + 1;
    const resetEnabled =
      typeof list.resetEnabled === "boolean"
        ? list.resetEnabled
        : Boolean(list.autoReset);
    const frequency = normalizeRoutineFrequencyValue(list.frequency, Boolean(list.autoReset));
    const tasks = Array.isArray(list.tasks)
      ? list.tasks
          .map((task, taskIndex) => normalizeLegacyTask(task, taskIndex))
          .filter((task): task is LegacyTask => task !== null)
      : [];

    return [
      {
        id,
        title: normalizeText(list.title, `Untitled list ${id}`),
        description: normalizeText(list.description, ""),
        color: normalizeText(list.color, "red"),
        autoReset:
          typeof list.autoReset === "boolean"
            ? list.autoReset
            : frequency === "daily" && resetEnabled,
        resetEnabled,
        frequency,
        resetTime: normalizeResetTime(list.resetTime),
        resetDayOfWeek: normalizeBoundedNumber(list.resetDayOfWeek, 1, 7),
        resetDayOfMonth: normalizeBoundedNumber(list.resetDayOfMonth, 1, 31),
        timezone: normalizeText(list.timezone, DEFAULT_TIMEZONE),
        currentPeriodStartAt: normalizeOptionalText(list.currentPeriodStartAt),
        currentPeriodEndAt: normalizeOptionalText(list.currentPeriodEndAt),
        lastArchivedAt: normalizeOptionalText(list.lastArchivedAt),
        nextResetAt: normalizeOptionalText(list.nextResetAt),
        metadata: normalizeRecordMetadata(list.metadata),
        createdAt: normalizeOptionalText(list.createdAt),
        updatedAt: normalizeOptionalText(list.updatedAt),
        tasks,
      },
    ];
  });
}

function normalizeRoutineList(list: unknown, index: number): RoutineList | null {
  if (!isRecord(list)) {
    return null;
  }

  const id = String(normalizeText(list.id, String(index + 1)));
  const frequency = normalizeRoutineFrequencyValue(list.frequency);

  return {
    id,
    title: normalizeText(list.title, `Untitled list ${id}`),
    description: normalizeText(list.description, ""),
    color: normalizeText(list.color, "red"),
    metadata: normalizeRecordMetadata(list.metadata),
    resetEnabled: typeof list.resetEnabled === "boolean" ? list.resetEnabled : false,
    frequency,
    resetTime: normalizeResetTime(list.resetTime),
    resetDayOfWeek: normalizeBoundedNumber(list.resetDayOfWeek, 1, 7),
    resetDayOfMonth: normalizeBoundedNumber(list.resetDayOfMonth, 1, 31),
    timezone: normalizeText(list.timezone, DEFAULT_TIMEZONE),
    currentPeriodStartAt: normalizeOptionalText(list.currentPeriodStartAt),
    currentPeriodEndAt: normalizeOptionalText(list.currentPeriodEndAt),
    lastArchivedAt: normalizeOptionalText(list.lastArchivedAt),
    nextResetAt: normalizeOptionalText(list.nextResetAt),
    createdAt: normalizeText(list.createdAt, new Date().toISOString()),
    updatedAt: normalizeText(list.updatedAt, new Date().toISOString()),
  };
}

function normalizeRoutineLists(value: unknown): RoutineList[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((list, index) => normalizeRoutineList(list, index))
    .filter((list): list is RoutineList => list !== null);
}

function normalizeRoutineTask(
  task: unknown,
  index: number,
  listIds: Set<string>
): RoutineTask | null {
  if (!isRecord(task)) {
    return null;
  }

  const listId = normalizeText(task.listId);
  if (!listIds.has(listId)) {
    return null;
  }

  const taskId = normalizeText(task.id, `${listId}:${index + 1}`);

  return {
    id: taskId,
    listId,
    title: normalizeText(task.title, `Task ${index + 1}`),
    description: normalizeText(task.description, ""),
    sortOrder: normalizeFiniteNumber(task.sortOrder) ?? index,
    isChecked: typeof task.isChecked === "boolean" ? task.isChecked : false,
    metadata: normalizeRecordMetadata(task.metadata),
    createdAt: normalizeText(task.createdAt, new Date().toISOString()),
    updatedAt: normalizeText(task.updatedAt, new Date().toISOString()),
  };
}

function hasSeedBootstrapRun(): boolean {
  return localStorage.getItem(ROUTINE_SEED_BOOTSTRAPPED_KEY) === "1";
}

function markSeedBootstrapRun(): void {
  localStorage.setItem(ROUTINE_SEED_BOOTSTRAPPED_KEY, "1");
}

function normalizeRoutineTasks(value: unknown, listIds: Set<string>): RoutineTask[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((task, index) => normalizeRoutineTask(task, index, listIds))
    .filter((task): task is RoutineTask => task !== null);
}

function normalizeRoutineTaskHistory(value: unknown): RoutineTaskHistory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      return [];
    }

    const status = entry.status === "complete" || entry.status === "incomplete"
      ? entry.status
      : "incomplete";
    const periodStartAt = normalizeText(entry.periodStartAt, "");
    const periodEndAt = normalizeText(entry.periodEndAt, "");
    const periodStartDateKey =
      typeof entry.periodStartDateKey === "string" && isDateKey(entry.periodStartDateKey)
        ? entry.periodStartDateKey
        : getDateKeyFromTimestamp(periodStartAt, { timeZone: DEFAULT_TIMEZONE }) ?? undefined;
    const periodEndDateKey =
      typeof entry.periodEndDateKey === "string" && isDateKey(entry.periodEndDateKey)
        ? entry.periodEndDateKey
        : getDateKeyFromTimestamp(periodEndAt, { timeZone: DEFAULT_TIMEZONE }) ?? undefined;

    return [
      {
        id: normalizeText(entry.id, `history-${index + 1}`),
        listId: normalizeText(entry.listId),
        taskId: normalizeText(entry.taskId),
        taskTitleSnapshot: normalizeText(entry.taskTitleSnapshot, ""),
        periodStartAt,
        periodEndAt,
        periodStartDateKey,
        periodEndDateKey,
        archivedAt: normalizeText(entry.archivedAt, ""),
        status,
      },
    ];
  });
}

function readNormalizedLegacyTaskLists(): LegacyTaskList[] {
  const storage = parseStorageValue(LEGACY_LISTS_KEY);
  const normalized = normalizeLegacyTaskLists(storage.parsed);
  console.log(`[list-storage] normalized ${LEGACY_LISTS_KEY}`, normalized);
  syncNormalizedJson(LEGACY_LISTS_KEY, storage.raw, normalized, storage.parseSucceeded);
  return normalized;
}

function readNormalizedRoutineEntities(): {
  lists: RoutineList[];
  tasks: RoutineTask[];
  history: RoutineTaskHistory[];
} {
  const listStorage = parseStorageValue(ROUTINE_LISTS_KEY);
  const lists = normalizeRoutineLists(listStorage.parsed);
  console.log(`[list-storage] normalized ${ROUTINE_LISTS_KEY}`, lists);
  syncNormalizedJson(ROUTINE_LISTS_KEY, listStorage.raw, lists, listStorage.parseSucceeded);

  const listIds = new Set(lists.map((list) => list.id));

  const taskStorage = parseStorageValue(ROUTINE_TASKS_KEY);
  const tasks = normalizeRoutineTasks(taskStorage.parsed, listIds);
  console.log(`[list-storage] normalized ${ROUTINE_TASKS_KEY}`, tasks);
  syncNormalizedJson(ROUTINE_TASKS_KEY, taskStorage.raw, tasks, taskStorage.parseSucceeded);

  const historyStorage = parseStorageValue(ROUTINE_TASK_HISTORY_KEY);
  const history = normalizeRoutineTaskHistory(historyStorage.parsed);
  console.log(`[list-storage] normalized ${ROUTINE_TASK_HISTORY_KEY}`, history);
  syncNormalizedJson(
    ROUTINE_TASK_HISTORY_KEY,
    historyStorage.raw,
    history,
    historyStorage.parseSucceeded
  );

  return { lists, tasks, history };
}

function toRoutineFrequency(list: LegacyTaskList): RoutineFrequency {
  if (list.frequency) {
    return list.frequency;
  }

  if (list.autoReset) {
    return "daily";
  }

  return "none";
}

function toRoutineList(list: LegacyTaskList, nowIso: string): RoutineList {
  const frequency = toRoutineFrequency(list);
  const resetEnabled =
    typeof list.resetEnabled === "boolean"
      ? list.resetEnabled
      : Boolean(list.autoReset);

  const base: RoutineList = {
    id: String(list.id),
    title: list.title,
    description: list.description,
    color: list.color,
    metadata: normalizeRecordMetadata(list.metadata),
    resetEnabled,
    frequency,
    resetTime: list.resetTime ?? "06:00",
    resetDayOfWeek: list.resetDayOfWeek,
    resetDayOfMonth: list.resetDayOfMonth,
    timezone: DEFAULT_TIMEZONE,
    currentPeriodStartAt: list.currentPeriodStartAt,
    currentPeriodEndAt: list.currentPeriodEndAt,
    lastArchivedAt: list.lastArchivedAt,
    nextResetAt: list.nextResetAt,
    createdAt: list.createdAt ?? nowIso,
    updatedAt: list.updatedAt ?? nowIso,
  };

  if (base.resetEnabled && base.frequency !== "none" && !base.nextResetAt) {
    const next = calculateNextResetAt(
      {
        frequency: base.frequency,
        resetTime: base.resetTime,
        resetDayOfWeek: base.resetDayOfWeek,
        resetDayOfMonth: base.resetDayOfMonth,
        timezone: base.timezone,
      },
      new Date()
    );

    if (next) {
      base.nextResetAt = next.toISOString();
      base.currentPeriodEndAt = next.toISOString();
    }
  }

  return base;
}

function toRoutineTask(list: LegacyTaskList, task: LegacyTask, index: number, nowIso: string): RoutineTask {
  return {
    id: `${list.id}:${task.id}`,
    listId: String(list.id),
    title: task.title,
    description: task.description,
    sortOrder: index,
    isChecked: task.completed,
    metadata: normalizeRecordMetadata(task.metadata, normalizeRecordMetadata(list.metadata).origin),
    createdAt: task.createdAt ?? nowIso,
    updatedAt: task.updatedAt ?? nowIso,
  };
}

function hydrateFromLegacyStorage(): {
  lists: RoutineList[];
  tasks: RoutineTask[];
} {
  const legacyLists = readNormalizedLegacyTaskLists();
  const nowIso = new Date().toISOString();

  const lists = legacyLists.map((list) => toRoutineList(list, nowIso));
  const tasks = legacyLists.flatMap((list) =>
    list.tasks.map((task, index) => toRoutineTask(list, task, index, nowIso))
  );

  writeJson(ROUTINE_LISTS_KEY, lists);
  writeJson(ROUTINE_TASKS_KEY, tasks);

  return { lists, tasks };
}

function hydrateFromSeedData(): {
  lists: RoutineList[];
  tasks: RoutineTask[];
} {
  const nowIso = new Date().toISOString();
  const seededLegacyLists = createSeedLegacyTaskLists(nowIso);
  const normalizedSeededLists = normalizeLegacyTaskLists(seededLegacyLists);

  writeJson(LEGACY_LISTS_KEY, normalizedSeededLists);
  const hydrated = hydrateFromLegacyStorage();
  markSeedBootstrapRun();
  return hydrated;
}

function getRoutineEntities(): {
  lists: RoutineList[];
  tasks: RoutineTask[];
  history: RoutineTaskHistory[];
} {
  let { lists, tasks, history } = readNormalizedRoutineEntities();

  if (lists.length > 0) {
    markSeedBootstrapRun();
    return { lists, tasks, history };
  }

  const legacyLists = readNormalizedLegacyTaskLists();
  if (legacyLists.length > 0) {
    markSeedBootstrapRun();
    const hydrated = hydrateFromLegacyStorage();
    lists = hydrated.lists;
    tasks = hydrated.tasks;
    return { lists, tasks, history };
  }

  if (!hasSeedBootstrapRun()) {
    const seeded = hydrateFromSeedData();
    return {
      lists: seeded.lists,
      tasks: seeded.tasks,
      history,
    };
  }

  return { lists, tasks, history };
}

export function processDueResetsInBrowserStorage(now: Date = new Date()) {
  const state = getRoutineEntities();
  const result = processDueResets(state, now);

  writeJson(ROUTINE_LISTS_KEY, result.lists);
  writeJson(ROUTINE_TASKS_KEY, result.tasks);
  writeJson(ROUTINE_TASK_HISTORY_KEY, result.history);

  return result.summary;
}

export function getLegacyTaskListsWithLiveState(): LegacyTaskList[] {
  const { lists, tasks } = getRoutineEntities();

  const taskMap = new Map<string, RoutineTask[]>();
  for (const task of tasks) {
    const arr = taskMap.get(task.listId) ?? [];
    arr.push(task);
    taskMap.set(task.listId, arr);
  }

  return lists.map((list) => {
    const listTasks = (taskMap.get(list.id) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((task, index) => {
        const [, legacyTaskId] = task.id.split(":");
        const taskId = Number(legacyTaskId);
        return {
          id: Number.isFinite(taskId) ? taskId : index + 1,
          title: task.title,
          description: task.description,
          completed: task.isChecked,
          metadata: task.metadata,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        };
      });

    return {
      id: Number(list.id),
      title: list.title,
      description: list.description,
      color: list.color,
      metadata: list.metadata,
      resetEnabled: list.resetEnabled,
      frequency: list.frequency,
      resetTime: list.resetTime,
      resetDayOfWeek: list.resetDayOfWeek,
      resetDayOfMonth: list.resetDayOfMonth,
      timezone: list.timezone,
      currentPeriodStartAt: list.currentPeriodStartAt,
      currentPeriodEndAt: list.currentPeriodEndAt,
      lastArchivedAt: list.lastArchivedAt,
      nextResetAt: list.nextResetAt,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      autoReset: list.frequency === "daily" && list.resetEnabled,
      tasks: listTasks,
    };
  });
}

export function saveLegacyTaskListsToRoutineStore(lists: LegacyTaskList[]): void {
  const nowIso = new Date().toISOString();
  const normalizedLists = normalizeLegacyTaskLists(lists);

  console.log(`[list-storage] raw ${LEGACY_LISTS_KEY}`, lists);
  console.log(`[list-storage] parsed ${LEGACY_LISTS_KEY}`, lists);
  console.log(`[list-storage] normalized ${LEGACY_LISTS_KEY}`, normalizedLists);

  const previousRoutineState = readNormalizedRoutineEntities();
  const previousRoutineLists = previousRoutineState.lists;
  const previousRoutineTasks = previousRoutineState.tasks;

  const routineLists = normalizedLists.map((list) => {
    const previous = previousRoutineLists.find(
      (candidate) => candidate.id === String(list.id)
    );
    const normalizedMetadata = normalizeRecordMetadata(
      list.metadata,
      previous?.metadata.origin ?? "admin-created"
    );

    return {
      ...toRoutineList(list, nowIso),
      // timezone fixed for the app
      timezone: DEFAULT_TIMEZONE,
      metadata: normalizedMetadata,
      createdAt: previous?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
  });

  const routineTasks = normalizedLists.flatMap((list) =>
    list.tasks.map((task, index) => {
      const prevTask = previousRoutineTasks.find(
        (candidate) => candidate.id === `${list.id}:${task.id}`
      );

      return {
        id: `${list.id}:${task.id}`,
        listId: String(list.id),
        title: task.title,
        description: task.description,
        sortOrder: index,
        isChecked: task.completed,
        metadata: normalizeRecordMetadata(
          task.metadata,
          normalizeRecordMetadata(list.metadata).origin
        ),
        createdAt: prevTask?.createdAt ?? nowIso,
        updatedAt: nowIso,
      } as RoutineTask;
    })
  );

  writeJson(ROUTINE_LISTS_KEY, routineLists);
  writeJson(ROUTINE_TASKS_KEY, routineTasks);
  writeJson(LEGACY_LISTS_KEY, normalizedLists);
}

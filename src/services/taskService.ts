"use client";

import { getDateKeyFromTimestamp, isDateKey } from "@/lib/date-utils";
import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { processDueResets } from "@/src/lib/scheduling/reset-engine";
import { calculateNextResetAt } from "@/src/lib/scheduling/reset-schedule";
import type {
  RecordMetadata,
  RecordOrigin,
  RoutineFrequency,
  RoutineList,
  RoutineTask,
  RoutineTaskHistory,
} from "@/src/lib/scheduling/reset-types";
import {
  DEFAULT_TIMEZONE,
  type LegacyTask,
  type LegacyTaskList,
} from "@/src/lib/scheduling/browser-reset-store";
import { fetchCachedValue, getCachedValue, setCachedValue } from "@/src/services/clientCache";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

let taskListWriteQueue: Promise<void> = Promise.resolve();

type TaskStorageBundle = {
  lists: LegacyTaskList[];
  history: RoutineTaskHistory[];
};

type TaskListRow = {
  id: string;
  app_id: string;
  title: string;
  description: string | null;
  color: string | null;
  metadata: RecordMetadata | null;
  reset_enabled: boolean;
  frequency: RoutineFrequency;
  reset_time: string;
  reset_day_of_week: number | null;
  reset_day_of_month: number | null;
  timezone: string;
  current_period_start_at: string | null;
  current_period_end_at: string | null;
  last_archived_at: string | null;
  next_reset_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  app_id: string;
  task_list_app_id: string;
  title: string;
  description: string | null;
  frequency: string | null;
  completed: boolean;
  sort_order: number;
  metadata: RecordMetadata | null;
  created_at: string;
  updated_at: string;
};

type TaskHistoryRow = {
  id: string;
  task_list_app_id: string;
  task_app_id: string;
  task_title_snapshot: string;
  period_start_at: string;
  period_end_at: string;
  period_start_date_key: string | null;
  period_end_date_key: string | null;
  archived_at: string;
  status: "complete" | "incomplete";
};

function normalizeOrigin(value: unknown): RecordOrigin {
  if (value === "seeded" || value === "imported" || value === "admin-created") {
    return value;
  }

  return "admin-created";
}

function normalizeMetadata(value: unknown, fallback: Partial<RecordMetadata> = {}): RecordMetadata {
  const candidate =
    typeof value === "object" && value !== null ? (value as Partial<RecordMetadata>) : {};

  return {
    origin: normalizeOrigin(candidate.origin ?? fallback.origin),
    sourceTemplateId: candidate.sourceTemplateId ?? fallback.sourceTemplateId,
    createdBy: candidate.createdBy ?? fallback.createdBy,
    organizationId: candidate.organizationId ?? fallback.organizationId,
    departmentId: candidate.departmentId ?? fallback.departmentId,
  };
}

function toTaskAppId(listId: number | string, taskId: number | string): string {
  return `${listId}:${taskId}`;
}

function parseNumericTaskId(appId: string): number {
  const parts = appId.split(":");
  const last = Number(parts[parts.length - 1]);
  return Number.isFinite(last) ? last : 0;
}

function dedupeTaskLists(lists: LegacyTaskList[]): LegacyTaskList[] {
  const byAppId = new Map<string, LegacyTaskList>();
  for (const list of lists) {
    byAppId.set(String(list.id), list);
  }

  return Array.from(byAppId.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

function toPostgresTextList(values: string[]): string {
  return `(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",")})`;
}

function getTaskListsCacheKey(userId: string) {
  return `task-lists:${userId}`;
}

function getTaskHistoryCacheKey(userId: string) {
  return `task-history:${userId}`;
}

function getTaskStorageBundleCacheKey(userId: string) {
  return `task-storage-bundle:${userId}`;
}

function setTaskStorageBundleCache(
  userId: string,
  patch: Partial<TaskStorageBundle>
): TaskStorageBundle {
  const cacheKey = getTaskStorageBundleCacheKey(userId);
  const current = getCachedValue<TaskStorageBundle>(cacheKey) ?? { lists: [], history: [] };
  const next = {
    lists: patch.lists ?? current.lists,
    history: patch.history ?? current.history,
  };
  setCachedValue(cacheKey, next);
  setCachedValue("task-storage-bundle:latest", next);
  return next;
}

export function getCachedTaskStorageBundle(): TaskStorageBundle | undefined {
  return getCachedValue<TaskStorageBundle>("task-storage-bundle:latest");
}

function toLegacyTaskList(row: TaskListRow, tasks: TaskRow[]): LegacyTaskList {
  const listId = Number(row.app_id);
  const orderedTasks = [...tasks].sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: Number.isFinite(listId) ? listId : 0,
    title: row.title,
    description: row.description ?? "",
    color: row.color ?? "red",
    autoReset: row.frequency === "daily" && row.reset_enabled,
    resetEnabled: row.reset_enabled,
    frequency: row.frequency,
    resetTime: row.reset_time,
    resetDayOfWeek: row.reset_day_of_week ?? undefined,
    resetDayOfMonth: row.reset_day_of_month ?? undefined,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    currentPeriodStartAt: row.current_period_start_at ?? undefined,
    currentPeriodEndAt: row.current_period_end_at ?? undefined,
    lastArchivedAt: row.last_archived_at ?? undefined,
    nextResetAt: row.next_reset_at ?? undefined,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tasks: orderedTasks.map((task) => ({
      id: parseNumericTaskId(task.app_id),
      title: task.title,
      description: task.description ?? "",
      completed: task.completed,
      metadata: normalizeMetadata(task.metadata),
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    })),
  };
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

  const normalized: RoutineList = {
    id: String(list.id),
    title: list.title,
    description: list.description,
    color: list.color,
    metadata: normalizeMetadata(list.metadata),
    resetEnabled,
    frequency,
    resetTime: list.resetTime ?? "06:00",
    resetDayOfWeek: list.resetDayOfWeek,
    resetDayOfMonth: list.resetDayOfMonth,
    timezone: list.timezone ?? DEFAULT_TIMEZONE,
    currentPeriodStartAt: list.currentPeriodStartAt,
    currentPeriodEndAt: list.currentPeriodEndAt,
    lastArchivedAt: list.lastArchivedAt,
    nextResetAt: list.nextResetAt,
    createdAt: list.createdAt ?? nowIso,
    updatedAt: list.updatedAt ?? nowIso,
  };

  if (normalized.resetEnabled && normalized.frequency !== "none" && !normalized.nextResetAt) {
    const next = calculateNextResetAt(
      {
        frequency: normalized.frequency,
        resetTime: normalized.resetTime,
        resetDayOfWeek: normalized.resetDayOfWeek,
        resetDayOfMonth: normalized.resetDayOfMonth,
        timezone: normalized.timezone,
      },
      new Date()
    );

    if (next) {
      normalized.nextResetAt = next.toISOString();
      normalized.currentPeriodEndAt = next.toISOString();
    }
  }

  return normalized;
}

function toRoutineTask(list: LegacyTaskList, task: LegacyTask, index: number, nowIso: string): RoutineTask {
  return {
    id: toTaskAppId(list.id, task.id),
    listId: String(list.id),
    title: task.title,
    description: task.description,
    sortOrder: index,
    isChecked: task.completed,
    metadata: normalizeMetadata(task.metadata, normalizeMetadata(list.metadata)),
    createdAt: task.createdAt ?? nowIso,
    updatedAt: task.updatedAt ?? nowIso,
  };
}

function legacyListsToRoutineEntities(lists: LegacyTaskList[]) {
  const nowIso = new Date().toISOString();
  return {
    lists: lists.map((list) => toRoutineList(list, nowIso)),
    tasks: lists.flatMap((list) =>
      list.tasks.map((task, index) => toRoutineTask(list, task, index, nowIso))
    ),
  };
}

function routineEntitiesToLegacyLists(
  lists: RoutineList[],
  tasks: RoutineTask[]
): LegacyTaskList[] {
  const taskMap = new Map<string, RoutineTask[]>();
  for (const task of tasks) {
    const existing = taskMap.get(task.listId) ?? [];
    existing.push(task);
    taskMap.set(task.listId, existing);
  }

  return lists
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((list) => {
      const listTasks = (taskMap.get(list.id) ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((task, index) => ({
          id: parseNumericTaskId(task.id) || index + 1,
          title: task.title,
          description: task.description ?? "",
          completed: task.isChecked,
          metadata: normalizeMetadata(task.metadata),
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        }));

      return {
        id: Number(list.id),
        title: list.title,
        description: list.description ?? "",
        color: list.color ?? "red",
        autoReset: list.frequency === "daily" && list.resetEnabled,
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
        metadata: normalizeMetadata(list.metadata),
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        tasks: listTasks,
      } satisfies LegacyTaskList;
    });
}

export async function fetchTaskListRecords(): Promise<LegacyTaskList[]> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getTaskListsCacheKey(userId), async () => {
    const supabase = getSupabaseClient();

    const [{ data: listRows, error: listError }, { data: taskRows, error: taskError }] =
      await Promise.all([
        supabase
          .from("task_lists")
          .select(
            "id, app_id, title, description, color, metadata, reset_enabled, frequency, reset_time, reset_day_of_week, reset_day_of_month, timezone, current_period_start_at, current_period_end_at, last_archived_at, next_reset_at, sort_order, created_at, updated_at"
          )
          .eq("user_id", userId)
          .not("app_id", "like", "routine:%")
          .order("sort_order", { ascending: true }),
        supabase
          .from("tasks")
          .select(
            "app_id, task_list_app_id, title, description, frequency, completed, sort_order, metadata, created_at, updated_at"
          )
          .eq("user_id", userId)
          .not("task_list_app_id", "like", "routine:%")
          .order("sort_order", { ascending: true }),
      ]);

    if (listError) {
      throw new Error(listError.message);
    }

    if (taskError) {
      throw new Error(taskError.message);
    }

    const tasksByListId = new Map<string, TaskRow[]>();
    for (const task of (taskRows ?? []) as TaskRow[]) {
      const existing = tasksByListId.get(task.task_list_app_id) ?? [];
      existing.push(task);
      tasksByListId.set(task.task_list_app_id, existing);
    }

    const mapped = ((listRows ?? []) as TaskListRow[]).map((row) =>
      toLegacyTaskList(row, tasksByListId.get(row.app_id) ?? [])
    );

    setTaskStorageBundleCache(userId, { lists: mapped });
    return mapped;
  });
}

export async function saveTaskListRecords(lists: LegacyTaskList[]): Promise<void> {
  const saveOperation = taskListWriteQueue.catch(() => undefined).then(async () => {
    const userId = await requireSupabaseUserId();
    const supabase = getSupabaseClient();
    const nextLists = dedupeTaskLists(lists);
    setCachedValue(getTaskListsCacheKey(userId), nextLists);
    setTaskStorageBundleCache(userId, { lists: nextLists });
    const normalizedLists = nextLists.map((list, index) => ({
      user_id: userId,
      app_id: String(list.id),
      title: list.title,
      description: list.description ?? "",
      color: list.color ?? "red",
      metadata: normalizeMetadata(list.metadata),
      reset_enabled: Boolean(list.resetEnabled),
      frequency: toRoutineFrequency(list),
      reset_time: list.resetTime ?? "06:00",
      reset_day_of_week: list.resetDayOfWeek ?? null,
      reset_day_of_month: list.resetDayOfMonth ?? null,
      timezone: list.timezone ?? DEFAULT_TIMEZONE,
      current_period_start_at: list.currentPeriodStartAt ?? null,
      current_period_end_at: list.currentPeriodEndAt ?? null,
      last_archived_at: list.lastArchivedAt ?? null,
      next_reset_at: list.nextResetAt ?? null,
      sort_order: index,
      created_at: list.createdAt ?? new Date().toISOString(),
      updated_at: list.updatedAt ?? new Date().toISOString(),
    }));

    const nextListAppIds = normalizedLists.map((list) => list.app_id);

    if (normalizedLists.length > 0) {
      const { error: upsertListsError } = await supabase
        .from("task_lists")
        .upsert(normalizedLists, { onConflict: "user_id,app_id" });
      if (upsertListsError) {
        console.error("[supabase][task_lists] upsert failed", {
          table: "task_lists",
          message: upsertListsError.message,
          details: upsertListsError.details,
          hint: upsertListsError.hint,
          code: upsertListsError.code,
          sampleAppIds: nextListAppIds.slice(0, 5),
        });
        throw new Error(upsertListsError.message);
      }
    }

    const listQuery = supabase
      .from("task_lists")
      .select("id, app_id")
      .eq("user_id", userId)
      .not("app_id", "like", "routine:%");

    const { data: insertedLists, error: fetchInsertedListsError } =
      nextListAppIds.length > 0
        ? await listQuery.in("app_id", nextListAppIds)
        : await listQuery;

    if (fetchInsertedListsError) {
      throw new Error(fetchInsertedListsError.message);
    }

    const listIdMap = new Map(
      ((insertedLists ?? []) as Array<{ id: string; app_id: string }>).map((row) => [
        row.app_id,
        row.id,
      ])
    );

    const taskRows = nextLists.flatMap((list) =>
      list.tasks.map((task, index) => {
        const maybeFrequency = (task as LegacyTask & { frequency?: string }).frequency;
        const taskListId = listIdMap.get(String(list.id));
        if (!taskListId) {
          throw new Error(`Missing task list row for app_id ${String(list.id)}.`);
        }

        return {
          user_id: userId,
          app_id: toTaskAppId(list.id, task.id),
          task_list_id: taskListId,
          task_list_app_id: String(list.id),
          title: task.title,
          description: task.description ?? "",
          frequency: maybeFrequency ?? null,
          completed: Boolean(task.completed),
          sort_order: index,
          metadata: normalizeMetadata(task.metadata, normalizeMetadata(list.metadata)),
          created_at: task.createdAt ?? new Date().toISOString(),
          updated_at: task.updatedAt ?? new Date().toISOString(),
        };
      })
    );

    const nextTaskAppIds = taskRows.map((task) => task.app_id);

    if (taskRows.length > 0) {
      const { error: upsertTasksError } = await supabase
        .from("tasks")
        .upsert(taskRows, { onConflict: "user_id,app_id" });
      if (upsertTasksError) {
        throw new Error(upsertTasksError.message);
      }
    }

    const staleTasksQuery = supabase
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .not("task_list_app_id", "like", "routine:%");

    const { error: deleteTasksError } =
      nextTaskAppIds.length > 0
        ? await staleTasksQuery.filter("app_id", "not.in", toPostgresTextList(nextTaskAppIds))
        : await staleTasksQuery;
    if (deleteTasksError) {
      throw new Error(deleteTasksError.message);
    }

    const staleListsQuery = supabase
      .from("task_lists")
      .delete()
      .eq("user_id", userId)
      .not("app_id", "like", "routine:%");

    const { error: deleteListsError } =
      nextListAppIds.length > 0
        ? await staleListsQuery.filter("app_id", "not.in", toPostgresTextList(nextListAppIds))
        : await staleListsQuery;
    if (deleteListsError) {
      throw new Error(deleteListsError.message);
    }
  });

  taskListWriteQueue = saveOperation.then(() => undefined, () => undefined);
  return saveOperation;
}

export async function fetchRoutineTaskHistory(): Promise<RoutineTaskHistory[]> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getTaskHistoryCacheKey(userId), async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("task_history")
      .select(
        "id, task_list_app_id, task_app_id, task_title_snapshot, period_start_at, period_end_at, period_start_date_key, period_end_date_key, archived_at, status"
      )
      .eq("user_id", userId)
      .order("archived_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = ((data ?? []) as TaskHistoryRow[]).map((row) => ({
      id: row.id,
      listId: row.task_list_app_id,
      taskId: row.task_app_id,
      taskTitleSnapshot: row.task_title_snapshot,
      periodStartAt: row.period_start_at,
      periodEndAt: row.period_end_at,
      periodStartDateKey:
        row.period_start_date_key && isDateKey(row.period_start_date_key)
          ? row.period_start_date_key
          : getDateKeyFromTimestamp(row.period_start_at, { timeZone: DEFAULT_TIMEZONE }) ??
            undefined,
      periodEndDateKey:
        row.period_end_date_key && isDateKey(row.period_end_date_key)
          ? row.period_end_date_key
          : getDateKeyFromTimestamp(row.period_end_at, { timeZone: DEFAULT_TIMEZONE }) ??
            undefined,
      archivedAt: row.archived_at,
      status: row.status,
    }));

    setTaskStorageBundleCache(userId, { history: mapped });
    return mapped;
  });
}

export async function saveRoutineTaskHistory(history: RoutineTaskHistory[]): Promise<void> {
  const userId = await requireSupabaseUserId();
  setCachedValue(getTaskHistoryCacheKey(userId), history);
  setTaskStorageBundleCache(userId, { history });
  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from("task_history")
    .delete()
    .eq("user_id", userId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (history.length === 0) {
    return;
  }

  const rows = history.map((entry) => {
    const [listAppId] = entry.taskId.includes(":")
      ? entry.taskId.split(":")
      : [entry.listId];

    return {
      user_id: userId,
      task_list_app_id: entry.listId || listAppId,
      task_app_id: entry.taskId,
      task_title_snapshot: entry.taskTitleSnapshot,
      period_start_at: entry.periodStartAt,
      period_end_at: entry.periodEndAt,
      period_start_date_key: entry.periodStartDateKey ?? null,
      period_end_date_key: entry.periodEndDateKey ?? null,
      archived_at: entry.archivedAt,
      status: entry.status,
    };
  });

  console.info("[supabase][task_history] inserting rows", {
    rowCount: rows.length,
    sampleTaskAppIds: rows.slice(0, 3).map((row) => row.task_app_id),
    sampleListAppIds: rows.slice(0, 3).map((row) => row.task_list_app_id),
    samplePeriods: rows.slice(0, 3).map((row) => ({
      periodStartAt: row.period_start_at,
      periodEndAt: row.period_end_at,
    })),
  });

  const { error: insertError } = await supabase.from("task_history").insert(rows);
  if (insertError) {
    console.error("[supabase][task_history] insert failed", {
      table: "task_history",
      uuidStrategy: "database_generated",
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      code: insertError.code,
      sampleRow: rows[0],
    });
    throw new Error(insertError.message);
  }
}

export async function fetchTaskStorageBundle(): Promise<TaskStorageBundle> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getTaskStorageBundleCacheKey(userId), async () => {
    const [lists, history] = await Promise.all([
      fetchTaskListRecords(),
      fetchRoutineTaskHistory(),
    ]);

    const bundle = { lists, history };
    setCachedValue("task-storage-bundle:latest", bundle);
    return bundle;
  });
}

export async function processDueResetsInSupabase(now: Date = new Date()) {
  const { lists, history } = await fetchTaskStorageBundle();
  const routineEntities = legacyListsToRoutineEntities(lists);
  const result = processDueResets(
    {
      lists: routineEntities.lists,
      tasks: routineEntities.tasks,
      history,
    },
    now
  );

  if (result.summary.processedLists === 0 && result.summary.archivedRecords === 0) {
    return result.summary;
  }

  const updatedLists = routineEntitiesToLegacyLists(result.lists, result.tasks);
  await Promise.all([saveTaskListRecords(updatedLists), saveRoutineTaskHistory(result.history)]);
  return result.summary;
}

"use client";

import { processDueResets } from "@/src/lib/scheduling/reset-engine";
import {
  RoutineFrequency,
  RoutineList,
  RoutineTask,
  RoutineTaskHistory,
} from "@/src/lib/scheduling/reset-types";
import { calculateNextResetAt } from "@/src/lib/scheduling/reset-schedule";

export const ROUTINE_LISTS_KEY = "routine_lists.v1";
export const ROUTINE_TASKS_KEY = "routine_tasks.v1";
export const ROUTINE_TASK_HISTORY_KEY = "routine_task_history.v1";

const LEGACY_LISTS_KEY = "taskLists";
export const DEFAULT_TIMEZONE = "Europe/Oslo";

export type LegacyTask = {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
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
  tasks: LegacyTask[];
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
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
    createdAt: nowIso,
    updatedAt: nowIso,
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
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function hydrateFromLegacyStorage(): {
  lists: RoutineList[];
  tasks: RoutineTask[];
} {
  const legacyLists = readJson<LegacyTaskList[]>(LEGACY_LISTS_KEY, []);
  const nowIso = new Date().toISOString();

  const lists = legacyLists.map((list) => toRoutineList(list, nowIso));
  const tasks = legacyLists.flatMap((list) =>
    list.tasks.map((task, index) => toRoutineTask(list, task, index, nowIso))
  );

  writeJson(ROUTINE_LISTS_KEY, lists);
  writeJson(ROUTINE_TASKS_KEY, tasks);

  return { lists, tasks };
}

function getRoutineEntities(): {
  lists: RoutineList[];
  tasks: RoutineTask[];
  history: RoutineTaskHistory[];
} {
  let lists = readJson<RoutineList[]>(ROUTINE_LISTS_KEY, []);
  let tasks = readJson<RoutineTask[]>(ROUTINE_TASKS_KEY, []);
  const history = readJson<RoutineTaskHistory[]>(ROUTINE_TASK_HISTORY_KEY, []);

  if (lists.length === 0 && tasks.length === 0) {
    const hydrated = hydrateFromLegacyStorage();
    lists = hydrated.lists;
    tasks = hydrated.tasks;
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
      .map((task) => {
        const [, legacyTaskId] = task.id.split(":");
        return {
          id: Number(legacyTaskId),
          title: task.title,
          description: task.description,
          completed: task.isChecked,
        };
      });

    return {
      id: Number(list.id),
      title: list.title,
      description: list.description,
      color: list.color,
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
      autoReset: list.frequency === "daily" && list.resetEnabled,
      tasks: listTasks,
    };
  });
}

export function saveLegacyTaskListsToRoutineStore(lists: LegacyTaskList[]): void {
  const nowIso = new Date().toISOString();

  const routineLists = lists.map((list) => {
    const previous = readJson<RoutineList[]>(ROUTINE_LISTS_KEY, []).find(
      (candidate) => candidate.id === String(list.id)
    );

    return {
      ...toRoutineList(list, nowIso),
      // timezone fixed for the app
      timezone: DEFAULT_TIMEZONE,
      createdAt: previous?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
  });

  const routineTasks = lists.flatMap((list) =>
    list.tasks.map((task, index) => {
      const prevTask = readJson<RoutineTask[]>(ROUTINE_TASKS_KEY, []).find(
        (candidate) => candidate.id === `${list.id}:${task.id}`
      );

      return {
        id: `${list.id}:${task.id}`,
        listId: String(list.id),
        title: task.title,
        description: task.description,
        sortOrder: index,
        isChecked: task.completed,
        createdAt: prevTask?.createdAt ?? nowIso,
        updatedAt: nowIso,
      } as RoutineTask;
    })
  );

  writeJson(ROUTINE_LISTS_KEY, routineLists);
  writeJson(ROUTINE_TASKS_KEY, routineTasks);
  writeJson(LEGACY_LISTS_KEY, lists);
}

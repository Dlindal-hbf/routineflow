import {
  ResetEngineInput,
  ResetEngineResult,
  ResetSchedulePolicy,
  RoutineList,
  RoutineTask,
  RoutineTaskHistory,
} from "@/src/lib/scheduling/reset-types";
import {
  calculateNextResetAt,
  calculatePreviousPeriodStartAt,
} from "@/src/lib/scheduling/reset-schedule";
import { toDateKeyInTimeZone } from "@/lib/date-utils";

function createHistoryId(
  listId: string,
  taskId: string,
  periodStartAt: string,
  periodEndAt: string
): string {
  return `${listId}:${taskId}:${periodStartAt}:${periodEndAt}`;
}

function toPolicy(list: RoutineList): ResetSchedulePolicy {
  return {
    frequency: list.frequency,
    resetTime: list.resetTime,
    resetDayOfWeek: list.resetDayOfWeek,
    resetDayOfMonth: list.resetDayOfMonth,
    // timezone must match DEFAULT_TIMEZONE; list.timezone retained only for legacy
    timezone: list.timezone || "Europe/Oslo",
    anchorStartAt: list.currentPeriodStartAt,
  };
}

function ensureScheduleWindow(list: RoutineList, now: Date): RoutineList {
  if (!list.resetEnabled || list.frequency === "none") {
    return {
      ...list,
      nextResetAt: undefined,
      currentPeriodEndAt: undefined,
      currentPeriodStartAt: undefined,
    };
  }

  const policy = toPolicy(list);

  if (!list.nextResetAt) {
    const next = calculateNextResetAt(policy, now);
    const nextIso = next?.toISOString();
    const previousStart = next
      ? calculatePreviousPeriodStartAt(policy, next).toISOString()
      : undefined;

    return {
      ...list,
      currentPeriodStartAt: list.currentPeriodStartAt ?? previousStart,
      currentPeriodEndAt: list.currentPeriodEndAt ?? nextIso,
      nextResetAt: nextIso,
      updatedAt: now.toISOString(),
    };
  }

  return list;
}

function archivePeriod(
  list: RoutineList,
  listTasks: RoutineTask[],
  existingHistory: RoutineTaskHistory[],
  now: Date
): {
  list: RoutineList;
  tasks: RoutineTask[];
  newHistory: RoutineTaskHistory[];
  archivedRecords: number;
  resetTasks: number;
} {
  const policy = toPolicy(list);

  const periodEndAt = list.currentPeriodEndAt ?? list.nextResetAt;
  if (!periodEndAt) {
    return {
      list,
      tasks: listTasks,
      newHistory: existingHistory,
      archivedRecords: 0,
      resetTasks: 0,
    };
  }

  const periodEnd = new Date(periodEndAt);
  const periodStartAt =
    list.currentPeriodStartAt ??
    calculatePreviousPeriodStartAt(policy, periodEnd).toISOString();
  const periodEndIso = periodEnd.toISOString();
  const timeZone = policy.timezone || "Europe/Oslo";
  const periodStartDateKey = toDateKeyInTimeZone(new Date(periodStartAt), timeZone);
  const periodEndDateKey = toDateKeyInTimeZone(periodEnd, timeZone);

  const nextPeriodEnd = calculateNextResetAt(policy, periodEnd);

  let archivedRecords = 0;
  const history = [...existingHistory];

  for (const task of listTasks) {
    const historyId = createHistoryId(list.id, task.id, periodStartAt, periodEndIso);
    const alreadyArchived = history.some((record) => record.id === historyId);

    if (alreadyArchived) {
      continue;
    }

    history.push({
      id: historyId,
      listId: list.id,
      taskId: task.id,
      taskTitleSnapshot: task.title,
      periodStartAt,
      periodEndAt: periodEndIso,
      periodStartDateKey,
      periodEndDateKey,
      archivedAt: now.toISOString(),
      status: task.isChecked ? "complete" : "incomplete",
    });

    archivedRecords += 1;
  }

  const resetTasks = listTasks.filter((t) => t.isChecked).length;

  const updatedTasks = listTasks.map((task) => ({
    ...task,
    isChecked: false,
    updatedAt: now.toISOString(),
  }));

  const updatedList: RoutineList = {
    ...list,
    lastArchivedAt: now.toISOString(),
    currentPeriodStartAt: periodEndIso,
    currentPeriodEndAt: nextPeriodEnd?.toISOString(),
    nextResetAt: nextPeriodEnd?.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    list: updatedList,
    tasks: updatedTasks,
    newHistory: history,
    archivedRecords,
    resetTasks,
  };
}

export function processDueResets(
  input: ResetEngineInput,
  now: Date = new Date()
): ResetEngineResult {
  let lists = input.lists.map((list) => ensureScheduleWindow(list, now));
  let tasks = [...input.tasks];
  let history = [...input.history];

  const summary: ResetEngineResult["summary"] = {
    processedLists: 0,
    archivedRecords: 0,
    resetTasks: 0,
    skippedLists: 0,
    archivedListIds: [],
  };

  for (const list of lists) {
    if (!list.resetEnabled || list.frequency === "none" || !list.nextResetAt) {
      summary.skippedLists += 1;
      continue;
    }

    const listTasks = tasks.filter((task) => task.listId === list.id);

    let mutableList = list;
    let mutableTasks = listTasks;
    let loopGuard = 0;
    let listProcessed = false;

    while (mutableList.nextResetAt && new Date(mutableList.nextResetAt) <= now) {
      const archived = archivePeriod(mutableList, mutableTasks, history, now);
      mutableList = archived.list;
      mutableTasks = archived.tasks;
      history = archived.newHistory;

      summary.archivedRecords += archived.archivedRecords;
      summary.resetTasks += archived.resetTasks;
      listProcessed = true;

      loopGuard += 1;
      if (loopGuard > 24) {
        break;
      }
    }

    if (listProcessed) {
      summary.processedLists += 1;
      summary.archivedListIds.push(list.id);
    }

    tasks = tasks.map((task) => {
      const replacement = mutableTasks.find((t) => t.id === task.id);
      return replacement ?? task;
    });

    lists = lists.map((candidate) =>
      candidate.id === mutableList.id ? mutableList : candidate
    );
  }

  return { lists, tasks, history, summary };
}

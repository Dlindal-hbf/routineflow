import {
  DEFAULT_TIMEZONE,
  getLegacyTaskListsWithLiveState,
  LegacyTask,
  LegacyTaskList,
  saveLegacyTaskListsToRoutineStore,
} from "@/src/lib/scheduling/browser-reset-store";
import { RecordMetadata, RecordOrigin, RoutineFrequency } from "@/src/lib/scheduling/reset-types";
import { RoutineTemplateDefinition } from "@/src/lib/scheduling/routine-templates";

export type ImportContext = {
  createdBy?: string;
  organizationId?: string;
  departmentId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toBoundedInt(value: unknown, min: number, max: number): number | undefined {
  const parsed = toNumber(value);
  if (parsed == null || !Number.isInteger(parsed)) {
    return undefined;
  }
  if (parsed < min || parsed > max) {
    return undefined;
  }
  return parsed;
}

function toResetTime(value: unknown): string {
  if (typeof value !== "string") {
    return "06:00";
  }

  const [hourRaw, minuteRaw] = value.split(":");
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

function toFrequency(value: unknown): RoutineFrequency {
  if (
    value === "none" ||
    value === "daily" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly"
  ) {
    return value;
  }

  return "none";
}

function toOrigin(value: unknown, fallback: RecordOrigin): RecordOrigin {
  if (value === "seeded" || value === "imported" || value === "admin-created") {
    return value;
  }

  return fallback;
}

function toMetadata(
  value: unknown,
  fallbackOrigin: RecordOrigin,
  context?: ImportContext,
  sourceTemplateId?: string
): RecordMetadata {
  if (!isRecord(value)) {
    return {
      origin: fallbackOrigin,
      sourceTemplateId,
      createdBy: context?.createdBy,
      organizationId: context?.organizationId,
      departmentId: context?.departmentId,
    };
  }

  return {
    origin: toOrigin(value.origin, fallbackOrigin),
    sourceTemplateId: toOptionalText(value.sourceTemplateId) ?? sourceTemplateId,
    createdBy: toOptionalText(value.createdBy) ?? context?.createdBy,
    organizationId: toOptionalText(value.organizationId) ?? context?.organizationId,
    departmentId: toOptionalText(value.departmentId) ?? context?.departmentId,
  };
}

export function loadTaskListRecords(): LegacyTaskList[] {
  return getLegacyTaskListsWithLiveState();
}

export function saveTaskListRecords(lists: LegacyTaskList[]): void {
  saveLegacyTaskListsToRoutineStore(lists);
}

function normalizeImportedTask(
  rawTask: unknown,
  taskId: number,
  context?: ImportContext,
  listSourceTemplateId?: string
): LegacyTask | null {
  if (!isRecord(rawTask)) {
    return null;
  }

  const title = toText(rawTask.title).trim();
  if (!title) {
    return null;
  }

  const taskSourceTemplateId =
    toOptionalText(rawTask.sourceTemplateId) ??
    toOptionalText(rawTask.templateId) ??
    (listSourceTemplateId ? `${listSourceTemplateId}.task.${taskId}` : undefined);

  return {
    id: taskId,
    title,
    description: toText(rawTask.description, ""),
    completed: false,
    metadata: toMetadata(rawTask.metadata, "imported", context, taskSourceTemplateId),
  };
}

function normalizeImportedList(
  rawList: unknown,
  listId: number,
  context?: ImportContext
): LegacyTaskList | null {
  if (!isRecord(rawList)) {
    return null;
  }

  const title = toText(rawList.title).trim();
  if (!title) {
    return null;
  }

  const sourceTemplateId =
    toOptionalText(rawList.sourceTemplateId) ?? toOptionalText(rawList.templateId);

  const rawTasks = Array.isArray(rawList.tasks) ? rawList.tasks : [];
  const tasks = rawTasks
    .map((rawTask, index) => normalizeImportedTask(rawTask, index + 1, context, sourceTemplateId))
    .filter((task): task is LegacyTask => task !== null);

  const frequency = toFrequency(rawList.frequency);
  const resetEnabled = toBool(rawList.resetEnabled, frequency !== "none");

  return {
    id: listId,
    title,
    description: toText(rawList.description, ""),
    color: toText(rawList.color, "red"),
    autoReset: frequency === "daily" && resetEnabled,
    resetEnabled,
    frequency,
    resetTime: toResetTime(rawList.resetTime),
    resetDayOfWeek: toBoundedInt(rawList.resetDayOfWeek, 1, 7),
    resetDayOfMonth: toBoundedInt(rawList.resetDayOfMonth, 1, 31),
    timezone: toText(rawList.timezone, DEFAULT_TIMEZONE),
    currentPeriodStartAt: undefined,
    currentPeriodEndAt: undefined,
    lastArchivedAt: undefined,
    nextResetAt: undefined,
    metadata: toMetadata(rawList.metadata, "imported", context, sourceTemplateId),
    tasks,
  };
}

export function importTaskListRecords(
  currentLists: LegacyTaskList[],
  payload: unknown,
  context?: ImportContext
): LegacyTaskList[] {
  const rawLists = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.lists)
    ? payload.lists
    : [];

  if (rawLists.length === 0) {
    return currentLists;
  }

  let nextListId = Math.max(0, ...currentLists.map((list) => list.id)) + 1;
  const importedLists: LegacyTaskList[] = [];

  for (const rawList of rawLists) {
    const parsed = normalizeImportedList(rawList, nextListId, context);
    if (!parsed) {
      continue;
    }

    importedLists.push(parsed);
    nextListId += 1;
  }

  const merged = [...currentLists, ...importedLists];
  saveTaskListRecords(merged);
  return merged;
}

function toTemplateSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "template";
}

export function importRoutineTemplateRecords(
  currentLists: LegacyTaskList[],
  template: RoutineTemplateDefinition,
  templateIndex: number,
  context?: ImportContext
): LegacyTaskList[] {
  const templateSlug = `${toTemplateSlug(template.name)}-${templateIndex + 1}`;

  const payload = [
    {
      sourceTemplateId: `preset.${templateSlug}`,
      title: template.listName,
      description: template.listDescription,
      color: template.color,
      frequency: template.frequency,
      resetTime: template.resetTime,
      tasks: template.tasks.map((task, index) => ({
        sourceTemplateId: `preset.${templateSlug}.task.${index + 1}`,
        title: task.name,
        description: task.description,
      })),
    },
  ];

  return importTaskListRecords(currentLists, payload, context);
}

import type { DateKey } from "@/types/calendar";

export type RoutineFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly";

export type RecordOrigin = "seeded" | "imported" | "admin-created";

export type RecordMetadata = {
  organizationId?: string;
  departmentId?: string;
  origin: RecordOrigin;
  sourceTemplateId?: string;
  createdBy?: string;
};

export type RoutineList = {
  id: string;
  title: string;
  description?: string;
  color?: string;
  metadata: RecordMetadata;

  resetEnabled: boolean;
  frequency: RoutineFrequency;

  resetTime: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  timezone: string;

  currentPeriodStartAt?: string;
  currentPeriodEndAt?: string;

  lastArchivedAt?: string;
  nextResetAt?: string;

  createdAt: string;
  updatedAt: string;
};

export type RoutineTask = {
  id: string;
  listId: string;

  title: string;
  description?: string;

  sortOrder: number;

  isChecked: boolean;

  metadata: RecordMetadata;

  createdAt: string;
  updatedAt: string;
};

export type RoutineTaskHistory = {
  id: string;
  listId: string;
  taskId: string;

  taskTitleSnapshot: string;

  periodStartAt: string;
  periodEndAt: string;
  periodStartDateKey?: DateKey;
  periodEndDateKey?: DateKey;

  archivedAt: string;

  status: "complete" | "incomplete";
};

export type ResetSchedulePolicy = {
  frequency: RoutineFrequency;
  resetTime: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  // timezone parameter ignored, default Europe/Oslo
  timezone?: string;
  anchorStartAt?: string;
};

export type ResetEngineInput = {
  lists: RoutineList[];
  tasks: RoutineTask[];
  history: RoutineTaskHistory[];
};

export type ResetEngineResult = {
  lists: RoutineList[];
  tasks: RoutineTask[];
  history: RoutineTaskHistory[];
  summary: {
    processedLists: number;
    archivedRecords: number;
    resetTasks: number;
    skippedLists: number;
    archivedListIds: string[];
  };
};

"use client";

import type { RecordMetadata, RoutineFrequency } from "@/src/lib/scheduling/reset-types";

export const ROUTINE_LISTS_KEY = "routine_lists.v1";
export const ROUTINE_TASKS_KEY = "routine_tasks.v1";
export const ROUTINE_TASK_HISTORY_KEY = "routine_task_history.v1";
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

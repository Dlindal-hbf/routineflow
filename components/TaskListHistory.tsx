"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import HistoryEmptyState from "@/components/history/HistoryEmptyState";
import TaskStatusCalendar from "@/components/history/TaskStatusCalendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDateKeyFromTimestamp,
  getStartOfMonthDateKey,
  getTodayDateKey,
} from "@/lib/date-utils";
import type { TaskCalendarStatus } from "@/lib/history-types";
import {
  DEFAULT_TIMEZONE,
  ROUTINE_TASK_HISTORY_KEY,
  ROUTINE_TASKS_KEY,
} from "@/src/lib/scheduling/browser-reset-store";
import {
  RoutineTask,
  RoutineTaskHistory,
} from "@/src/lib/scheduling/reset-types";
import type { DateKey } from "@/types/calendar";

type TaskHistoryView = {
  taskId: string;
  taskTitle: string;
  records: Record<string, TaskCalendarStatus>;
};

interface Props {
  listId: number;
}

function readTaskHistoriesForList(listIdAsString: string): TaskHistoryView[] {
  if (typeof window === "undefined") {
    return [];
  }

  let allTasks: RoutineTask[] = [];
  let allHistory: RoutineTaskHistory[] = [];

  try {
    const storedTasks = localStorage.getItem(ROUTINE_TASKS_KEY);
    if (storedTasks) {
      allTasks = JSON.parse(storedTasks) as RoutineTask[];
    }
  } catch {
    // ignore parse errors
  }

  try {
    const storedHistory = localStorage.getItem(ROUTINE_TASK_HISTORY_KEY);
    if (storedHistory) {
      allHistory = JSON.parse(storedHistory) as RoutineTaskHistory[];
    }
  } catch {
    // ignore parse errors
  }

  const tasksForList = allTasks
    .filter((task) => task.listId === listIdAsString)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return tasksForList.map((task) => {
    const taskRecords = allHistory
      .filter(
        (record) => record.listId === listIdAsString && record.taskId === task.id
      )
      .sort((a, b) => new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime());

    const records: Record<string, TaskCalendarStatus> = {};
    for (const record of taskRecords) {
      const dateKey =
        record.periodEndDateKey ??
        getDateKeyFromTimestamp(record.periodEndAt, {
          timeZone: DEFAULT_TIMEZONE,
        });

      if (!dateKey) {
        continue;
      }

      records[dateKey] = record.status;
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      records,
    };
  });
}

export default function TaskListHistory({ listId }: Props) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<DateKey>(() =>
    getStartOfMonthDateKey(getTodayDateKey(DEFAULT_TIMEZONE))
  );
  const [storageVersion, setStorageVersion] = useState(0);

  const listIdAsString = String(listId);
  const taskHistories = useMemo(
    () => {
      void storageVersion;
      return readTaskHistoriesForList(listIdAsString);
    },
    [listIdAsString, storageVersion]
  );

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (
        event.key === ROUTINE_TASKS_KEY ||
        event.key === ROUTINE_TASK_HISTORY_KEY
      ) {
        setStorageVersion((version) => version + 1);
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (taskHistories.length === 0) {
    return (
      <HistoryEmptyState
        title="No history recorded yet."
        description="Complete tasks to start building archived task history."
      />
    );
  }

  return (
    <div className="space-y-6">
      {taskHistories.map((taskHist) => (
        <motion.div
          key={taskHist.taskId}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="cursor-pointer"
          onClick={() =>
            setExpandedTask(
              expandedTask === taskHist.taskId ? null : taskHist.taskId
            )
          }
        >
          <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <motion.div
                layout
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-slate-600" />
                  <h3 className="text-2xl font-semibold">{taskHist.taskTitle}</h3>
                </div>
                <Badge className="rounded-full bg-accent-gold-muted px-3 py-1 text-accent-gold">
                  {Object.keys(taskHist.records).length} records
                </Badge>
              </motion.div>

              {expandedTask === taskHist.taskId && (
                <div className="mt-6 border-t pt-6" onClick={(event) => event.stopPropagation()}>
                  <TaskStatusCalendar
                    monthKey={selectedMonthKey}
                    onMonthKeyChange={setSelectedMonthKey}
                    statusByDateKey={taskHist.records}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

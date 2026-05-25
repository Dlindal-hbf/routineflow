"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, LoaderCircle } from "lucide-react";
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
import type { DateKey } from "@/types/calendar";
import { isCachedValueStale } from "@/src/services/clientCache";
import { runBackgroundSync } from "@/src/services/backgroundSync";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import { fetchTaskStorageBundle, getCachedTaskStorageBundle } from "@/src/services/taskService";

const TASK_HISTORY_CACHE_KEY = "task-storage-bundle:latest";
const TASK_HISTORY_STALE_AFTER_MS = 30_000;

type TaskHistoryView = {
  taskId: string;
  taskTitle: string;
  records: Record<string, TaskCalendarStatus>;
};

interface Props {
  listId: number;
}

function buildTaskHistories(
  listId: number,
  bundle: Awaited<ReturnType<typeof fetchTaskStorageBundle>>
): TaskHistoryView[] {
  const listIdAsString = String(listId);
  const selectedList = bundle.lists.find((list) => String(list.id) === listIdAsString);
  if (!selectedList) {
    return [];
  }

  return selectedList.tasks.map((task) => {
    const taskAppId = `${listId}:${task.id}`;
    const taskRecords = bundle.history
      .filter((record) => record.listId === listIdAsString && record.taskId === taskAppId)
      .sort((a, b) => new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime());

    const records: Record<string, TaskCalendarStatus> = {};
    for (const record of taskRecords) {
      const dateKey =
        record.periodEndDateKey ??
        getDateKeyFromTimestamp(record.periodEndAt, {
          timeZone: "Europe/Oslo",
        });

      if (!dateKey) {
        continue;
      }

      records[dateKey] = record.status;
    }

    return {
      taskId: taskAppId,
      taskTitle: task.title,
      records,
    };
  });
}

export default function TaskListHistory({ listId }: Props) {
  const cachedBundle = getCachedTaskStorageBundle();
  const hasCachedBundle = Boolean(cachedBundle);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<DateKey>(() =>
    getStartOfMonthDateKey(getTodayDateKey("Europe/Oslo"))
  );
  const [taskHistories, setTaskHistories] = useState<TaskHistoryView[]>(
    cachedBundle ? buildTaskHistories(listId, cachedBundle) : []
  );
  const [loading, setLoading] = useState(!hasCachedBundle);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const shouldRefresh =
      !hasCachedBundle || isCachedValueStale(TASK_HISTORY_CACHE_KEY, TASK_HISTORY_STALE_AFTER_MS);

    const load = async () => {
      if (!shouldRefresh) {
        setLoading(false);
        return;
      }

      try {
        setLoading(!hasCachedBundle);
        setError(null);
        const bundle = await runBackgroundSync(
          async () => {
            await ensureLegacyBusinessDataMigrated();
            return fetchTaskStorageBundle();
          },
          {
            errorMessage: "Could not refresh task history. Showing the last saved data.",
          }
        );

        if (!isMounted) {
          return;
        }

        setTaskHistories(buildTaskHistories(listId, bundle));
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load task history.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [hasCachedBundle, listId]);

  const sortedTaskHistories = useMemo(() => taskHistories, [taskHistories]);

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  if (sortedTaskHistories.length === 0 && !loading) {
    return (
      <HistoryEmptyState
        title="No history recorded yet."
        description="Complete tasks to start building archived task history."
      />
    );
  }

  return (
    <div className="space-y-6">
      {loading && (
        <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
            <span>Loading the latest task history in the background...</span>
          </CardContent>
        </Card>
      )}
      {sortedTaskHistories.map((taskHistory) => (
        <motion.div
          key={taskHistory.taskId}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="cursor-pointer"
          onClick={() =>
            setExpandedTask(
              expandedTask === taskHistory.taskId ? null : taskHistory.taskId
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
                  <h3 className="text-2xl font-semibold">{taskHistory.taskTitle}</h3>
                </div>
                <Badge className="rounded-full bg-accent-gold-muted px-3 py-1 text-accent-gold">
                  {Object.keys(taskHistory.records).length} records
                </Badge>
              </motion.div>

              {expandedTask === taskHistory.taskId && (
                <div className="mt-6 border-t pt-6" onClick={(event) => event.stopPropagation()}>
                  <TaskStatusCalendar
                    monthKey={selectedMonthKey}
                    onMonthKeyChange={setSelectedMonthKey}
                    statusByDateKey={taskHistory.records}
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

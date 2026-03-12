"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  ROUTINE_TASK_HISTORY_KEY,
  ROUTINE_TASKS_KEY,
} from "@/src/lib/scheduling/browser-reset-store";
import {
  RoutineTask,
  RoutineTaskHistory,
} from "@/src/lib/scheduling/reset-types";

type CalendarStatus = "complete" | "incomplete";

type TaskHistoryView = {
  taskId: string;
  taskTitle: string;
  records: Record<string, CalendarStatus>;
};

interface Props {
  listId: number;
  listTitle: string;
  onBack?: () => void;
}

export default function TaskListHistory({ listId, listTitle }: Props) {
  const [taskHistories, setTaskHistories] = useState<TaskHistoryView[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const listIdAsString = String(listId);

  // Live state is stored separately from immutable archived history.
  // History is written only by the reset engine at period boundary time.
  useEffect(() => {
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

    const views: TaskHistoryView[] = tasksForList.map((task) => {
      const taskRecords = allHistory
        .filter(
          (record) =>
            record.listId === listIdAsString && record.taskId === task.id
        )
        .sort(
          (a, b) =>
            new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime()
        );

      const records: Record<string, CalendarStatus> = {};
      for (const record of taskRecords) {
        const dateKey = record.periodEndAt.split("T")[0];
        records[dateKey] = record.status;
      }

      return {
        taskId: task.id,
        taskTitle: task.title,
        records,
      };
    });

    setTaskHistories(views);
  }, [listIdAsString]);

  const getDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getRecordForDate = (
    taskId: string,
    date: string
  ): CalendarStatus | undefined => {
    const history = taskHistories.find((h) => h.taskId === taskId);
    return history?.records[date];
  };

  // calendar helpers
  const monthStart = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  );
  const monthEnd = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0
  );
  const daysInMonth = monthEnd.getDate();
  const startingDayOfWeek = monthStart.getDay(); // 0 = Sunday

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const calendarWeeks: (number | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    calendarWeeks.push(days.slice(i, i + 7));
  }

  const goToPreviousMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
    );
  };

  const monthName = selectedDate.toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-8 text-4xl font-bold">{listTitle} History</h1>

      {(() => {
        const filtered = taskHistories;
        if (filtered.length === 0) {
          return (
            <p className="text-xl text-slate-600">
              No history recorded yet. Complete tasks to start building history.
            </p>
          );
        }
        return (
          <div className="space-y-6">
            {filtered.map((taskHist) => (
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
                    <motion.div layout className="flex w-full items-center justify-between text-left">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-6 w-6 text-slate-600" />
                        <h3 className="text-2xl font-semibold">
                          {taskHist.taskTitle}
                        </h3>
                      </div>
                      <Badge className="rounded-full bg-accent-gold-muted px-3 py-1 text-accent-gold">
                        {Object.keys(taskHist.records).length} records
                      </Badge>
                    </motion.div>

                    {expandedTask === taskHist.taskId && (
                      <div className="mt-6 border-t pt-6" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6 flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousMonth}
                            className="rounded-lg"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <h4 className="min-w-40 text-center text-lg font-semibold capitalize">
                            {monthName}
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextMonth}
                            className="rounded-lg"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>

                        <div className="mb-3 grid grid-cols-7 gap-2 text-center">
                          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => (
                            <div key={day} className="font-medium text-slate-600">
                              {day}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {calendarWeeks.map((week, wi) => (
                            <div key={wi} className="grid grid-cols-7 gap-2">
                              {week.map((day, di) => {
                                if (day === null) {
                                  return <div key={di} className="h-12" />;
                                }
                                const date = new Date(
                                  selectedDate.getFullYear(),
                                  selectedDate.getMonth(),
                                  day
                                );
                                const dateKey = getDateKey(date);
                                const record = getRecordForDate(taskHist.taskId, dateKey);
                                const isComplete = record === "complete";
                                const isIncomplete = record === "incomplete";
                                return (
                                  <motion.div
                                    key={di}
                                    whileHover={{ scale: 1.1 }}
                                    className={`flex h-12 items-center justify-center rounded-lg border-2 text-sm font-medium transition ${
                                      isComplete
                                        ? "border-green-400 bg-green-50 text-green-700"
                                        : isIncomplete
                                        ? "border-black bg-black text-white"
                                        : "border-slate-200 bg-white text-slate-700"
                                    }`}
                                  >
                                    {day}
                                  </motion.div>
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex items-center gap-6 border-t pt-4">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded bg-green-50 ring-2 ring-green-400" />
                            <span className="text-sm text-slate-600">Complete</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded bg-black ring-2 ring-black" />
                            <span className="text-sm text-slate-600">Incomplete</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded bg-white ring-2 ring-slate-200" />
                            <span className="text-sm text-slate-600">No Record</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        );
      })()}    </div>
  );
}

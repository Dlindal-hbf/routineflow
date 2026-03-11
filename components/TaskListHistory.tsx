"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// storage format, similar to old Stenger history but includes listId

type TaskRecord = {
  date: string; // YYYY-MM-DD
  status: "Complete" | "Incomplete";
  completedAt?: string;
};

type TaskHistory = {
  listId: number;
  taskId: number;
  taskTitle: string;
  records: TaskRecord[];
};

interface Props {
  listId: number;
  listTitle: string;
  onBack?: () => void;
}

const HISTORY_STORAGE_KEY = "taskListHistory.v1";

export default function TaskListHistory({ listId, listTitle, onBack }: Props) {
  const [taskHistories, setTaskHistories] = useState<TaskHistory[]>([]);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // load history and ensure every defined task in the appropriate list has an entry
  useEffect(() => {
    let histories: TaskHistory[] = [];
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      try {
        histories = JSON.parse(stored) as TaskHistory[];
      } catch {
        // ignore
      }
    }

    // make sure tasks that exist in the list data are represented
    const listsStored = localStorage.getItem("taskLists");
    if (listsStored) {
      try {
        const lists: any[] = JSON.parse(listsStored);
        const list = lists.find((l) => l.id === listId);
        const todayKey = new Date().toISOString().split("T")[0];
        if (list) {
          list.tasks.forEach((t) => {
            let existing = histories.find(
              (h) => h.listId === listId && h.taskId === t.id
            );
            if (existing) {
              if (existing.taskTitle !== t.title) {
                existing.taskTitle = t.title;
              }
            } else {
              existing = {
                listId,
                taskId: t.id,
                taskTitle: t.title,
                records: [],
              };
              histories.push(existing);
            }

            // ensure a record exists for today matching current completion state
            const rec = existing.records.find((r) => r.date === todayKey);
            // we don't know current completion here - skip
          });
        }
      } catch {
        // ignore parse errors
      }
    }

    setTaskHistories(histories);
  }, [listId]);

  // save whenever histories updated
  useEffect(() => {
    if (taskHistories.length > 0) {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(taskHistories));
    }
  }, [taskHistories]);

  const getDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getRecordForDate = (
    taskId: number,
    date: string
  ): TaskRecord | undefined => {
    const history = taskHistories.find(
      (h) => h.listId === listId && h.taskId === taskId
    );
    return history?.records.find((r) => r.date === date);
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
        const filtered = taskHistories.filter((h) => h.listId === listId);
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
                      <Badge className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                        {taskHist.records.length} records
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
                                const isComplete = record?.status === "Complete";
                                const isIncomplete = record?.status === "Incomplete";
                                return (
                                  <motion.div
                                    key={di}
                                    whileHover={{ scale: 1.1 }}
                                    className={`flex h-12 items-center justify-center rounded-lg border-2 text-sm font-medium transition ${
                                      isComplete
                                        ? "border-green-400 bg-green-50 text-green-700"
                                        : isIncomplete
                                        ? "border-red-400 bg-red-50 text-red-700"
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
                            <div className="h-4 w-4 rounded bg-red-50 ring-2 ring-red-400" />
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

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Package,
  Slice,
  Pizza,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  PenLine,
} from "lucide-react";
import ListCard from "@/components/ListCard";
import TaskCard from "@/components/TaskCard";
import PageHeader from "@/components/ui/PageHeader";
import { Textarea } from "@/components/ui/textarea";

import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InventoryLog from "@/components/InventoryLog";
import OstInventoryLog from "@/components/OstInventoryLog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskListHistory from "@/components/TaskListHistory"; // generic history viewer for any list

type View =
  | "overview"
  | "routine-detail"
  | "work-log"
  | "workers"
  | "history"
  | "list-detail"            // viewing a generic task list (formerly daily-tasks)
  | "list-history"           // history for the currently selected task list
  | "inventory"
  | "inventory-archive"
  | "inventory-snapshot";

type Frequency = "Daily" | "Weekly" | "Bi-weekly" | "Monthly";
type LogType = "Deviation" | "Batch Tracing" | "Compensation" | "Other";

// individual history record for a task

type TaskRecord = {
  date: string;
  status: "Complete" | "Incomplete";
  completedAt?: string;
};

// history of a single task inside a particular list

type TaskListHistory = {
  listId: number;
  taskId: number;
  taskTitle: string;
  records: TaskRecord[];
};

// basic task used for routines and lists

type Task = {
  id: number;
  title: string;
  description: string;
  frequency?: Frequency; // only used by routines
  completed: boolean;
};

// a collection of tasks that behaves like "Stengerutiner"

type TaskList = {
  id: number;
  title: string;
  color?: string;           // border or accent color
  autoReset?: boolean;      // if true the list will auto–clear completed tasks daily
  tasks: Task[];
};

// routines (unchanged)

type Routine = {
  id: number;
  title: string;
  emoji: string;
  tag: string;
  color: string;
  progressColor: string;
  tasks: Task[];
};

type Routine = {
  id: number;
  title: string;
  emoji: string;
  tag: string;
  color: string;
  progressColor: string;
  tasks: Task[];
};

// snapshot metadata used by archive list
interface SnapshotMeta {
  id: string;
  name: string;
  createdAt: string;
}

// component to render archive list inside main page
function ArchiveList({
  storageKey,
  onView,
}: {
  storageKey: string;
  onView: (id: string) => void;
}) {
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSnaps(parsed as SnapshotMeta[]);
        }
      } catch {}
    }
  }, [storageKey]);

  // reflect changes made in other tabs/windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue != null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setSnaps(parsed as SnapshotMeta[]);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  const deleteSnapshot = (id: string) => {
    if (!window.confirm("Delete this snapshot?")) return;
    const updated = snaps.filter((s) => s.id !== id);
    setSnaps(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  if (snaps.length === 0) {
    return <p className="text-xl text-slate-600">No snapshots saved yet.</p>;
  }

  return (
    <div className="space-y-4">
      {snaps.map((snap) => (
        <Card
          key={snap.id}
          className="rounded-3xl border border-slate-200 bg-white"
        >
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{snap.name}</div>
              <div className="text-sm text-slate-500">
                {new Date(snap.createdAt).toLocaleString("no-NO")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onView(snap.id)}
                size="sm"
              >
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600"
                onClick={() => deleteSnapshot(snap.id)}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type WorkLogEntry = {
  id: number;
  type: LogType;
  title: string;
  date: string;
  author: string;
  details: string;
  pills?: string[];
  // compensation-specific fields (only for type === "Compensation")
  compensation?: {
    reason: string;
    compensation: string;
    signature: string;
  };
};

const initialRoutines: Routine[] = [
  {
    id: 1,
    title: "Prepp",
    emoji: "🥗",
    tag: "prepping",
    color: "border-t-emerald-500",
    progressColor: "bg-emerald-500",
    tasks: [
      {
        id: 101,
        title: "Kutt opp grønnsaker",
        description: "Forbered dagens grønnsaker og merk beholdere riktig.",
        frequency: "Daily",
        completed: false,
      },
      {
        id: 102,
        title: "Fyll opp saus-stasjon",
        description: "Kontroller beholdning og fyll opp før rush.",
        frequency: "Daily",
        completed: false,
      },
      {
        id: 103,
        title: "Sjekk datoer",
        description: "Kontroller holdbarhet og fjern varer som må kastes.",
        frequency: "Weekly",
        completed: false,
      },
      {
        id: 104,
        title: "Rengjør prep-benk",
        description: "Vask og desinfiser alle flater etter avsluttet prep.",
        frequency: "Daily",
        completed: false,
      },
      {
        id: 105,
        title: "Temperaturkontroll",
        description: "Loggfør temperatur i kjøl og frys.",
        frequency: "Weekly",
        completed: false,
      },
    ],
  },
  {
    id: 2,
    title: "Ukentlige oppgaver",
    emoji: "🧹",
    tag: "cleaning",
    color: "border-t-blue-500",
    progressColor: "bg-blue-500",
    tasks: [
      {
        id: 201,
        title: "Vask garderobe og toalett",
        description:
          "Rydd bort rot og vask gulv, vask og toalett. Kast søppel og fyll på med papir og såpe om nødvendig.",
        frequency: "Weekly",
        completed: false,
      },
      {
        id: 202,
        title: "Vask hyller og skuffer i lokalet",
        description: "Ta ut alt utstyr og bakker og vask over med klut.",
        frequency: "Weekly",
        completed: false,
      },
      {
        id: 203,
        title: "Vask gulv under benker og på kjøl",
        description: "Ta bort alt som er i veien og mopp over med såpevann.",
        frequency: "Weekly",
        completed: false,
      },
      {
        id: 204,
        title: "Rengjør ventilasjon og lister",
        description: "Tørk støv og fett på utsatte flater.",
        frequency: "Monthly",
        completed: false,
      },
    ],
  },
];

const initialWorkLog: WorkLogEntry[] = [
  // no initial entries
];

const workers = [
  { name: "Dennis", role: "Manager" },
  { name: "Emma", role: "Supervisor" },
  { name: "Noah", role: "Kitchen" },
  { name: "Sofia", role: "Cleaning" },
];

// utility for combining Tailwind classes
import { cn } from "@/lib/utils";


export default function WorkplaceRoutinesDemoStyle() {
  const [view, setView] = useState<View>("overview");
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [inventorySubView, setInventorySubView] = useState<"main" | "bunner" | "ost">("main");
  const [inventoryArchiveType, setInventoryArchiveType] = useState<"bunner" | "ost">("bunner");

  // work log state (persisted)
  const [workLog, setWorkLog] = useState<WorkLogEntry[]>(() => {
    if (typeof window === "undefined") {
      return initialWorkLog;
    }
    const stored = localStorage.getItem("workLog.v1");
    if (stored) {
      try {
        return JSON.parse(stored) as WorkLogEntry[];
      } catch {}
    }
    return initialWorkLog;
  });

  // compensation dialog state
  const [isCompDialogOpen, setIsCompDialogOpen] = useState(false);
  const [compReason, setCompReason] = useState("");
  const [compCompensation, setCompCompensation] = useState("");
  const [compSignature, setCompSignature] = useState("");
  const [editingCompId, setEditingCompId] = useState<number | null>(null);

  // when entering inventory view, start at main selection
  useEffect(() => {
    if (view === "inventory") {
      setInventorySubView("main");
    }
  }, [view]);

  // simple auth prototype (no backend)
  type User = { role: "admin" | "staff"; code: string };
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const login = (code: string) => {
    // hardcoded mapping
    let role: "admin" | "staff" | null = null;
    if (code === "admin123") role = "admin";
    else if (code === "staff123") role = "staff";
    if (role) {
      const u = { role, code };
      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
      setView("overview");
    } else {
      alert("Invalid code");
    }
  };

  const [loginCode, setLoginCode] = useState("");

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const requireAdmin = () => {
    if (user?.role !== "admin") {
      alert("Admin access required");
      return false;
    }
    return true;
  };
  const [routines] = useState<Routine[]>(initialRoutines);
  const [selectedRoutineId, setSelectedRoutineId] = useState<number>(2);
  const [routineSearch, setRoutineSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<"All" | Frequency>("All");
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<LogType | "All">("Batch Tracing");

  // tasks for the currently open routine-detail view (persisted per routine)
  const [routineTasks, setRoutineTasks] = useState<Task[]>([]);

  // load persisted tasks when selectedRoutineId changes or when entering detail view
  useEffect(() => {
    if (view === "routine-detail") {
      const stored = localStorage.getItem(`routine-${selectedRoutineId}.v1`);
      if (stored) {
        try {
          setRoutineTasks(JSON.parse(stored));
        } catch {
          setRoutineTasks(
            routines.find((r) => r.id === selectedRoutineId)?.tasks || []
          );
        }
      } else {
        setRoutineTasks(
          routines.find((r) => r.id === selectedRoutineId)?.tasks || []
        );
      }
    }
  }, [view, selectedRoutineId, routines]);

  // persist routineTasks whenever they change
  useEffect(() => {
    if (view === "routine-detail") {
      try {
        localStorage.setItem(
          `routine-${selectedRoutineId}.v1`,
          JSON.stringify(routineTasks)
        );
      } catch {}
    }
  }, [routineTasks, selectedRoutineId, view]);

  // persist workLog
  useEffect(() => {
    try {
      localStorage.setItem("workLog.v1", JSON.stringify(workLog));
    } catch {}
  }, [workLog]);

  // sync workLog across tabs/windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "workLog.v1" && e.newValue != null) {
        try {
          setWorkLog(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // state for Avvik dialog
  const [isAvvikDialogOpen, setIsAvvikDialogOpen] = useState(false);
  const [avvikType, setAvvikType] = useState("feillaget");
  const [productType, setProductType] = useState("stor");
  const [employee, setEmployee] = useState("");

  // history state for automated logging
  const [history, setHistory] = useState<{date: string, description: string, category: string, routine?: string}[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("history");
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("history", JSON.stringify(history));
  }, [history]);

  // selected date for history/calendar filtering
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // task lists state (each behaves like the original "Stengerutiner" list)
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  // load lists from localStorage or initialize with one default list
  useEffect(() => {
    const stored = localStorage.getItem("taskLists");
    if (stored) {
      try {
        setTaskLists(JSON.parse(stored));
      } catch {
        setTaskLists([]);
      }
    } else {
      setTaskLists([
        {
          id: 1,
          title: "Stengerutiner",
          color: "border-t-orange-500",
          autoReset: true,
          tasks: [
            { id: 1, title: "Tøm søppel", description: "Tøm alle beholdere og sett inn ny pose.", completed: false },
            { id: 2, title: "Vask gulv", description: "Fei og mopp alle gulv før stenging.", completed: false },
            { id: 3, title: "Lås bakdør og sjekk alarm", description: "Bekreft at alarm er satt og alle dører er låst.", completed: false },
            { id: 4, title: "Rengjør maskiner", description: "Vask utsatte kontaktflater og maskinutstyr.", completed: false },
          ],
        },
        {
          id: 2,
          title: "Ukentlige oppgaver",
          color: "border-t-blue-500",
          autoReset: false,
          tasks: [],
        },
        {
          id: 3,
          title: "Prepp",
          color: "border-t-green-500",
          autoReset: false,
          tasks: [],
        },
      ]);
    }
  }, []);

  // persist lists
  useEffect(() => {
    localStorage.setItem("taskLists", JSON.stringify(taskLists));
  }, [taskLists]);

  // Daily reset for any lists that have autoReset enabled, plus automatic history save
  useEffect(() => {
    const checkReset = () => {
      const now = new Date();
      const currentDay = now.toISOString().split("T")[0];
      const lastResetDay = localStorage.getItem("lastDailyResetDay");

      if (currentDay !== lastResetDay) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split("T")[0];

        // load global history for lists
        const stored = localStorage.getItem("taskListHistory.v1");
        let histories: TaskListHistory[] = [];
        if (stored) {
          try {
            histories = JSON.parse(stored);
          } catch {}
        }

        // iterate over lists that require resetting
        taskLists.forEach((list) => {
          if (!list.autoReset) return;
          list.tasks.forEach((task) => {
            let taskHist = histories.find((h) => h.listId === list.id && h.taskId === task.id);
            if (!taskHist) {
              taskHist = {
                listId: list.id,
                taskId: task.id,
                taskTitle: task.title,
                records: [],
              };
              histories.push(taskHist);
            }

            const existingRecord = taskHist.records.find((r) => r.date === yesterdayKey);
            if (!existingRecord) {
              taskHist.records.push({ date: yesterdayKey, status: "Incomplete" });
            }
          });
        });

        localStorage.setItem("taskListHistory.v1", JSON.stringify(histories));

        // clear completed flags for autoReset lists
        setTaskLists((prev) =>
          prev.map((list) => {
            if (!list.autoReset) return list;
            return {
              ...list,
              tasks: list.tasks.map((t) => ({ ...t, completed: false })),
            };
          })
        );

        // remove matching history entries from global history log
        const completedTasks: Task[] = [];
        taskLists.forEach((list) => {
          if (!list.autoReset) return;
          completedTasks.push(...list.tasks.filter((t) => t.completed));
        });
        setHistory((prev) =>
          prev.filter(
            (item) =>
              !(
                item.category === "Daily Task" &&
                completedTasks.some((task) => item.description === `Completed daily task: ${task.title}`)
              )
          )
        );

        localStorage.setItem("lastDailyResetDay", currentDay);
      }
    };

    checkReset();
    const interval = setInterval(checkReset, 60 * 1000);
    return () => clearInterval(interval);
  }, [taskLists, history]);


  const selectedRoutine =
    routines.find((routine) => routine.id === selectedRoutineId) ?? routines[0];

  const filteredRoutines = useMemo(() => {
    return routines.filter((routine) =>
      routine.title.toLowerCase().includes(routineSearch.toLowerCase())
    );
  }, [routineSearch, routines]);

  const filteredTasks = useMemo(() => {
    if (!selectedRoutine) return [];
    return routineTasks.filter((task) => {
      if (taskFilter === "All") return true;
      return task.frequency === taskFilter;
    });
  }, [selectedRoutine, taskFilter, routineTasks]);

  const filteredLogs = useMemo(() => {
    return workLog.filter((entry) => {
      const searchMatch =
        entry.title.toLowerCase().includes(logSearch.toLowerCase()) ||
        entry.author.toLowerCase().includes(logSearch.toLowerCase());

      const typeMatch = logTypeFilter === "All" ? true : entry.type === logTypeFilter;
      return searchMatch && typeMatch;
    });
  }, [workLog, logSearch, logTypeFilter]);

  const findList = (listId: number) => taskLists.find((l) => l.id === listId);

  const selectedList = selectedListId != null ? findList(selectedListId) : null;

  const sortedCurrentListTasks = useMemo(() => {
    if (!selectedList) return [];
    return [...selectedList.tasks].sort((a, b) => {
      if (a.title < b.title) return -1;
      if (a.title > b.title) return 1;
      if (a.description < b.description) return -1;
      if (a.description > b.description) return 1;
      return 0;
    });
  }, [selectedList]);

  const openRoutine = (id: number) => {
    setSelectedRoutineId(id);
    setView("routine-detail");
  };

  // helpers for log manipulation
  const nextLogId = () => Math.max(0, ...workLog.map((e) => e.id)) + 1;

  const addLogEntry = (defaultType?: LogType) => {
    if (!requireAdmin()) return;
    if (defaultType === "Deviation") {
      setIsAvvikDialogOpen(true);
    } else if (defaultType === "Compensation") {
      // open the compensation dialog with blank fields
      setCompReason("");
      setCompCompensation("");
      setCompSignature("");
      setEditingCompId(null);
      setIsCompDialogOpen(true);
    } else {
      // General flow
      const title = window.prompt("Title", "");
      if (!title) return;
      const details = window.prompt("Details", "") || "";
      const type = (window.prompt(
        "Type (LOT-sporing / Avvik / Kompensasjoner / Other)",
        defaultType || "Batch Tracing"
      ) as LogType) || defaultType || "Batch Tracing";
      const author = window.prompt("Author", "") || "";
      const date = new Date().toISOString();
      const pillsInput = window.prompt("Pills (comma-separated)", "") || "";
      const pills = pillsInput ? pillsInput.split(",").map((s) => s.trim()) : [];

      setWorkLog((cur) => [
        ...cur,
        { id: nextLogId(), title, details, type, author, date, pills },
      ]);
      setHistory(prev => [{date, description: `Added a new ${type} entry: ${title}`, category: "Work Log"}, ...prev]);
    }
  };

  const editLogEntry = (entry: WorkLogEntry) => {
    if (!requireAdmin()) return;
    if (entry.type === "Compensation") {
      // open compensation dialog pre-filled
      setEditingCompId(entry.id);
      setCompReason(entry.compensation?.reason || "");
      setCompCompensation(entry.compensation?.compensation || "");
      setCompSignature(entry.compensation?.signature || entry.author || "");
      setIsCompDialogOpen(true);
    } else {
      const title = window.prompt("Title", entry.title) || entry.title;
      const details = window.prompt("Details", entry.details) || entry.details;
      const type =
        (window.prompt(
          "Type (LOT-sporing / Avvik / Kompensasjoner / Other)",
          entry.type
        ) as LogType) || entry.type;
      const author = window.prompt("Author", entry.author) || entry.author;
      const pillsInput =
        window.prompt("Pills (comma-separated)", entry.pills?.join(",") || "") ||
        "";
      const pills = pillsInput ? pillsInput.split(",").map((s) => s.trim()) : [];

      setWorkLog((cur) =>
        cur.map((e) =>
          e.id === entry.id ? { ...e, title, details, type, author, pills } : e
        )
      );
      setHistory(prev => [{date: new Date().toISOString(), description: `Edited ${entry.type} entry: ${entry.title}`, category: "Work Log"}, ...prev]);
    }
  };

  const deleteLogEntry = (id: number) => {
    if (!requireAdmin()) return;
    const entry = workLog.find(e => e.id === id);
    if (window.confirm("Delete this entry?")) {
      setWorkLog((cur) => cur.filter((e) => e.id !== id));
      if (entry) {
        setHistory(prev => [{date: new Date().toISOString(), description: `Deleted ${entry.type} entry: ${entry.title}`, category: "Work Log"}, ...prev]);
      }
    }
  };

  const submitAvvikEntry = () => {
    if (!employee.trim()) return;
    const date = new Date().toISOString();
    const title = `Avvik: ${avvikType} - ${productType}`;
    const details = `Employee: ${employee}`;

    setWorkLog((cur) => [
      ...cur,
      { id: nextLogId(), title, details, type: "Deviation", author: employee, date, pills: [] },
    ]);
    setHistory(prev => [{date, description: `Added a new Avvik entry: ${title}`, category: "Work Log"}, ...prev]);
    setIsAvvikDialogOpen(false);
    setEmployee(""); // reset
  };

  const submitCompEntry = () => {
    if (!compReason.trim()) return;
    const date = new Date().toISOString();
    const entry: WorkLogEntry = {
      id: editingCompId != null ? editingCompId : nextLogId(),
      type: "Compensation",
      title: compReason,
      date: editingCompId != null ? workLog.find((e) => e.id === editingCompId)?.date || date : date,
      author: compSignature,
      details: "",
      compensation: {
        reason: compReason,
        compensation: compCompensation,
        signature: compSignature,
      },
    };

    if (editingCompId != null) {
      setWorkLog((cur) =>
        cur.map((e) => (e.id === editingCompId ? entry : e))
      );
      setHistory((prev) => [
        {
          date,
          description: `Edited Compensation entry: ${entry.title}`,
          category: "Work Log",
        },
        ...prev,
      ]);
    } else {
      setWorkLog((cur) => [...cur, entry]);
      setHistory((prev) => [
        {
          date,
          description: `Added a new Compensation entry: ${entry.title}`,
          category: "Work Log",
        },
        ...prev,
      ]);
    }

    setIsCompDialogOpen(false);
    setCompReason("");
    setCompCompensation("");
    setCompSignature("");
    setEditingCompId(null);
  };

  const toggleTask = (taskId: number) => {
    if (!requireAdmin()) return;
    const routine = routines.find((r) => r.id === selectedRoutineId);
    const task = routineTasks.find((t) => t.id === taskId);
    if (!task || !routine) return;

    const newCompleted = !task.completed;
    setRoutineTasks((cur) =>
      cur.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t))
    );

    if (newCompleted) {
      setHistory((prev) => [
        {
          date: new Date().toISOString(),
          description: `Completed task: ${task.title}`,
          category: "Task",
          routine: routine.title,
        },
        ...prev,
      ]);
    } else {
      setHistory((prev) =>
        prev.filter(
          (item) =>
            !(item.description === `Completed task: ${task.title}` &&
              item.category === "Task" &&
              item.routine === routine.title)
        )
      );
    }
  };

  // helpers to manipulate tasks inside a specific list

  const toggleTaskInList = (listId: number, taskId: number) => {
    const list = findList(listId);
    if (!list) return;
    const task = list.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;

    setTaskLists((current) =>
      current.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          tasks: l.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: newCompleted } : t
          ),
        } as TaskList;
      })
    );

    // record in the per-list history store
    const todayKey = new Date().toISOString().split("T")[0];
    const stored = localStorage.getItem("taskListHistory.v1");
    let histories: TaskListHistory[] = [];
    if (stored) {
      try {
        histories = JSON.parse(stored);
      } catch {}
    }

    let taskHist = histories.find((h) => h.listId === listId && h.taskId === taskId);
    if (!taskHist) {
      taskHist = { listId, taskId, taskTitle: task.title, records: [] };
      histories.push(taskHist);
    }

    const existingRecord = taskHist.records.find((r) => r.date === todayKey);
    if (existingRecord) {
      existingRecord.status = newCompleted ? "Complete" : "Incomplete";
      if (newCompleted) {
        existingRecord.completedAt = new Date().toISOString();
      } else {
        delete existingRecord.completedAt;
      }
    } else {
      const newRec: TaskRecord = { date: todayKey, status: newCompleted ? "Complete" : "Incomplete" };
      if (newCompleted) {
        newRec.completedAt = new Date().toISOString();
      }
      taskHist.records.push(newRec);
    }

    localStorage.setItem("taskListHistory.v1", JSON.stringify(histories));

    // update global history log
    if (newCompleted) {
      setHistory((prev) => [
        {
          date: new Date().toISOString(),
          description: `Completed task: ${task.title}`,
          category: "Daily Task",
          routine: list.title,
        },
        ...prev,
      ]);
    } else {
      setHistory((prev) =>
        prev.filter(
          (item) =>
            !(item.description === `Completed task: ${task.title}` &&
              item.category === "Daily Task" &&
              item.routine === list.title)
        )
      );
    }
  };

  const addTaskToList = (listId: number) => {
    if (!requireAdmin()) return;
    const list = findList(listId);
    if (!list) return;
    const title = window.prompt("Title", "");
    if (!title) return;
    const description = window.prompt("Description", "") || "";
    const nextId = Math.max(0, ...list.tasks.map((t) => t.id)) + 1;
    const newTask = { id: nextId, title, description, completed: false };
    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, tasks: [...l.tasks, newTask] }
          : l
      )
    );

    // also ensure history entry exists for the new task
    const stored = localStorage.getItem("taskListHistory.v1");
    let histories: TaskListHistory[] = [];
    if (stored) {
      try {
        histories = JSON.parse(stored);
      } catch {}
    }
    const taskHist = histories.find(
      (h) => h.listId === listId && h.taskId === nextId
    );
    if (!taskHist) {
      histories.push({
        listId,
        taskId: nextId,
        taskTitle: title,
        records: [],
      });
      localStorage.setItem("taskListHistory.v1", JSON.stringify(histories));
    }
  };

  const editTaskInList = (listId: number, task: Task) => {
    if (!requireAdmin()) return;
    const title = window.prompt("Title", task.title) || task.title;
    const description = window.prompt("Description", task.description) || task.description;
    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              tasks: l.tasks.map((t) => (t.id === task.id ? { ...t, title, description } : t)),
            }
          : l
      )
    );
    // update title in history as well
    const stored = localStorage.getItem("taskListHistory.v1");
    if (stored) {
      try {
        const histories: TaskListHistory[] = JSON.parse(stored);
        const taskHist = histories.find(
          (h) => h.listId === listId && h.taskId === task.id
        );
        if (taskHist && taskHist.taskTitle !== title) {
          taskHist.taskTitle = title;
          localStorage.setItem("taskListHistory.v1", JSON.stringify(histories));
        }
      } catch {}
    }
  };

  // perform actual deletion (called after modal confirmation)
  const deleteTaskFromList = (
    listId: number,
    taskId: number,
    removeHistory: boolean
  ) => {
    const list = findList(listId);
    if (!list) return;
    const task = list.tasks.find((t) => t.id === taskId);

    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, tasks: l.tasks.filter((t) => t.id !== taskId) }
          : l
      )
    );

    if (task) {
      setHistory((prev) => [
        {
          date: new Date().toISOString(),
          description: `Deleted task: ${task.title}`,
          category: "Daily Task",
          routine: list.title,
        },
        ...prev,
      ]);
    }

    if (removeHistory && task) {
      const stored = localStorage.getItem("taskListHistory.v1");
      if (stored) {
        try {
          const histories: TaskListHistory[] = JSON.parse(stored);
          const filtered = histories.filter(
            (h) => !(h.listId === listId && h.taskId === taskId)
          );
          localStorage.setItem("taskListHistory.v1", JSON.stringify(filtered));
        } catch {}
      }
    }
  };

  // deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{
    listId: number;
    taskId: number;
    taskTitle: string;
  } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1);

  const openDeleteModal = (
    listId: number,
    taskId: number,
    taskTitle: string
  ) => {
    setDeleteInfo({ listId, taskId, taskTitle });
    setDeleteStep(1);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteChoice = (confirm: boolean) => {
    if (!deleteInfo) return;
    if (!confirm) {
      setIsDeleteModalOpen(false);
      return;
    }
    if (deleteStep === 1) {
      setDeleteStep(2);
    } else if (deleteStep === 2) {
      // advance to history question
      setDeleteStep(3);
    } else {
      // final step: perform deletion with history based on confirm flag
      deleteTaskFromList(deleteInfo.listId, deleteInfo.taskId, confirm);
      setIsDeleteModalOpen(false);
    }
  };

  const promptNewList = () => {
    if (!requireAdmin()) return;
    const name = window.prompt("Name for new list", "");
    if (!name) return;
    const resetAnswer = window.prompt(
      "Auto-reset daily? (y/N)",
      "n"
    );
    const autoReset = resetAnswer?.toLowerCase() === "y";
    const nextId = Math.max(0, ...taskLists.map((l) => l.id)) + 1;
    setTaskLists((prev) => [
      ...prev,
      { id: nextId, title: name, tasks: [], autoReset },
    ]);
  };

  const selectedCompleted = routineTasks.filter((task) => task.completed).length;
  const selectedTotal = routineTasks.length;

  const logStats = useMemo(
    () => ({
      deviations: workLog.filter((item) => item.type === "Deviation").length,
      batch: workLog.filter((item) => item.type === "Batch Tracing").length,
      compensation: workLog.filter((item) => item.type === "Compensation").length,
      other: workLog.filter((item) => item.type === "Other").length,
    }),
    [workLog]
  );

  // group history by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof history> = {};
    history.forEach(item => {
      const dateObj = new Date(item.date);
      const dateStr = dateObj.toLocaleDateString('no-NO'); // "08.03.2026"
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return groups;
  }, [history]);

  // for each date, group by category, and for Task, by routine
  const groupedHistory = useMemo(() => {
    const result: Record<string, Record<string, Record<string, typeof history>>> = {};
    Object.entries(groupedByDate).forEach(([date, items]) => {
      result[date] = {};
      items.forEach(item => {
        const cat = item.category;
        if (!result[date][cat]) result[date][cat] = {};
        const sub = item.category === "Task" ? (item.routine || "Other") : "All";
        if (!result[date][cat][sub]) result[date][cat][sub] = [];
        result[date][cat][sub].push(item);
      });
    });
    // Sort each array of history items: by date descending, then description ascending, then routine ascending
    Object.values(result).forEach(categories => {
      Object.values(categories).forEach(subs => {
        Object.values(subs).forEach(arr => {
          arr.sort((a, b) => {
            // First by date descending
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            // Then by description ascending
            if (a.description < b.description) return -1;
            if (a.description > b.description) return 1;
            // Then by category ascending
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
            // Then by routine ascending
            const routineA = a.routine || "";
            const routineB = b.routine || "";
            if (routineA < routineB) return -1;
            if (routineA > routineB) return 1;
            return 0;
          });
        });
      });
    });
    return result;
  }, [groupedByDate]);

  const parseEuropeanDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
  };

  const renderCalendar = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); // 0 = Sunday

    const days = [];
    // Empty cells for days before the first day
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    const hasHistory = (day: number | null) => {
      if (!day) return false;
      const dateStr = `${day.toString().padStart(2, '0')}.${(month + 1).toString().padStart(2, '0')}.${year}`;
      return groupedHistory[dateStr] !== undefined;
    };

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">
            {currentDate.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
          </h2>
          <Button
            onClick={() => setSelectedDate(null)}
            variant={selectedDate ? "outline" : "default"}
            className="text-lg"
          >
            Show All
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(day => (
            <div key={day} className="text-center font-semibold text-slate-600 py-2">
              {day}
            </div>
          ))}
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => {
                if (day) {
                  const date = new Date(year, month, day);
                  setSelectedDate(date);
                }
              }}
              className={cn(
                "btn-ghost h-12 w-12 text-center text-lg font-medium",
                !day && "opacity-50 cursor-default",
                hasHistory(day)
                  ? "bg-primary/20 text-primary"
                  : "text-neutral-400",
                selectedDate &&
                  day &&
                  selectedDate.getDate() === day &&
                  selectedDate.getMonth() === month &&
                  selectedDate.getFullYear() === year
                  ? "bg-primary text-white"
                  : ""
              )}
              disabled={!day}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {!user && (
        <div className="flex flex-col items-center justify-center h-full bg-slate-100 text-slate-900 px-6">
          <h1 className="text-5xl font-bold mb-4">PB INTERNE RUTINER</h1>
          <p className="text-xl text-slate-600 mb-8">
            Daglige oppgaver og rutiner for alle avdelinger
          </p>

          <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
            <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                login(loginCode);
              }}
            >
              <input
                type="text"
                placeholder="Enter code"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                className="mb-4 w-full border px-3 py-2 rounded"
              />
              <Button className="w-full" type="submit">
                Submit
              </Button>
            </form>
            <p className="text-sm text-gray-500 mt-2">use admin123 or staff123</p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-6 max-w-md text-center text-slate-500">
            <div>
              <Calendar className="mx-auto h-8 w-8 opacity-50" />
              <span className="mt-2 block">History</span>
            </div>
            <div>
              <BookOpen className="mx-auto h-8 w-8 opacity-50" />
              <span className="mt-2 block">Work Log</span>
            </div>
            <div>
              <Users className="mx-auto h-8 w-8 opacity-50" />
              <span className="mt-2 block">Workers</span>
            </div>
            <div>
              <ClipboardList className="mx-auto h-8 w-8 opacity-50" />
              <span className="mt-2 block">Routines</span>
            </div>
          </div>
        </div>
      )}
      {user && (
        <div className="absolute top-4 right-4 flex items-center gap-4">
          <span className="text-sm">{user.role.toUpperCase()}</span>
          <Button onClick={logout} size="sm" variant="outline">
            Logout
          </Button>
        </div>
      )}
      {view === "overview" && (
        <div>
          {user?.role === "staff" && (
            <div className="bg-yellow-100 text-yellow-800 py-2 text-center">
              You are signed in as <strong>staff</strong>. Editing is disabled.
            </div>
          )}
          <header className="border-b border-neutral-200 bg-white">
            <div className="mx-auto max-w-7xl px-6 py-8">
              <PageHeader
                title={
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100">
                      <ClipboardList className="h-8 w-8 text-primary" />
                    </div>
                    <span className="text-2xl font-heading font-semibold">
                      PB INTERNE RUTINER
                    </span>
                  </div>
                }
                subtitle="Daglige oppgaver og rutiner for alle avdelinger"
                actions={
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl px-6 text-2xl"
                      onClick={() => setView("history")}
                    >
                      <Calendar className="mr-3 h-6 w-6" />
                      History
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl px-6 text-2xl"
                      onClick={() => setView("work-log")}
                    >
                      <BookOpen className="mr-3 h-6 w-6" />
                      Work Log
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl px-6 text-2xl"
                      onClick={() => setView("workers")}
                    >
                      <Users className="mr-3 h-6 w-6" />
                      Workers
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl px-6 text-2xl"
                      onClick={() => setView("inventory")}
                    >
                      <Package className="mr-3 h-6 w-6" />
                      Inventory
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl px-6 text-2xl"
                      onClick={promptNewList}
                    >
                      <Plus className="mr-3 h-6 w-6" />
                      Ny liste
                    </Button>
                    <Button className="h-14 rounded-2xl bg-primary px-6 text-2xl hover:bg-primary/90">
                      <Plus className="mr-3 h-6 w-6" />
                      New Routine
                    </Button>
                  </div>
                }
              />
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-10">
            <div className="relative mb-10 max-w-3xl">
              <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <Input
                value={routineSearch}
                onChange={(e) => setRoutineSearch(e.target.value)}
                placeholder="Search routines..."
                className="h-16 rounded-2xl border-slate-200 bg-white pl-16 text-2xl"
              />
            </div>

            <motion.div 
              className="grid gap-8 lg:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
            >
              {filteredRoutines.map((routine) => {
                const completed = routine.tasks.filter((task) => task.completed).length;
                const total = routine.tasks.length;
                return (
                  <ListCard
                    key={routine.id}
                    title={routine.title}
                    emoji={routine.emoji}
                    tag={routine.tag}
                    accentClass={routine.color}
                    progress={{ completed, total }}
                    onClick={() => openRoutine(routine.id)}
                    onSettings={() => { /* future settings */ }}
                  />
                );
              })}

              {/* Task Lists Cards */}
              {taskLists.map((list) => {
                const completed = list.tasks.filter((t) => t.completed).length;
                const total = list.tasks.length;
                return (
                  <ListCard
                    key={list.id}
                    title={list.title}
                    accentClass={list.color || ""}
                    progress={{ completed, total }}
                    onClick={() => {
                      setSelectedListId(list.id);
                      setView("list-detail");
                    }}
                    onSettings={
                      user?.role === "admin"
                        ? () => {
                            /* future list settings */
                          }
                        : undefined
                    }
                  />
                );
              })}

              {/* New list card */}
              {user?.role === "admin" && (
                <ListCard
                  title="Ny liste"
                  accentClass="cursor-pointer"
                  onClick={promptNewList}
                >
                  <div className="flex flex-col items-center justify-center">
                    <Plus className="h-10 w-10 text-slate-500" />
                    <span className="mt-2 text-xl text-slate-500">Ny liste</span>
                  </div>
                </ListCard>
              )}
            </motion.div>
          </main>
        </div>
      )}

      {view === "routine-detail" && selectedRoutine && (
        <div>
          {/* always orange header to match Stengerutiner style */}
      <div className="bg-orange-500 text-white">
            <div className="mx-auto max-w-7xl px-6 py-10">
              <button
                onClick={() => setView("overview")}
                className="mb-8 flex items-center gap-3 text-lg font-medium text-white/90 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Routines
              </button>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{selectedRoutine.emoji}</div>
                  <h2 className="text-6xl font-bold tracking-tight">{selectedRoutine.title}</h2>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-3 text-5xl font-bold">
                    <CheckCircle2 className="h-9 w-9" />
                    {selectedCompleted}/{selectedTotal}
                  </div>
                  <div className="mt-2 text-2xl text-white/80">completed</div>
                </div>
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-10 inline-flex rounded-2xl bg-slate-200 p-1">
              {(["All", "Daily", "Weekly", "Bi-weekly", "Monthly"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={cn(
                    "rounded-2xl px-6 py-3 text-xl transition",
                    taskFilter === filter
                      ? "bg-white font-semibold text-slate-900 shadow-sm"
                      : "text-slate-600"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <CardContent className="flex items-start gap-5 p-6">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button
                        variant={task.completed ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTask(task.id)}
                        className="h-12 w-12 rounded-2xl"
                      >
                        <CheckCircle2 className="h-6 w-6" />
                      </Button>
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <h3
                          className={cn(
                            "text-2xl font-semibold",
                            task.completed ? "text-slate-400 line-through" : ""
                          )}
                        >
                          {task.title}
                        </h3>

                        <Badge className="rounded-full border-0 bg-blue-100 px-4 py-1 text-base text-blue-700">
                          {task.frequency}
                        </Badge>
                      </div>

                      <p className="text-xl leading-relaxed text-slate-500">{task.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>
        </div>
      )}

      {view === "list-detail" && selectedList && (
        <div>
          <div className={`${selectedList.color ? selectedList.color.replace("border-t-", "bg-") : "bg-orange-500"} text-white`}
          >
            <div className="mx-auto max-w-7xl px-6 py-10">
              <button
                onClick={() => setView("overview")}
                className="mb-8 flex items-center gap-3 text-lg font-medium text-white/90 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-5xl font-bold">{selectedList.title}</h1>
                  {selectedList.autoReset && (
                    <p className="mt-2 text-xl text-white/80">
                      Resets every day at 06:00
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setView("list-history")}
                    className="h-14 rounded-2xl bg-white/20 px-6 text-xl font-semibold text-white hover:bg-white/30"
                  >
                    <Calendar className="mr-3 h-6 w-6" />
                    View History
                  </Button>
                  {user?.role === "admin" && (
                    <Button
                      onClick={() => selectedListId && addTaskToList(selectedListId)}
                      className="h-14 rounded-2xl bg-white px-6 text-xl font-semibold text-orange-500 hover:bg-white/90"
                    >
                      <Plus className="mr-3 h-6 w-6" />
                      Add Task
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="space-y-6">
              {sortedCurrentListTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  description={task.description}
                  completed={task.completed}
                  onToggle={() => selectedListId && toggleTaskInList(selectedListId, task.id)}
                  onEdit={() => selectedListId && editTaskInList(selectedListId, task)}
                  onDelete={() => selectedListId && openDeleteModal(selectedListId, task.id, task.title)}
                />
              ))}
            </div>
          </main>
        </div>
      )}

      {view === "work-log" && (
        <div>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-5">
                <button
                  onClick={() => setView("overview")}
                  className="mt-4 flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                  <BookOpen className="h-8 w-8 text-orange-600" />
                </div>

                <div>
                  <h1 className="text-4xl font-bold tracking-tight">Work Log</h1>
                  <p className="mt-1 text-2xl text-slate-500">
                    Avvik, LOT-sporing & kompensaasjoner
                  </p>
                </div>
              </div>

              {user?.role === "admin" ? (
                <Button
                  className="h-14 rounded-2xl bg-blue-500 px-6 text-2xl hover:bg-blue-600"
                  onClick={() => addLogEntry()}
                >
                  <Plus className="mr-3 h-6 w-6" />
                  New Entry
                </Button>
              ) : (
                <Button
                  className="h-14 rounded-2xl bg-blue-300 px-6 text-2xl"
                  disabled
                >
                  <Plus className="mr-3 h-6 w-6" />
                  New Entry (admin only)
                </Button>
              )}
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_290px]">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
                <Input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search entries..."
                  className="h-16 rounded-2xl border-slate-200 bg-white pl-16 text-2xl"
                />
              </div>

              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value as LogType | "All")}
                className="h-16 rounded-2xl border border-slate-200 bg-white px-5 text-2xl outline-none"
              >
                <option value="All">All</option>
                <option value="Batch Tracing">LOT-sporing</option>
                <option value="Deviation">Avvik</option>
                <option value="Compensation">Kompensasjoner</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-3xl border border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="text-5xl font-bold text-red-500">{logStats.deviations}</div>
                  <div className="mt-2 text-xl text-slate-500">Avvik</div>
                  <div className="mt-4">
                    {user?.role === "admin" ? (
                      <Button onClick={() => addLogEntry("Deviation")} className="w-full h-10 text-lg" asChild>
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                          New Entry
                        </motion.button>
                      </Button>
                    ) : (
                      <Button className="w-full h-10 text-lg bg-gray-300" disabled>
                        Login as admin to add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-2 border-blue-500 bg-white">
                <CardContent className="p-6">
                  <div className="text-5xl font-bold text-blue-600">{logStats.batch}</div>
                  <div className="mt-2 text-xl text-slate-500">LOT-sporing</div>
                  <div className="mt-4">
                    {user?.role === "admin" ? (
                      <Button onClick={() => addLogEntry("Batch Tracing")} className="w-full h-10 text-lg" asChild>
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                          New Entry
                        </motion.button>
                      </Button>
                    ) : (
                      <Button className="w-full h-10 text-lg bg-gray-300" disabled>
                        Login as admin to add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="text-5xl font-bold text-amber-500">{logStats.compensation}</div>
                  <div className="mt-2 text-xl text-slate-500">Kompensasjoner</div>
                  <div className="mt-4">
                    {user?.role === "admin" ? (
                      <Button onClick={() => addLogEntry("Compensation")} className="w-full h-10 text-lg" asChild>
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                          New Entry
                        </motion.button>
                      </Button>
                    ) : (
                      <Button className="w-full h-10 text-lg bg-gray-300" disabled>
                        Login as admin to add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white">
                <CardContent className="p-6">
                  <div className="text-5xl font-bold text-slate-600">{logStats.other}</div>
                  <div className="mt-2 text-xl text-slate-500">Other</div>
                  <div className="mt-4">
                    {user?.role === "admin" ? (
                      <Button onClick={() => addLogEntry("Other")} className="w-full h-10 text-lg" asChild>
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                          New Entry
                        </motion.button>
                      </Button>
                    ) : (
                      <Button className="w-full h-10 text-lg bg-gray-300" disabled>
                        Login as admin to add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              {filteredLogs.map((entry) => (
                <Card
                  key={entry.id}
                  className={
                    "rounded-3xl border border-slate-200 border-l-4 bg-white " +
                    (entry.type === "Deviation"
                      ? "border-l-red-500"
                      : entry.type === "Batch Tracing"
                      ? "border-l-blue-500"
                      : entry.type === "Compensation"
                      ? "border-l-amber-500"
                      : "border-l-slate-400")
                  }
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-4">
                        <div className="pt-1 text-slate-500">
                          <Package className="h-6 w-6" />
                        </div>

                        <div className="min-w-0">
                          <div className="mb-3 flex flex-wrap items-center gap-3 text-lg text-slate-500">
                            <Badge className="rounded-full border-0 bg-blue-100 px-4 py-1 text-base text-blue-700">
                              {entry.type}
                            </Badge>
                            <span>{entry.date}</span>
                            <span>·</span>
                            <span>{entry.author}</span>
                          </div>

                          <h3 className="mb-3 text-3xl font-semibold">{entry.title}</h3>
                          {entry.type === "Compensation" && entry.compensation ? (
                            <div className="mb-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4">
                              <div>
                                <strong>Hva skjedde:</strong> {entry.compensation.reason}
                              </div>
                              <div>
                                <strong>Kompensasjon:</strong> {entry.compensation.compensation}
                              </div>
                              <div>
                                <strong>Signatur:</strong> {entry.compensation.signature}
                              </div>
                            </div>
                          ) : (
                            <p className="mb-3 text-xl text-slate-500">{entry.details}</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {entry.pills?.map((pill) => (
                              <Badge
                                key={pill}
                                variant="outline"
                                className="rounded-lg border-blue-200 bg-blue-50 px-3 py-1 text-base text-blue-700"
                              >
                                {pill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {user?.role === "admin" && (
                          <>
                            <button
                              onClick={() => editLogEntry(entry)}
                              className="text-slate-700 hover:text-slate-900"
                            >
                              <PenLine className="h-6 w-6" />
                            </button>
                            <button
                              onClick={() => deleteLogEntry(entry.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-6 w-6" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>
        </div>
      )}

      {view === "workers" && (
        <div>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setView("overview")}
                  className="flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <div>
                  <h1 className="text-4xl font-bold">Workers</h1>
                  <p className="text-2xl text-slate-500">Team overview and access</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {workers.map((worker) => (
                <Card key={worker.name} className="rounded-3xl border border-slate-200 bg-white">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                      <User className="h-7 w-7 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-semibold">{worker.name}</h3>
                    <p className="mt-1 text-xl text-slate-500">{worker.role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </main>
        </div>
      )}

      {view === "inventory" && (
        <div>
          {inventorySubView === "main" ? (
            <>
              <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center gap-5 px-6 py-8">
                  <button
                    onClick={() => setView("overview")}
                    className="flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                  </button>
                  <h1 className="text-4xl font-bold tracking-tight">Inventory</h1>
                </div>
              </header>

              <main className="mx-auto max-w-7xl px-6 py-10">
                <div className="grid gap-8 lg:grid-cols-2">
                  <Card
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm cursor-pointer"
                    onClick={() => setInventorySubView("bunner")}
                  >
                    <CardContent className="p-8 text-center">
                      <Slice className="mx-auto h-12 w-12 text-green-600" />
                      <h2 className="mt-4 text-3xl font-semibold">Bunner</h2>
                    </CardContent>
                  </Card>
                  <Card
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm cursor-pointer"
                    onClick={() => setInventorySubView("ost")}
                  >
                    <CardContent className="p-8 text-center">
                      <Pizza className="mx-auto h-12 w-12 text-orange-600" />
                      <h2 className="mt-4 text-3xl font-semibold">Ost</h2>
                    </CardContent>
                  </Card>
                </div>
              </main>
            </>
          ) : (
            <>
              <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-5">
                    <button
                      onClick={() => {
                        setInventorySubView("main");
                        setView("inventory");
                      }}
                      className="mt-4 flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      Back
                    </button>

                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                      <Package className="h-8 w-8 text-green-600" />
                    </div>

                    <div>
                      <h1 className="text-4xl font-bold tracking-tight">
                        {inventorySubView === "bunner" ? "Bunner Inventory" : "Ost Inventory"}
                      </h1>
                      <p className="mt-1 text-2xl text-slate-500">
                        {inventorySubView === "bunner"
                          ? "Daily product amounts by size and status"
                          : "Daily cheese inventory with signed logging"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setInventoryArchiveType(inventorySubView === "ost" ? "ost" : "bunner");
                        setView("inventory-archive");
                      }}
                    >
                      Storage area
                    </Button>
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-7xl px-6 py-10">
                {inventorySubView === "bunner" ? (
                  <InventoryLog
                    onOpenArchive={() => {
                      setInventoryArchiveType("bunner");
                      setView("inventory-archive");
                    }}
                    currentDayIndex={new Date().getDay()}
                  />
                ) : (
                  <OstInventoryLog
                    onOpenArchive={() => {
                      setInventoryArchiveType("ost");
                      setView("inventory-archive");
                    }}
                    currentDayIndex={new Date().getDay()}
                  />
                )}
              </main>
            </>
          )}
        </div>
      )}

      {view === "inventory-archive" && (
        <div>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setSnapshotId(null);
                    setView("inventory");
                  }}
                  className="flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <div>
                  <h1 className="text-4xl font-bold">
                    {inventoryArchiveType === "bunner" ? "Bunner Archive" : "Ost Archive"}
                  </h1>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-10">
            {/* archive list */}
            <ArchiveList
              storageKey={inventoryArchiveType === "bunner" ? "inventorySnapshots.v1" : "ostInventorySnapshots.v1"}
              onView={(id) => {
                setSnapshotId(id);
                setView("inventory-snapshot");
              }}
            />
          </main>
        </div>
      )}

      {view === "inventory-snapshot" && snapshotId && (
        <div>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setSnapshotId(null);
                    setView("inventory-archive");
                  }}
                  className="flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <div>
                  <h1 className="text-4xl font-bold">Snapshot Viewer</h1>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-10">
            {inventoryArchiveType === "bunner" ? (
              <InventoryLog viewSnapshotId={snapshotId} readOnly />
            ) : (
              <OstInventoryLog viewSnapshotId={snapshotId} readOnly />
            )}
          </main>
        </div>
      )}

      {view === "history" && (
        <div>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setView("overview")}
                  className="flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <div>
                  <h1 className="text-4xl font-bold">History</h1>
                  <p className="text-2xl text-slate-500">Recent routine activity</p>
                </div>
                {user?.role === "admin" && (
                  <Button
                    onClick={() => {
                      if (window.confirm("Clear all history? This cannot be undone.")) {
                        setHistory([]);
                        localStorage.removeItem("history");
                      }
                    }}
                    variant="outline"
                    className="h-12 px-4 text-lg"
                  >
                    Clear History
                  </Button>
                )}
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-6 py-10">
            {renderCalendar()}
            <div className="space-y-8">
              {Object.entries(groupedHistory)
                .sort(([a], [b]) => parseEuropeanDate(b).getTime() - parseEuropeanDate(a).getTime())
                .filter(([date]) => !selectedDate || date === selectedDate.toLocaleDateString('no-NO'))
                .map(([date, categories]) => (
                  <div key={date}>
                    <h2 className="text-3xl font-semibold mb-6">{date}</h2>
                    <div className="space-y-6">
                      {Object.entries(categories).map(([category, subs]) => (
                        <div key={category}>
                          <h3 className="text-2xl font-medium mb-4">{category}</h3>
                          {category === "Task" ? (
                            <div className="space-y-4">
                              {Object.entries(subs as Record<string, typeof history>).map(([routine, items]) => (
                                <div key={routine}>
                                  <h4 className="text-xl font-medium mb-2">{routine}</h4>
                                  <div className="space-y-2 ml-4">
                                    {items.map((item, index) => (
                                      <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                      >
                                        <Card className="rounded-3xl border border-slate-200 bg-white">
                                          <CardContent className="p-4">
                                            <div className="text-lg text-slate-700">{item.description}</div>
                                            <div className="text-sm text-slate-500 mt-1">{new Date(item.date).toLocaleString('no-NO')}</div>
                                          </CardContent>
                                        </Card>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {subs["All"].map((item, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.3, delay: index * 0.05 }}
                                >
                                  <Card className="rounded-3xl border border-slate-200 bg-white">
                                    <CardContent className="p-6">
                                      <div className="text-xl text-slate-700">{item.description}</div>
                                      <div className="text-sm text-slate-500 mt-1">{new Date(item.date).toLocaleString('no-NO')}</div>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </main>
        </div>
      )}

      {view === "list-history" && selectedList && (
        <div>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setView("list-detail")}
                  className="flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <div>
                  <h1 className="text-4xl font-bold">{selectedList.title} History</h1>
                  <p className="text-2xl text-slate-500">Task completion history</p>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-10">
            <TaskListHistory listId={selectedList.id} listTitle={selectedList.title} />
          </main>
        </div>
      )}

      <Dialog open={isAvvikDialogOpen} onOpenChange={setIsAvvikDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Avvik Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type of Avvik</label>
              <Select value={avvikType} onValueChange={setAvvikType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feillaget">feillaget</SelectItem>
                  <SelectItem value="ødelagt">ødelagt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Product Type</label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stor">stor</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="liten">liten</SelectItem>
                  <SelectItem value="tynn">tynn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Employee Name</label>
              <Input
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
                placeholder="Enter employee name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitAvvikEntry();
                  }
                }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={submitAvvikEntry}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* deletion confirmation modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#D97706] text-white">
          <DialogHeader>
            <DialogTitle>
              {deleteStep === 1 ? "Bekreft sletting" : "Endelig bekreftelse"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {deleteStep === 1 && (
              <p>
                Er du sikker på at du vil slette oppgaven &quot;{deleteInfo?.taskTitle}&quot;?
              </p>
            )}
            {deleteStep === 2 && (
              <p>
                Dette fjerner oppgaven permanent. Trykk <strong>Ja</strong> for å fortsette.
              </p>
            )}
            {deleteStep === 3 && (
              <p>
                Ønsker du også å fjerne alle historikkposter for denne oppgaven?
              </p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="destructive"
              className={cn(deleteStep === 1 ? "order-2" : "order-1", "bg-red-600 text-white hover:bg-red-700")}
              onClick={() => handleDeleteChoice(false)}
            >
              Nei
            </Button>
            <Button
              variant="default"
              className={cn(deleteStep === 1 ? "order-1" : "order-2", "bg-green-600 text-white hover:bg-green-700")}
              onClick={() => handleDeleteChoice(true)}
            >
              Ja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompDialogOpen} onOpenChange={setIsCompDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCompId != null ? "Edit Compensation" : "New Compensation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hva skjedde</label>
              <Textarea
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
                placeholder="Describe what happened"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Kompensasjon</label>
              <Textarea
                value={compCompensation}
                onChange={(e) => setCompCompensation(e.target.value)}
                placeholder="What was given as compensation"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Signatur</label>
              <Input
                value={compSignature}
                onChange={(e) => setCompSignature(e.target.value)}
                placeholder="Signer ditt navn"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCompEntry();
                  }
                }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={submitCompEntry}>{editingCompId != null ? "Update" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
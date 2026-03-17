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
import TaskDialog from "../components/TaskDialog";
import ActivityHistoryView from "@/components/history/ActivityHistoryView";
import HistoryPageShell from "@/components/history/HistoryPageShell";
import SnapshotArchiveView from "@/components/history/SnapshotArchiveView";
import PageHeader from "@/components/ui/PageHeader";
import BrandedHeader from "@/components/BrandedHeader";
import { Textarea } from "@/components/ui/textarea";

import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InventoryLog from "@/components/InventoryLog";
import OstInventoryLog from "@/components/OstInventoryLog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskListHistory from "@/components/TaskListHistory"; // generic history viewer for any list
import ColorPicker from "@/components/ui/ColorPicker";
import { getAccentClass, getBgClass, interpretColor, ColorKey } from "@/lib/colors";
import { formatTimestamp } from "@/lib/date-utils";
import type { ActivityHistoryEntry } from "@/lib/history-types";
import {
  createActivityHistoryEntry,
  findSnapshotArchiveEntry,
  readActivityHistoryEntries,
} from "@/lib/history-utils";
import { cn } from "@/lib/utils";
import ResetScheduleForm, { ResetScheduleValue } from "@/src/components/ResetScheduleForm";
import { RecordMetadata, RecordOrigin, RoutineFrequency } from "@/src/lib/scheduling/reset-types";
import { calculateNextResetAt } from "@/src/lib/scheduling/reset-schedule";
import {
  processDueResetsInBrowserStorage,
  DEFAULT_TIMEZONE,
} from "@/src/lib/scheduling/browser-reset-store";
import {
  importRoutineTemplateRecords,
  loadTaskListRecords,
  saveTaskListRecords,
} from "@/src/lib/scheduling/routine-records-repo";
import { ROUTINE_TEMPLATES } from "@/src/lib/scheduling/routine-templates";

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

// basic task used for routines and lists

type Task = {
  id: number;
  title: string;
  description: string;
  frequency?: Frequency; // only used by routines
  completed: boolean;
  metadata?: RecordMetadata;
  createdAt?: string;
  updatedAt?: string;
};

// a collection of tasks that behaves like "Stengerutiner"

type TaskList = {
  id: number;
  title: string;
  description?: string;
  color?: ColorKey | string; // semantic color key (e.g. "blue") or legacy class
  metadata?: RecordMetadata;
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
  createdAt?: string;
  updatedAt?: string;
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
    progressColor: "bg-primary", 
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
  const [history, setHistory] = useState<ActivityHistoryEntry[]>(() =>
    readActivityHistoryEntries("history")
  );

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("history", JSON.stringify(history));
  }, [history]);

  // sync history across tabs/windows
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === "history") {
        setHistory(readActivityHistoryEntries("history"));
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // task lists state (each behaves like the original "Stengerutiner" list)
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [hasLoadedTaskLists, setHasLoadedTaskLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  const ensureMetadata = (
    value: RecordMetadata | undefined,
    fallbackOrigin: RecordOrigin = "admin-created"
  ): RecordMetadata => ({
    origin:
      value?.origin === "seeded" ||
      value?.origin === "imported" ||
      value?.origin === "admin-created"
        ? value.origin
        : fallbackOrigin,
    sourceTemplateId: value?.sourceTemplateId,
    createdBy: value?.createdBy,
    organizationId: value?.organizationId,
    departmentId: value?.departmentId,
  });

  const createAdminMetadata = (): RecordMetadata => ({
    origin: "admin-created",
    createdBy: user?.code ?? "admin",
  });

  const loadTaskListsFromStore = (): TaskList[] => {
    const loaded = loadTaskListRecords();
    return loaded.map((l) => ({
      ...l,
      color:
        interpretColor(l.color as string) ||
        (l.color as string) ||
        "red",
      metadata: ensureMetadata(l.metadata),
      // legacy data may omit resetEnabled, ensure it's a boolean
      resetEnabled: !!l.resetEnabled,
      // frequency must be defined for TaskList; default to "none"
      frequency: l.frequency || "none",
      // resetTime is required on TaskList; fallback to empty string
      resetTime: l.resetTime || "",
      // timezone is required; default to UTC
      timezone: l.timezone || "UTC",
      // convert legacy tasks to current Task type
      tasks: l.tasks.map((t) => ({
        ...t,
        description: t.description || "",
        metadata: ensureMetadata(t.metadata, ensureMetadata(l.metadata).origin),
      })),
    }));
  };

  // load lists from localStorage or initialize empty (no prepopulated cards)
  useEffect(() => {
    setTaskLists(loadTaskListsFromStore());
    setHasLoadedTaskLists(true);
  }, []);

  // persist lists
  useEffect(() => {
    if (!hasLoadedTaskLists) {
      return;
    }

    saveTaskListRecords(taskLists);
  }, [hasLoadedTaskLists, taskLists]);

  // Run reset processing in a centralized module and hydrate updated live state.
  useEffect(() => {
    const checkDueResets = () => {
      processDueResetsInBrowserStorage(new Date());
      setTaskLists(loadTaskListsFromStore());
    };

    checkDueResets();
    const interval = setInterval(checkDueResets, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Lazy fallback: when opening list pages, process due resets before rendering details.
  useEffect(() => {
    if (view !== "list-detail" && view !== "list-history") {
      return;
    }

    processDueResetsInBrowserStorage(new Date());
    setTaskLists(loadTaskListsFromStore());
  }, [view, selectedListId]);


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
  const inventoryArchiveStorageKey =
    inventoryArchiveType === "bunner"
      ? "inventorySnapshots.v1"
      : "ostInventorySnapshots.v1";
  const selectedSnapshotMeta = useMemo(
    () =>
      snapshotId
        ? findSnapshotArchiveEntry(inventoryArchiveStorageKey, snapshotId)
        : null,
    [inventoryArchiveStorageKey, snapshotId]
  );

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

  const formatScheduleSummary = (list: TaskList): string => {
    if (!list.resetEnabled || list.frequency === "none") {
      return "No reset schedule configured";
    }

    if (list.frequency === "daily") {
      return `Daily at ${list.resetTime}`;
    }

    if (list.frequency === "weekly") {
      return `Weekly (day ${list.resetDayOfWeek ?? 1}) at ${list.resetTime}`;
    }

    if (list.frequency === "biweekly") {
      return `Biweekly (day ${list.resetDayOfWeek ?? 1}) at ${list.resetTime}`;
    }

    return `Monthly (day ${list.resetDayOfMonth ?? 1}) at ${list.resetTime}`;
  };

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
      setHistory((prev) => [
        createActivityHistoryEntry(`Added a new ${type} entry: ${title}`, "Work Log", undefined, date),
        ...prev,
      ]);
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
      setHistory((prev) => [
        createActivityHistoryEntry(`Edited ${entry.type} entry: ${entry.title}`, "Work Log"),
        ...prev,
      ]);
    }
  };

  const deleteLogEntry = (id: number) => {
    if (!requireAdmin()) return;
    const entry = workLog.find(e => e.id === id);
    if (window.confirm("Delete this entry?")) {
      setWorkLog((cur) => cur.filter((e) => e.id !== id));
      if (entry) {
        setHistory((prev) => [
          createActivityHistoryEntry(`Deleted ${entry.type} entry: ${entry.title}`, "Work Log"),
          ...prev,
        ]);
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
    setHistory((prev) => [
      createActivityHistoryEntry(`Added a new Avvik entry: ${title}`, "Work Log", undefined, date),
      ...prev,
    ]);
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
        createActivityHistoryEntry(`Edited Compensation entry: ${entry.title}`, "Work Log", undefined, date),
        ...prev,
      ]);
    } else {
      setWorkLog((cur) => [...cur, entry]);
      setHistory((prev) => [
        createActivityHistoryEntry(`Added a new Compensation entry: ${entry.title}`, "Work Log", undefined, date),
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
        createActivityHistoryEntry(`Completed task: ${task.title}`, "Task", routine.title),
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
    const nowIso = new Date().toISOString();

    setTaskLists((current) =>
      current.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          updatedAt: nowIso,
          tasks: l.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: newCompleted, updatedAt: nowIso } : t
          ),
        } as TaskList;
      })
    );
  };


  // list-specific helpers (admin only)

  const deleteListFromOverview = (listId: number) => {
    setTaskLists((prev) => prev.filter((l) => l.id !== listId));
  };

  const openDeleteListModal = (listId: number) => {
    const list = findList(listId);
    if (!list) return;
    setDeleteListInfo({ listId, title: list.title });
    setDeleteListStep(1);
    setIsDeleteListModalOpen(true);
  };

  const handleDeleteListChoice = (confirm: boolean) => {
    if (!deleteListInfo) return;
    if (!confirm) {
      setIsDeleteListModalOpen(false);
      return;
    }
    if (deleteListStep === 1) {
      setDeleteListStep(2);
    } else {
      deleteListFromOverview(deleteListInfo.listId);
      setIsDeleteListModalOpen(false);
    }
  };

  const openListSettings = (listId: number) => {
    setSettingsListId(listId);
    setIsListSettingsOpen(true);
  };

  const handleListSettingsAction = (action: "edit" | "delete") => {
    if (!settingsListId) return;
    setIsListSettingsOpen(false);
    if (action === "edit") {
      const list = findList(settingsListId);
      if (!list) return;
      setEditListName(list.title);
      setEditListSchedule({
        resetEnabled: list.resetEnabled,
        frequency: list.frequency,
        resetTime: list.resetTime,
        resetDayOfWeek: list.resetDayOfWeek,
        resetDayOfMonth: list.resetDayOfMonth,
        timezone: list.timezone,
      });
      setEditListColor(interpretColor(list.color as string) || (list.color as string) || "");
      setIsEditListDialogOpen(true);
    } else if (action === "delete") {
      openDeleteListModal(settingsListId);
    }
  };


  const defaultSchedule: ResetScheduleValue = {
    resetEnabled: false,
    frequency: "none",
    resetTime: "06:00",
    resetDayOfWeek: 1,
    resetDayOfMonth: 1,
    timezone: DEFAULT_TIMEZONE, // internal only
  };  

  const buildScheduleFields = (
    schedule: ResetScheduleValue,
    previous?: TaskList
  ): Pick<
    TaskList,
    | "resetEnabled"
    | "frequency"
    | "resetTime"
    | "resetDayOfWeek"
    | "resetDayOfMonth"
    | "timezone"
    | "currentPeriodStartAt"
    | "currentPeriodEndAt"
    | "lastArchivedAt"
    | "nextResetAt"
  > => {
    const resetEnabled = schedule.resetEnabled && schedule.frequency !== "none";

    if (!resetEnabled) {
      return {
        resetEnabled: false,
        frequency: "none",
        resetTime: schedule.resetTime,
        resetDayOfWeek: schedule.resetDayOfWeek,
        resetDayOfMonth: schedule.resetDayOfMonth,
        timezone: DEFAULT_TIMEZONE,
        currentPeriodStartAt: undefined,
        currentPeriodEndAt: undefined,
        lastArchivedAt: previous?.lastArchivedAt,
        nextResetAt: undefined,
      };
    }

    const policyUnchanged =
      previous &&
      previous.resetEnabled &&
      previous.frequency === schedule.frequency &&
      previous.resetTime === schedule.resetTime &&
      previous.resetDayOfWeek === schedule.resetDayOfWeek &&
      previous.resetDayOfMonth === schedule.resetDayOfMonth;

    if (policyUnchanged) {
      return {
        resetEnabled: true,
        frequency: schedule.frequency,
        resetTime: schedule.resetTime,
        resetDayOfWeek: schedule.resetDayOfWeek,
        resetDayOfMonth: schedule.resetDayOfMonth,
        timezone: DEFAULT_TIMEZONE,
        currentPeriodStartAt: previous.currentPeriodStartAt,
        currentPeriodEndAt: previous.currentPeriodEndAt,
        lastArchivedAt: previous.lastArchivedAt,
        nextResetAt: previous.nextResetAt,
      };
    }

    const next = calculateNextResetAt(
      {
        frequency: schedule.frequency,
        resetTime: schedule.resetTime,
        resetDayOfWeek: schedule.resetDayOfWeek,
        resetDayOfMonth: schedule.resetDayOfMonth,
        timezone: DEFAULT_TIMEZONE,
      },
      new Date()
    );

    return {
      resetEnabled: true,
      frequency: schedule.frequency,
      resetTime: schedule.resetTime,
      resetDayOfWeek: schedule.resetDayOfWeek,
      resetDayOfMonth: schedule.resetDayOfMonth,
      timezone: DEFAULT_TIMEZONE,
      currentPeriodStartAt: undefined,
      currentPeriodEndAt: next?.toISOString(),
      lastArchivedAt: previous?.lastArchivedAt,
      nextResetAt: next?.toISOString(),
    };
  };

  // new-list dialog state & helpers
  const [isNewListDialogOpen, setIsNewListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListSchedule, setNewListSchedule] =
    useState<ResetScheduleValue>(defaultSchedule);
  // default accent color for a freshly created list should be brand red
  const [newListColor, setNewListColor] = useState<ColorKey | "">("red");

  // integrated create-routine dialog state (blank vs template)
  const [isCreateRoutineDialogOpen, setIsCreateRoutineDialogOpen] = useState(false);
  const [createRoutineMode, setCreateRoutineMode] = useState<"blank" | "template">("blank");
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<string>("");
  const [createRoutineError, setCreateRoutineError] = useState<string | null>(null);

  // edit-list dialog state
  const [isEditListDialogOpen, setIsEditListDialogOpen] = useState(false);
  const [editListName, setEditListName] = useState("");
  const [editListSchedule, setEditListSchedule] =
    useState<ResetScheduleValue>(defaultSchedule);
  const [editListColor, setEditListColor] = useState("");

  // task dialog state & helpers (replaces native prompt flows)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit">("create");
  const [taskDialogListId, setTaskDialogListId] = useState<number | null>(null);
  const [taskDialogInitTitle, setTaskDialogInitTitle] = useState("");
  const [taskDialogInitDescription, setTaskDialogInitDescription] = useState("");
  const [taskDialogEditingTaskId, setTaskDialogEditingTaskId] = useState<number | null>(null);

  const promptAddTask = (listId: number) => {
    if (!requireAdmin()) return;
    setTaskDialogMode("create");
    setTaskDialogListId(listId);
    setTaskDialogInitTitle("");
    setTaskDialogInitDescription("");
    setTaskDialogEditingTaskId(null);
    setIsTaskDialogOpen(true);
  };

  const promptEditTask = (listId: number, task: Task) => {
    if (!requireAdmin()) return;
    setTaskDialogMode("edit");
    setTaskDialogListId(listId);
    setTaskDialogInitTitle(task.title);
    setTaskDialogInitDescription(task.description);
    setTaskDialogEditingTaskId(task.id);
    setIsTaskDialogOpen(true);
  };

  const createTask = (listId: number, title: string, description: string) => {
    const list = findList(listId);
    if (!list) return;
    const nextId = Math.max(0, ...list.tasks.map((t) => t.id)) + 1;
    const nowIso = new Date().toISOString();
    const newTask: Task = {
      id: nextId,
      title,
      description,
      completed: false,
      metadata: createAdminMetadata(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, updatedAt: nowIso, tasks: [...l.tasks, newTask] }
          : l
      )
    );
  };

  const updateTask = (
    listId: number,
    taskId: number,
    title: string,
    description: string
  ) => {
    const nowIso = new Date().toISOString();
    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              updatedAt: nowIso,
              tasks: l.tasks.map((t) =>
                t.id === taskId ? { ...t, title, description, updatedAt: nowIso } : t
              ),
            }
          : l
      )
    );
  };

  const handleTaskDialogSubmit = (title: string, description: string) => {
    if (taskDialogListId == null) return;
    if (taskDialogMode === "create") {
      createTask(taskDialogListId, title, description);
    } else if (
      taskDialogMode === "edit" &&
      taskDialogEditingTaskId != null
    ) {
      updateTask(taskDialogListId, taskDialogEditingTaskId, title, description);
    }
  };

  const promptNewList = () => {
    if (!requireAdmin()) return;
    setCreateRoutineMode("blank");
    setSelectedTemplateIndex("");
    setCreateRoutineError(null);
    setIsCreateRoutineDialogOpen(true);
  };

  const openBlankListCreationDialog = () => {
    setNewListName("");
    setNewListSchedule(defaultSchedule);
    setNewListColor("red");
    setIsNewListDialogOpen(true);
  };

  const handleCreateRoutine = () => {
    if (createRoutineMode === "blank") {
      setCreateRoutineError(null);
      setIsCreateRoutineDialogOpen(false);
      openBlankListCreationDialog();
      return;
    }

    const templateIndex = Number.parseInt(selectedTemplateIndex, 10);
    const template = Number.isNaN(templateIndex) ? undefined : ROUTINE_TEMPLATES[templateIndex];
    if (!template) {
      setCreateRoutineError("Please select a template.");
      return;
    }

    // import writes legacy data and returns the raw legacy lists, which don't match our
    // TaskList state type.  Instead reload from the store so we get properly normalized
    // TaskList objects.
    importRoutineTemplateRecords(taskLists, template, templateIndex, {
      createdBy: user?.code ?? "admin",
    });

    // refresh from repo after import
    setTaskLists(loadTaskListsFromStore());
    setCreateRoutineError(null);
    setIsCreateRoutineDialogOpen(false);
  };

  const createNewList = () => {
    const nameTrimmed = newListName.trim();
    if (!nameTrimmed) return;
    const nextId = Math.max(0, ...taskLists.map((l) => l.id)) + 1;
    const nowIso = new Date().toISOString();
    setTaskLists((prev) => [
      ...prev,
      {
        id: nextId,
        title: nameTrimmed,
        description: undefined,
        metadata: createAdminMetadata(),
        createdAt: nowIso,
        updatedAt: nowIso,
        tasks: [],
        color: newListColor,
        ...buildScheduleFields(newListSchedule),
      },
    ]);
    setIsNewListDialogOpen(false);
  };

  const applyEditList = () => {
    if (settingsListId == null) return;
    const nameTrimmed = editListName.trim();
    if (!nameTrimmed) return;
    const nowIso = new Date().toISOString();
    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === settingsListId
          ? {
              ...l,
              title: nameTrimmed,
              color: editListColor,
              updatedAt: nowIso,
              ...buildScheduleFields(editListSchedule, l),
            }
          : l
      )
    );
    setIsEditListDialogOpen(false);
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
    const nowIso = new Date().toISOString();

    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, updatedAt: nowIso, tasks: l.tasks.filter((t) => t.id !== taskId) }
          : l
      )
    );

    if (task) {
      setHistory((prev) => [
        createActivityHistoryEntry(`Deleted task: ${task.title}`, "Daily Task", list.title),
        ...prev,
      ]);
    }

    if (removeHistory && task) {
      // Archived history is immutable and intentionally preserved.
    }
  };

  // deletion modal state (tasks)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{
    listId: number;
    taskId: number;
    taskTitle: string;
  } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1);

  // list settings & deletion state (admins only)
  const [isListSettingsOpen, setIsListSettingsOpen] = useState(false);
  const [settingsListId, setSettingsListId] = useState<number | null>(null);

  const [isDeleteListModalOpen, setIsDeleteListModalOpen] = useState(false);
  const [deleteListInfo, setDeleteListInfo] = useState<{
    listId: number;
    title: string;
  } | null>(null);
  const [deleteListStep, setDeleteListStep] = useState<1 | 2>(1);

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

  // removed native prompt for name; new-dialog workflow handles creation
  // promptNewList is defined earlier where the dialog state lives

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
  return (
    <div className="min-h-screen bg-background text-foreground">
      {!user && (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-foreground">
          <h1 className="mb-4 text-5xl font-bold text-primary">PB INTERNE RUTINER</h1>
          <p className="mb-8 text-xl text-foreground/70">
            Daglige oppgaver og rutiner for alle avdelinger
          </p>

          <div className="w-full max-w-md rounded-2xl border-2 border-primary/25 bg-background p-8 shadow-lg">
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
                className="mb-4 w-full rounded border border-border bg-background px-3 py-2"
              />
              <Button className="w-full" type="submit">
                Submit
              </Button>
            </form>
            <p className="mt-2 text-sm text-foreground/60">use admin123 or staff123</p>
          </div>

          <div className="mt-12 grid max-w-md grid-cols-2 gap-6 text-center text-foreground/60">
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
            <div className="border-b border-accent/40 bg-accent/20 py-2 text-center text-accent-foreground">
              You are signed in as <strong>staff</strong>. Editing is disabled.
            </div>
          )}
          <header className="border-b-4 border-primary bg-background shadow-sm">
            <div className="mx-auto max-w-7xl px-6 py-8">
              <div className="mb-4 h-1 w-40 rounded-full bg-accent" />
              <PageHeader
                title={
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
                      <ClipboardList className="h-8 w-8 text-primary" />
                    </div>
                    <span className="text-2xl font-heading font-semibold text-primary">
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
                  </div>
                }
              />
              <nav className="mt-6 flex space-x-8 text-lg font-medium">
                {[
                  { key: "overview", label: "Overview" },
                  { key: "work-log", label: "Work Log" },
                  { key: "inventory", label: "Inventory" },
                  { key: "workers", label: "Workers" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setView(item.key as View)}
                    className={cn(
                      "pb-2",
                      view === item.key
                        ? "text-primary border-b-2 border-primary"
                        : "text-foreground/60 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-10">
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
              {/* unified live list records (seeded/imported/admin-created) */}
              {taskLists.map((list) => {
                const completed = list.tasks.filter((t) => t.completed).length;
                const total = list.tasks.length;
                return (
                  <ListCard
                    key={list.id}
                    title={list.title}
                    accentClass={getAccentClass(list.color || "red")}
                    progress={{ completed, total }}
                    onClick={() => {
                      setSelectedListId(list.id);
                      setView("list-detail");
                    }}
                    onSettings={
                      user?.role === "admin"
                        ? () => openListSettings(list.id)
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
                    <Plus className="h-10 w-10 text-primary" />
                    <span className="mt-2 text-xl text-primary">Ny liste</span>
                  </div>
                </ListCard>
              )}
            </motion.div>
          </main>
        </div>
      )}

      {view === "routine-detail" && selectedRoutine && (
        <div>
          <BrandedHeader
            color={selectedRoutine.color}
            back={() => setView("overview")}
            title={
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{selectedRoutine.emoji}</div>
                  <h2 className="text-6xl font-bold tracking-tight">{selectedRoutine.title}</h2>
                </div>
              </div>
            }
            actions={
              <div className="text-right">
                <div className="flex items-center justify-end gap-3 text-5xl font-bold">
                  <CheckCircle2 className="h-9 w-9" />
                  {selectedCompleted}/{selectedTotal}
                </div>
                <div className="mt-2 text-2xl text-white/80">completed</div>
              </div>
            }
          />

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

                        <Badge className="rounded-full border-0 bg-accent-gold-muted px-4 py-1 text-base text-accent-gold">
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
          <div className={`${getBgClass(selectedList.color)} text-white`}
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
                  {selectedList.resetEnabled && selectedList.frequency !== "none" && (
                    <p className="mt-2 text-xl text-white/80">
                      Resets: {formatScheduleSummary(selectedList)}
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
                      onClick={() => selectedListId && promptAddTask(selectedListId)}
                      className="h-14 rounded-2xl bg-white px-6 text-xl font-semibold text-primary hover:bg-white/90"
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
                  onEdit={() => selectedListId && promptEditTask(selectedListId, task)}
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

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gold-muted">
                  <BookOpen className="h-8 w-8 text-accent-gold" />
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
                  className="h-14 rounded-2xl bg-primary px-6 text-2xl hover:bg-primary/90"
                  onClick={() => addLogEntry()}
                >
                  <Plus className="mr-3 h-6 w-6" />
                  New Entry
                </Button>
              ) : (
                <Button
                  className="h-14 rounded-2xl bg-primary/20 px-6 text-2xl"
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

              <Card className="rounded-3xl border-2 border-primary bg-white">
                <CardContent className="p-6">
                  <div className="text-5xl font-bold text-primary">{logStats.batch}</div>
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
                  <div className="text-5xl font-bold text-accent-gold">{logStats.compensation}</div>
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
                      ? "border-l-primary"
                      : entry.type === "Compensation"
                      ? "border-l-accent-gold"
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
                            <Badge className="rounded-full border-0 bg-accent-gold-muted px-4 py-1 text-base text-accent-gold">
                              {entry.type}
                            </Badge>
                            <span>{formatTimestamp(entry.date)}</span>
                            <span>·</span>
                            <span>{entry.author}</span>
                          </div>

                          <h3 className="mb-3 text-3xl font-semibold">{entry.title}</h3>
                          {entry.type === "Compensation" && entry.compensation ? (
                            <div className="mb-3 space-y-2 rounded-md border border-accent-gold-muted bg-accent-gold-muted/50 p-4">
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
                                className="rounded-lg border-primary/20 bg-primary/10 px-3 py-1 text-base text-primary/70"
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
              <header className="border-b border-primary bg-white">
                <div className="mx-auto flex max-w-7xl items-center gap-5 px-6 py-8">
                  <button
                    onClick={() => setView("overview")}
                    className="flex items-center gap-2 text-xl text-primary hover:text-primary/80"
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
                      <Slice className="mx-auto h-12 w-12 text-primary" />
                      <h2 className="mt-4 text-3xl font-semibold">Bunner</h2>
                    </CardContent>
                  </Card>
                  <Card
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm cursor-pointer"
                    onClick={() => setInventorySubView("ost")}
                  >
                    <CardContent className="p-8 text-center">
                      <Pizza className="mx-auto h-12 w-12 text-secondary" />
                      <h2 className="mt-4 text-3xl font-semibold">Ost</h2>
                    </CardContent>
                  </Card>
                </div>
              </main>
            </>
          ) : (
            <>
              <header className="border-b border-primary bg-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-5">
                    <button
                      onClick={() => {
                        setInventorySubView("main");
                        setView("inventory");
                      }}
                      className="mt-4 flex items-center gap-2 text-xl text-primary hover:text-primary/80"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      Back
                    </button>

                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                      <Package className="h-8 w-8 text-primary" />
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
        <HistoryPageShell
          title={inventoryArchiveType === "bunner" ? "Bunner Archive" : "Ost Archive"}
          description="Saved read-only snapshots"
          onBack={() => {
            setSnapshotId(null);
            setView("inventory");
          }}
        >
          <SnapshotArchiveView
            key={inventoryArchiveStorageKey}
            storageKey={inventoryArchiveStorageKey}
            onOpen={(id) => {
              setSnapshotId(id);
              setView("inventory-snapshot");
            }}
          />
        </HistoryPageShell>
      )}

      {view === "inventory-snapshot" && snapshotId && (
        <HistoryPageShell
          title={selectedSnapshotMeta?.name ?? "Snapshot Viewer"}
          description={
            selectedSnapshotMeta
              ? `Saved ${formatTimestamp(selectedSnapshotMeta.createdAt)}`
              : "Read-only archived snapshot"
          }
          onBack={() => {
            setSnapshotId(null);
            setView("inventory-archive");
          }}
          bodyClassName="max-w-7xl"
        >
          {inventoryArchiveType === "bunner" ? (
            <InventoryLog viewSnapshotId={snapshotId} readOnly />
          ) : (
            <OstInventoryLog viewSnapshotId={snapshotId} readOnly />
          )}
        </HistoryPageShell>
      )}

      {view === "history" && (
        <HistoryPageShell
          title="History"
          description="Recent routine activity"
          onBack={() => setView("overview")}
          bodyClassName="max-w-5xl"
          actions={
            user?.role === "admin" ? (
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
            ) : undefined
          }
        >
          <ActivityHistoryView entries={history} />
        </HistoryPageShell>
      )}

      {view === "list-history" && selectedList && (
        <HistoryPageShell
          title={`${selectedList.title} History`}
          description="Task completion history"
          onBack={() => setView("list-detail")}
          accentClassName={getBgClass(selectedList.color)}
          bodyClassName="max-w-7xl"
        >
          <TaskListHistory listId={selectedList.id} />
        </HistoryPageShell>
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
              className={cn(deleteStep === 1 ? "order-2" : "order-1", "bg-destructive text-white hover:bg-destructive/90")}
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

      {/* list settings dialog (choose edit or delete) */}
      <Dialog open={isListSettingsOpen} onOpenChange={setIsListSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>List options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              className="w-full"
              onClick={() => handleListSettingsAction("edit")}
            >
              Edit list
            </Button>
            <Button
              className="w-full"
              onClick={() => handleListSettingsAction("delete")}
            >
              Delete list
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* list deletion confirmation modal */}
      <Dialog open={isDeleteListModalOpen} onOpenChange={setIsDeleteListModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#D97706] text-white">
          <DialogHeader>
            <DialogTitle>
              {deleteListStep === 1 ? "Bekreft sletting" : "Endelig bekreftelse"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {deleteListStep === 1 && (
              <p>
                Er du sikker på at du vil slette listen &quot;{deleteListInfo?.title}&quot; og alle oppgaver?
              </p>
            )}
            {deleteListStep === 2 && (
              <p>
                Dette fjerner listen permanent og fjerner all historikk. Trykk <strong>Ja</strong> for å fortsette.
              </p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="destructive"
              className="order-2 bg-destructive text-white hover:bg-destructive/90"
              onClick={() => handleDeleteListChoice(false)}
            >
              Nei
            </Button>
            <Button
              variant="default"
              className="order-1 bg-green-600 text-white hover:bg-green-700"
              onClick={() => handleDeleteListChoice(true)}
            >
              Ja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* create-routine choice dialog */}
      <Dialog open={isCreateRoutineDialogOpen} onOpenChange={setIsCreateRoutineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Routine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-base">
              <input
                type="radio"
                name="create-routine-mode"
                checked={createRoutineMode === "blank"}
                onChange={() => {
                  setCreateRoutineMode("blank");
                  setCreateRoutineError(null);
                }}
              />
              <span>Blank routine</span>
            </label>

            <label className="flex items-center gap-3 text-base">
              <input
                type="radio"
                name="create-routine-mode"
                checked={createRoutineMode === "template"}
                onChange={() => {
                  setCreateRoutineMode("template");
                  setCreateRoutineError(null);
                }}
              />
              <span>From template</span>
            </label>

            <div className="space-y-2">
              <label className="text-sm font-medium">Templates</label>
              <Select
                value={selectedTemplateIndex}
                onValueChange={setSelectedTemplateIndex}
                disabled={createRoutineMode !== "template"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {ROUTINE_TEMPLATES.map((template, index) => (
                    <SelectItem key={`${template.name}-${index}`} value={String(index)}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createRoutineError && <p className="text-sm text-red-600">{createRoutineError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCreateRoutineDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleCreateRoutine}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* new-list creation dialog */}
      <Dialog open={isNewListDialogOpen} onOpenChange={setIsNewListDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name for new list</DialogTitle>
            <DialogDescription>Provide a name, reset schedule, and accent color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createNewList();
                }
              }}
            />
            <ResetScheduleForm
              value={newListSchedule}
              onChange={setNewListSchedule}
            />
            <div>
              <label className="block text-sm font-medium mb-1">Accent color</label>
              <ColorPicker
                value={newListColor as ColorKey}
                onChange={(c) => setNewListColor(c)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsNewListDialogOpen(false)}>Avbryt</Button>
            <Button onClick={createNewList}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit-list dialog */}
      <Dialog open={isEditListDialogOpen} onOpenChange={setIsEditListDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit list</DialogTitle>
            <DialogDescription>Change name, reset schedule, or accent color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editListName}
              onChange={(e) => setEditListName(e.target.value)}
              placeholder="List name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyEditList();
                }
              }}
            />
            <ResetScheduleForm
              value={editListSchedule}
              onChange={setEditListSchedule}
            />
            <div>
              <label className="block text-sm font-medium mb-1">Accent color</label>
              <ColorPicker
                value={editListColor as ColorKey}
                onChange={(c) => setEditListColor(c)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsEditListDialogOpen(false)}>Avbryt</Button>
            <Button onClick={applyEditList}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* task create/edit dialog (replaces browser prompt) */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        titleText={
          taskDialogMode === "create" ? "Add task" : "Edit task"
        }
        initialTitle={taskDialogInitTitle}
        initialDescription={taskDialogInitDescription}
        onSubmit={handleTaskDialogSubmit}
      />

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

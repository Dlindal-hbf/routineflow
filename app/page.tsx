"use client";

import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Package,
  Slice,
  Pizza,
  Plus,
  User,
  Users,
  HandCoins,
  LoaderCircle,
} from "lucide-react";
import ListCard from "@/components/ListCard";
import TaskCard from "@/components/TaskCard";
import TaskDialog from "../components/TaskDialog";
import ActivityHistoryView from "@/components/history/ActivityHistoryView";
import HistoryPageShell from "@/components/history/HistoryPageShell";
import SnapshotArchiveView from "@/components/history/SnapshotArchiveView";
import BrandedHeader from "@/components/BrandedHeader";
import BackgroundSyncStatus from "@/components/BackgroundSyncStatus";
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
import CompensationModule from "@/components/CompensationModule";
import ColorPicker from "@/components/ui/ColorPicker";
import { getAccentClass, getBgClass, interpretColor, ColorKey } from "@/lib/colors";
import type { ActivityHistoryEntry } from "@/lib/history-types";
import { createActivityHistoryEntry } from "@/lib/history-utils";
import { cn } from "@/lib/utils";
import ResetScheduleForm, { ResetScheduleValue } from "@/src/components/ResetScheduleForm";
import { RecordMetadata, RecordOrigin, RoutineFrequency } from "@/src/lib/scheduling/reset-types";
import { calculateNextResetAt } from "@/src/lib/scheduling/reset-schedule";
import { DEFAULT_TIMEZONE } from "@/src/lib/scheduling/browser-reset-store";
import {
  importRoutineTemplateRecords,
  loadTaskListRecords,
  saveTaskListRecords,
} from "@/src/lib/scheduling/routine-records-repo";
import { ROUTINE_TEMPLATES } from "@/src/lib/scheduling/routine-templates";
import { useSupabaseSession } from "@/src/hooks/useSupabaseSession";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import {
  fetchActivityHistoryEntries,
  saveActivityHistoryEntries,
} from "@/src/services/activityService";
import {
  processDueResetsInSupabase,
} from "@/src/services/taskService";
import {
  fetchRoutineChecklistTasks,
  saveRoutineChecklistTasks,
} from "@/src/services/routineChecklistService";
import { getCachedActivityHistoryEntries } from "@/src/services/activityService";
import {
  fetchBunnerInventoryState,
  fetchOstInventoryState,
} from "@/src/services/inventoryService";
import { fetchCustomerInteractions } from "@/src/services/customerInteractionService";
import { pushBackgroundSyncError, runBackgroundSync } from "@/src/services/backgroundSync";

type View =
  | "overview"
  | "compensation"
  | "routine-detail"
  | "workers"
  | "history"
  | "list-detail"            // viewing a generic task list (formerly daily-tasks)
  | "list-history"           // history for the currently selected task list
  | "inventory"
  | "inventory-archive"
  | "inventory-snapshot";

type Frequency = "Daily" | "Weekly" | "Bi-weekly" | "Monthly";

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

type BusinessDataCache = {
  history: ActivityHistoryEntry[];
  taskLists: TaskList[];
  cachedAt: string;
};

const BUSINESS_DATA_CACHE_VERSION = "v1";

function getBusinessDataCacheKey(userId: string): string {
  return `business-data-cache:${BUSINESS_DATA_CACHE_VERSION}:${userId}`;
}

function readBusinessDataCache(userId: string): BusinessDataCache | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(getBusinessDataCacheKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BusinessDataCache>;
    if (!Array.isArray(parsed.history) || !Array.isArray(parsed.taskLists)) {
      return null;
    }

    return {
      history: parsed.history,
      taskLists: parsed.taskLists,
      cachedAt:
        typeof parsed.cachedAt === "string" ? parsed.cachedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeBusinessDataCache(userId: string, value: BusinessDataCache) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(getBusinessDataCacheKey(userId), JSON.stringify(value));
}

function LoadingSkeletonCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-100" />
        </div>
        <p className="text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

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
  const { error: sessionError, user: supabaseUser, isConfigError } =
    useSupabaseSession();
  const [businessPersistenceReady, setBusinessPersistenceReady] = useState(false);

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
      alert("Ugyldig kode");
    }
  };

  const [loginCode, setLoginCode] = useState("");
  const currentActorLabel =
    user?.role === "admin" ? "Manager" : user?.role === "staff" ? "Staff" : "Staff";

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const requireAdmin = () => {
    if (user?.role !== "admin") {
      alert("Administrator-tilgang kreves");
      return false;
    }
    return true;
  };
  const [routines] = useState<Routine[]>(initialRoutines);
  const [selectedRoutineId] = useState<number>(2);
  const [taskFilter, setTaskFilter] = useState<"All" | Frequency>("All");

  const [routineTasks, setRoutineTasks] = useState<Task[]>([]);
  const [hasLoadedRoutineTasks, setHasLoadedRoutineTasks] = useState(false);

  const [history, setHistory] = useState<ActivityHistoryEntry[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [hasLoadedTaskLists, setHasLoadedTaskLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const skipNextTaskListSaveRef = useRef(false);
  const latestHistoryRef = useRef(history);
  const latestTaskListsRef = useRef(taskLists);
  const latestRoutineTasksRef = useRef(routineTasks);
  const lastSyncedHistoryRef = useRef<ActivityHistoryEntry[]>([]);
  const lastSyncedTaskListsRef = useRef<TaskList[]>([]);
  const lastSyncedRoutineTasksRef = useRef<Task[]>([]);

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

  const loadTaskListsFromStore = async (): Promise<TaskList[]> => {
    const loaded = await loadTaskListRecords();
    return loaded.map((l) => ({
      ...l,
      color: interpretColor(l.color as string) || (l.color as string) || "red",
      metadata: ensureMetadata(l.metadata),
      resetEnabled: !!l.resetEnabled,
      frequency: l.frequency || "none",
      resetTime: l.resetTime || "",
      timezone: l.timezone || "UTC",
      tasks: l.tasks.map((t) => ({
        ...t,
        description: t.description || "",
        metadata: ensureMetadata(t.metadata, ensureMetadata(l.metadata).origin),
      })),
    }));
  };
  const loadTaskListsFromStoreEvent = useEffectEvent(async () => loadTaskListsFromStore());
  const replaceTaskListsFromRemote = (nextTaskLists: TaskList[]) => {
    skipNextTaskListSaveRef.current = true;
    setTaskLists(nextTaskLists);
  };

  useEffect(() => {
    latestHistoryRef.current = history;
  }, [history]);

  useEffect(() => {
    latestTaskListsRef.current = taskLists;
  }, [taskLists]);

  useEffect(() => {
    latestRoutineTasksRef.current = routineTasks;
  }, [routineTasks]);

  useEffect(() => {
    if (sessionError && !isConfigError) {
      pushBackgroundSyncError(sessionError);
    }
  }, [isConfigError, sessionError]);

  useEffect(() => {
    if (!supabaseUser) {
      return;
    }

    let isMounted = true;
    const cachedBusinessData = readBusinessDataCache(supabaseUser.id);
    const cachedHistoryEntries = getCachedActivityHistoryEntries();

    setBusinessPersistenceReady(false);

    if (cachedBusinessData) {
      setHistory(cachedBusinessData.history);
      replaceTaskListsFromRemote(cachedBusinessData.taskLists);
      setHasLoadedHistory(true);
      setHasLoadedTaskLists(true);
      lastSyncedHistoryRef.current = cachedBusinessData.history;
      lastSyncedTaskListsRef.current = cachedBusinessData.taskLists;
    } else {
      if (cachedHistoryEntries) {
        setHistory(cachedHistoryEntries);
        setHasLoadedHistory(true);
        lastSyncedHistoryRef.current = cachedHistoryEntries;
      }
    }

    const loadBusinessData = async () => {
      try {
        const [loadedHistory, loadedTaskLists] = await runBackgroundSync(
          async () => {
            await ensureLegacyBusinessDataMigrated();
            return Promise.all([
              fetchActivityHistoryEntries(),
              loadTaskListsFromStoreEvent(),
            ]);
          },
          {
            errorMessage: "Kunne ikke oppdatere virksomhetsdata. Viser sist lagrede innhold.",
          }
        );

        if (!isMounted) {
          return;
        }

        setHistory(loadedHistory);
        replaceTaskListsFromRemote(loadedTaskLists);
        setHasLoadedHistory(true);
        setHasLoadedTaskLists(true);
        setBusinessPersistenceReady(true);
        lastSyncedHistoryRef.current = loadedHistory;
        lastSyncedTaskListsRef.current = loadedTaskLists;
        writeBusinessDataCache(supabaseUser.id, {
          history: loadedHistory,
          taskLists: loadedTaskLists,
          cachedAt: new Date().toISOString(),
        });
      } catch (loadError) {
        if (isMounted && !cachedBusinessData) {
          pushBackgroundSyncError(
            loadError instanceof Error
              ? loadError.message
              : "Kunne ikke laste virksomhetsdata fra Supabase."
          );
        }
      } finally {
        if (isMounted) {
          setBusinessPersistenceReady(true);
        }
      }
    };

    void loadBusinessData();

    return () => {
      isMounted = false;
    };
  }, [supabaseUser]);

  useEffect(() => {
    if (!supabaseUser || !hasLoadedHistory || !hasLoadedTaskLists) {
      return;
    }

    writeBusinessDataCache(supabaseUser.id, {
      history,
      taskLists,
      cachedAt: new Date().toISOString(),
    });
  }, [
    hasLoadedHistory,
    hasLoadedTaskLists,
    history,
    supabaseUser,
    taskLists,
  ]);

  useEffect(() => {
    if (!supabaseUser || !businessPersistenceReady) {
      return;
    }

    void runBackgroundSync(
      async () => {
        await Promise.allSettled([
          fetchCustomerInteractions(),
          fetchBunnerInventoryState(),
          fetchOstInventoryState(),
        ]);
      },
      {
        errorMessage: "Kunne ikke klargjøre bakgrunnsdata fra Supabase.",
        suppressErrorToast: true,
      }
    ).catch(() => undefined);
  }, [businessPersistenceReady, supabaseUser]);

  useEffect(() => {
    if (view !== "routine-detail" || !supabaseUser) {
      return;
    }

    let isMounted = true;
    const routine = routines.find((entry) => entry.id === selectedRoutineId);
    if (!routine) {
      return;
    }

    if (!hasLoadedRoutineTasks) {
      setRoutineTasks(routine.tasks);
    }

    const loadRoutineTasks = async () => {
      try {
        const loadedTasks = await runBackgroundSync(
          () =>
            fetchRoutineChecklistTasks(selectedRoutineId, routine.title, routine.tasks),
          {
            errorMessage: "Kunne ikke oppdatere rutinesjekklisten. Viser sist kjente oppgaver.",
          }
        );

        if (isMounted) {
          setRoutineTasks(loadedTasks);
          setHasLoadedRoutineTasks(true);
          lastSyncedRoutineTasksRef.current = loadedTasks;
        }
      } catch (loadError) {
        if (isMounted) {
          pushBackgroundSyncError(
            loadError instanceof Error
              ? loadError.message
              : "Kunne ikke laste rutinesjekklisten."
          );
          setRoutineTasks(routine.tasks);
          lastSyncedRoutineTasksRef.current = routine.tasks;
        }
      }
    };

    void loadRoutineTasks();

    return () => {
      isMounted = false;
    };
  }, [hasLoadedRoutineTasks, routines, selectedRoutineId, supabaseUser, view]);

  useEffect(() => {
    if (!hasLoadedRoutineTasks || !supabaseUser) {
      return;
    }

    if (routineTasks === lastSyncedRoutineTasksRef.current) {
      return;
    }

    const routine = routines.find((entry) => entry.id === selectedRoutineId);
    if (!routine) {
      return;
    }

    const pendingTasks = routineTasks;
    const previousTasks = lastSyncedRoutineTasksRef.current;
    const timeout = window.setTimeout(() => {
      void runBackgroundSync(
        () => saveRoutineChecklistTasks(selectedRoutineId, routine.title, pendingTasks),
        {
          errorMessage: "Kunne ikke lagre rutinesjekklisten. Siste mislykkede endring ble rullet tilbake.",
          onError: () => {
            if (latestRoutineTasksRef.current === pendingTasks) {
              setRoutineTasks(previousTasks);
            }
          },
        }
      )
        .then(() => {
          if (latestRoutineTasksRef.current === pendingTasks) {
            lastSyncedRoutineTasksRef.current = pendingTasks;
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [hasLoadedRoutineTasks, routineTasks, routines, selectedRoutineId, supabaseUser]);

  useEffect(() => {
    if (!businessPersistenceReady || !hasLoadedHistory || !supabaseUser) {
      return;
    }

    if (history === lastSyncedHistoryRef.current) {
      return;
    }

    const pendingHistory = history;
    const previousHistory = lastSyncedHistoryRef.current;
    const timeout = window.setTimeout(() => {
      void runBackgroundSync(() => saveActivityHistoryEntries(pendingHistory), {
        errorMessage:
          "Kunne ikke lagre aktivitetshistorikk. Siste mislykkede endring ble rullet tilbake.",
        onError: () => {
          if (latestHistoryRef.current === pendingHistory) {
            setHistory(previousHistory);
          }
        },
      })
        .then(() => {
          if (latestHistoryRef.current === pendingHistory) {
            lastSyncedHistoryRef.current = pendingHistory;
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [businessPersistenceReady, hasLoadedHistory, history, supabaseUser]);

  useEffect(() => {
    if (!businessPersistenceReady || !hasLoadedTaskLists || !supabaseUser) {
      return;
    }

    if (skipNextTaskListSaveRef.current) {
      skipNextTaskListSaveRef.current = false;
      return;
    }

    if (taskLists === lastSyncedTaskListsRef.current) {
      return;
    }

    const pendingTaskLists = taskLists;
    const previousTaskLists = lastSyncedTaskListsRef.current;
    const timeout = window.setTimeout(() => {
      void runBackgroundSync(() => saveTaskListRecords(pendingTaskLists), {
        errorMessage: "Kunne ikke lagre oppgavelistene. Siste mislykkede endring ble rullet tilbake.",
        onError: () => {
          if (latestTaskListsRef.current === pendingTaskLists) {
            replaceTaskListsFromRemote(previousTaskLists);
          }
        },
      })
        .then(() => {
          if (latestTaskListsRef.current === pendingTaskLists) {
            lastSyncedTaskListsRef.current = pendingTaskLists;
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [businessPersistenceReady, hasLoadedTaskLists, supabaseUser, taskLists]);

  useEffect(() => {
    if (!supabaseUser || !businessPersistenceReady) {
      return;
    }

    const checkDueResets = async () => {
      try {
        await runBackgroundSync(() => processDueResetsInSupabase(new Date()), {
          errorMessage: "Kunne ikke behandle planlagte nullstillinger i bakgrunnen.",
          suppressErrorToast: true,
        });
        const refreshedLists = await loadTaskListsFromStoreEvent();
        replaceTaskListsFromRemote(refreshedLists);
        lastSyncedTaskListsRef.current = refreshedLists;
      } catch (resetError) {
        pushBackgroundSyncError(
          resetError instanceof Error
            ? resetError.message
            : "Kunne ikke behandle planlagte nullstillinger."
        );
      }
    };

    void checkDueResets();
    const interval = window.setInterval(() => {
      void checkDueResets();
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [businessPersistenceReady, supabaseUser]);


  const selectedRoutine =
    routines.find((routine) => routine.id === selectedRoutineId) ?? routines[0];

  const filteredTasks = useMemo(() => {
    if (!selectedRoutine) return [];
    return routineTasks.filter((task) => {
      if (taskFilter === "All") return true;
      return task.frequency === taskFilter;
    });
  }, [selectedRoutine, taskFilter, routineTasks]);

  const findList = (listId: number) => taskLists.find((l) => l.id === listId);

  const selectedList = selectedListId != null ? findList(selectedListId) : null;
  const inventoryArchiveStorageKey =
    inventoryArchiveType === "bunner"
      ? "inventorySnapshots.v1"
      : "ostInventorySnapshots.v1";

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
        createActivityHistoryEntry(`Fullførte oppgave: ${task.title}`, "Oppgave", routine.title),
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

  const handleCreateRoutine = async () => {
    if (createRoutineMode === "blank") {
      setCreateRoutineError(null);
      setIsCreateRoutineDialogOpen(false);
      openBlankListCreationDialog();
      return;
    }

    const templateIndex = Number.parseInt(selectedTemplateIndex, 10);
    const template = Number.isNaN(templateIndex) ? undefined : ROUTINE_TEMPLATES[templateIndex];
    if (!template) {
      setCreateRoutineError("Velg en mal.");
      return;
    }

    // import writes legacy data and returns the raw legacy lists, which don't match our
    // TaskList state type.  Instead reload from the store so we get properly normalized
    // TaskList objects.
    await importRoutineTemplateRecords(taskLists, template, templateIndex, {
      createdBy: user?.code ?? "admin",
    });

    // refresh from repo after import
    replaceTaskListsFromRemote(await loadTaskListsFromStore());
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
        createActivityHistoryEntry(`Slettet oppgave: ${task.title}`, "Daglig oppgave", list.title),
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

  const showTaskListLoadingSkeletons = !hasLoadedTaskLists && taskLists.length === 0;
  const showHistoryLoadingSkeleton = !hasLoadedHistory && history.length === 0;

  if (sessionError && isConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-red-700">Supabase setup is incomplete</h1>
          <p className="mt-3 text-base text-slate-600">{sessionError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundSyncStatus />
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
              <span className="mt-2 block">Historikk</span>
            </div>
            <div>
              <Users className="mx-auto h-8 w-8 opacity-50" />
              <span className="mt-2 block">Ansatte</span>
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
              Du er logget inn som <strong>ansatt</strong>. Redigering er deaktivert.
            </div>
          )}
          <header className="border-b border-primary/15 bg-background">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mb-3 h-1 w-14 rounded-full bg-accent shadow-[0_0_0_1px_rgba(255,218,117,0.18)] sm:w-20" />
            </div>
            <div className="mx-auto max-w-7xl px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/35 bg-accent/15">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h1 className="text-lg font-heading font-semibold tracking-tight text-primary">
                        PB INTERNE RUTINER
                      </h1>
                      <p className="text-sm text-foreground/70">
                        Daglige oppgaver og rutiner for alle avdelinger
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-accent/25 pt-3">
                  {[
                    { key: "compensation", label: "Kompensasjon", icon: HandCoins },
                    { key: "inventory", label: "Lager", icon: Package },
                    { key: "workers", label: "Ansatte", icon: Users },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = view === item.key;
                    return (
                      <Button
                        key={item.key}
                        variant="outline"
                        className={cn(
                          "h-9 rounded-lg border px-3 text-sm transition-all focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2",
                          isActive
                            ? "border-accent/45 bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,218,117,0.25)] hover:bg-primary/90"
                            : "border-primary/15 bg-white text-foreground/80 hover:border-accent/50 hover:bg-accent/15 hover:text-foreground"
                        )}
                        onClick={() => setView(item.key as View)}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-6">
            {showTaskListLoadingSkeletons && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                <span>Laster oppgavelister og aktivitetsdata…</span>
              </div>
            )}
            <motion.div 
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
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
              {showTaskListLoadingSkeletons &&
                Array.from({ length: 3 }, (_, index) => (
                  <LoadingSkeletonCard
                    key={`task-list-skeleton-${index}`}
                    title="Laster oppgaveliste"
                    description="Fetching routines and saved progress from Supabase."
                  />
                ))}
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
                <button
                  type="button"
                  onClick={promptNewList}
                  className="group flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-white px-4 py-5 text-center transition-colors hover:border-accent/50 hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/20 text-primary transition-colors group-hover:bg-accent/35 group-hover:text-foreground">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="mt-2 text-sm font-semibold text-primary">Ny liste</span>
                  <span className="text-xs text-foreground/60">Opprett ny rutineliste</span>
                </button>
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

      {view === "compensation" && (
        <CompensationModule
          onBack={() => setView("overview")}
          currentActor={currentActorLabel}
          onHistoryEntry={(description) =>
            setHistory((prev) => [
              createActivityHistoryEntry(
                description,
                "Kompensasjon",
                undefined,
                new Date().toISOString()
              ),
              ...prev,
            ])
          }
        />
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
                Tilbake
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
                    Vis historikk
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
                  Tilbake
                </button>
                <div>
                  <h1 className="text-4xl font-bold">Ansatte</h1>
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
                    Tilbake
                  </button>
                  <h1 className="text-4xl font-bold tracking-tight">Lager</h1>
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
                      Tilbake
                    </button>

                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                      <Package className="h-8 w-8 text-primary" />
                    </div>

                    <div>
                      <h1 className="text-4xl font-bold tracking-tight">
                        {inventorySubView === "bunner" ? "Bunner-lager" : "Ost-lager"}
                      </h1>
                      <p className="mt-1 text-2xl text-slate-500">
                        {inventorySubView === "bunner"
                          ? "Daglige produktmengder etter størrelse og status"
                          : "Daglig ostelager med signert logging"}
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
                      Lagerområde
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
          description="Lagrede skrivebeskyttede øyeblikksbilder"
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
          title="Visning av øyeblikksbilde"
          description="Skrivebeskyttet arkivert øyeblikksbilde"
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
          title="Historikk"
          description="Nylig rutineaktivitet"
          onBack={() => setView("overview")}
          bodyClassName="max-w-5xl"
          actions={
            user?.role === "admin" ? (
              <Button
                onClick={() => {
                  if (window.confirm("Clear all history? This cannot be undone.")) {
                    setHistory([]);
                  }
                }}
                variant="outline"
                className="h-12 px-4 text-lg"
              >
                Tøm historikk
              </Button>
            ) : undefined
          }
        >
          {showHistoryLoadingSkeleton ? (
            <LoadingSkeletonCard
              title="Laster historikk"
              description="Nylig aktivitet vises her så snart synkroniseringen er ferdig."
            />
          ) : (
            <ActivityHistoryView entries={history} />
          )}
        </HistoryPageShell>
      )}

      {view === "list-history" && selectedList && (
        <HistoryPageShell
          title={`${selectedList.title} historikk`}
          description="Historikk for fullførte oppgaver"
          onBack={() => setView("list-detail")}
          accentClassName={getBgClass(selectedList.color)}
          bodyClassName="max-w-7xl"
        >
          <TaskListHistory listId={selectedList.id} />
        </HistoryPageShell>
      )}

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
            <DialogTitle>Listevalg</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              className="w-full"
              onClick={() => handleListSettingsAction("edit")}
            >
              Rediger liste
            </Button>
            <Button
              className="w-full"
              onClick={() => handleListSettingsAction("delete")}
            >
              Slett liste
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
            <DialogTitle>Opprett rutine</DialogTitle>
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
              <span>Tom rutine</span>
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
              <span>Fra mal</span>
            </label>

            <div className="space-y-2">
              <label className="text-sm font-medium">Maler</label>
              <Select
                value={selectedTemplateIndex}
                onValueChange={setSelectedTemplateIndex}
                disabled={createRoutineMode !== "template"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Velg mal" />
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
            <Button onClick={handleCreateRoutine}>Opprett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* new-list creation dialog */}
      <Dialog open={isNewListDialogOpen} onOpenChange={setIsNewListDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Navn på ny liste</DialogTitle>
            <DialogDescription>Angi navn, nullstillingsplan og aksentfarge.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Listenavn"
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
              <label className="block text-sm font-medium mb-1">Aksentfarge</label>
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
            <DialogTitle>Rediger liste</DialogTitle>
            <DialogDescription>Endre navn, nullstillingsplan eller aksentfarge.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editListName}
              onChange={(e) => setEditListName(e.target.value)}
              placeholder="Listenavn"
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
              <label className="block text-sm font-medium mb-1">Aksentfarge</label>
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
          taskDialogMode === "create" ? "Legg til oppgave" : "Rediger oppgave"
        }
        initialTitle={taskDialogInitTitle}
        initialDescription={taskDialogInitDescription}
        onSubmit={handleTaskDialogSubmit}
      />

    </div>
  );
}

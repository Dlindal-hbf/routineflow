"use client";

import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

export type RoutineChecklistTask = {
  id: number;
  title: string;
  description: string;
  frequency?: "Daily" | "Weekly" | "Bi-weekly" | "Monthly";
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function routineListAppId(routineId: number): string {
  return `routine:${routineId}`;
}

function routineTaskAppId(routineId: number, taskId: number): string {
  return `routine:${routineId}:${taskId}`;
}

async function ensureRoutineList(
  userId: string,
  routineId: number,
  routineTitle: string
): Promise<string> {
  const supabase = getSupabaseClient();
  const appId = routineListAppId(routineId);

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("task_lists")
    .upsert(
      {
        user_id: userId,
        app_id: appId,
        title: routineTitle,
        description: "",
        color: "blue",
        metadata: {
          origin: "seeded",
          sourceTemplateId: `builtin.routine.${routineId}`,
        },
        reset_enabled: false,
        frequency: "none",
        reset_time: "06:00",
        timezone: "Europe/Oslo",
        sort_order: routineId,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id,app_id" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function fetchRoutineChecklistTasks(
  routineId: number,
  routineTitle: string,
  fallbackTasks: RoutineChecklistTask[]
): Promise<RoutineChecklistTask[]> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const listId = await ensureRoutineList(userId, routineId, routineTitle);

  const { data, error } = await supabase
    .from("tasks")
    .select("app_id, title, description, frequency, completed, created_at, updated_at, sort_order")
    .eq("user_id", userId)
    .eq("task_list_id", listId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    await saveRoutineChecklistTasks(routineId, routineTitle, fallbackTasks);
    return fallbackTasks;
  }

  return data.map((row) => ({
    id: Number(String(row.app_id).split(":").pop()),
    title: row.title as string,
    description: (row.description as string | null) ?? "",
    frequency: (row.frequency as RoutineChecklistTask["frequency"] | null) ?? undefined,
    completed: Boolean(row.completed),
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  }));
}

export async function saveRoutineChecklistTasks(
  routineId: number,
  routineTitle: string,
  tasks: RoutineChecklistTask[]
): Promise<void> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const listId = await ensureRoutineList(userId, routineId, routineTitle);

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .eq("task_list_id", listId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (tasks.length === 0) {
    return;
  }

  const nowIso = new Date().toISOString();
  const rows = tasks.map((task, index) => ({
    user_id: userId,
    app_id: routineTaskAppId(routineId, task.id),
    task_list_id: listId,
    task_list_app_id: routineListAppId(routineId),
    title: task.title,
    description: task.description,
    frequency: task.frequency ?? null,
    completed: task.completed,
    sort_order: index,
    metadata: {
      origin: "seeded",
      sourceTemplateId: `builtin.routine.${routineId}.task.${task.id}`,
    },
    created_at: task.createdAt ?? nowIso,
    updated_at: task.updatedAt ?? nowIso,
  }));

  const { error: insertError } = await supabase.from("tasks").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

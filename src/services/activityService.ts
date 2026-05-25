"use client";

import type { ActivityHistoryEntry } from "@/lib/history-types";
import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { fetchCachedValue, getCachedValue, setCachedValue } from "@/src/services/clientCache";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

type ActivityHistoryRow = {
  id: string;
  event_timestamp: string;
  day_key: ActivityHistoryEntry["dayKey"];
  description: string;
  category: string;
  routine: string | null;
};

function getActivityHistoryCacheKey(userId: string) {
  return `activity-history:${userId}`;
}

export function getCachedActivityHistoryEntries(): ActivityHistoryEntry[] | undefined {
  return getCachedValue<ActivityHistoryEntry[]>("activity-history:latest");
}

export async function fetchActivityHistoryEntries(): Promise<ActivityHistoryEntry[]> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getActivityHistoryCacheKey(userId), async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("activity_history_entries")
      .select("id, event_timestamp, day_key, description, category, routine")
      .eq("user_id", userId)
      .order("event_timestamp", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = ((data ?? []) as ActivityHistoryRow[]).map((row) => ({
      timestamp: row.event_timestamp,
      dayKey: row.day_key,
      description: row.description,
      category: row.category,
      routine: row.routine ?? undefined,
    }));

    setCachedValue("activity-history:latest", mapped);
    return mapped;
  });
}

export async function saveActivityHistoryEntries(
  entries: ActivityHistoryEntry[]
): Promise<void> {
  const userId = await requireSupabaseUserId();
  setCachedValue(getActivityHistoryCacheKey(userId), entries);
  setCachedValue("activity-history:latest", entries);
  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from("activity_history_entries")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (entries.length === 0) {
    return;
  }

  const rows = entries.map((entry, index) => ({
    user_id: userId,
    event_timestamp: entry.timestamp,
    day_key: entry.dayKey,
    description: entry.description,
    category: entry.category,
    routine: entry.routine ?? null,
    created_at: entry.timestamp,
    updated_at: entry.timestamp,
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${index}`,
  }));

  const { error: insertError } = await supabase
    .from("activity_history_entries")
    .insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

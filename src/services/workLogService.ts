"use client";

import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { fetchCachedValue, getCachedValue, setCachedValue } from "@/src/services/clientCache";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

export type LogType = "Deviation" | "Batch Tracing" | "Compensation" | "Other";

export type WorkLogEntryRecord = {
  id: number;
  type: LogType;
  title: string;
  date: string;
  author: string;
  details: string;
  pills?: string[];
  compensation?: {
    reason: string;
    compensation: string;
    signature: string;
  };
};

type WorkLogRow = {
  app_id: string;
  entry_type: LogType;
  title: string;
  entry_date: string;
  author: string;
  details: string;
  pills: string[] | null;
  compensation: WorkLogEntryRecord["compensation"] | null;
};

function getWorkLogCacheKey(userId: string) {
  return `work-log:${userId}`;
}

export function getCachedWorkLogEntries(): WorkLogEntryRecord[] | undefined {
  return getCachedValue<WorkLogEntryRecord[]>("work-log:latest");
}

export async function fetchWorkLogEntries(): Promise<WorkLogEntryRecord[]> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getWorkLogCacheKey(userId), async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("work_log_entries")
      .select("app_id, entry_type, title, entry_date, author, details, pills, compensation")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = ((data ?? []) as WorkLogRow[]).map((row) => ({
      id: Number(row.app_id),
      type: row.entry_type,
      title: row.title,
      date: row.entry_date,
      author: row.author,
      details: row.details,
      pills: Array.isArray(row.pills) ? row.pills : [],
      compensation: row.compensation ?? undefined,
    }));

    setCachedValue("work-log:latest", mapped);
    return mapped;
  });
}

export async function saveWorkLogEntries(entries: WorkLogEntryRecord[]): Promise<void> {
  const userId = await requireSupabaseUserId();
  setCachedValue(getWorkLogCacheKey(userId), entries);
  setCachedValue("work-log:latest", entries);
  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from("work_log_entries")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (entries.length === 0) {
    return;
  }

  const rows = entries.map((entry) => ({
    user_id: userId,
    app_id: String(entry.id),
    entry_type: entry.type,
    title: entry.title,
    entry_date: entry.date,
    author: entry.author,
    details: entry.details,
    pills: entry.pills ?? [],
    compensation: entry.compensation ?? null,
    created_at: entry.date,
    updated_at: entry.date,
  }));

  const { error: insertError } = await supabase.from("work_log_entries").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

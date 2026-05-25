"use client";

import { getSupabaseClient } from "@/src/lib/supabaseClient";

export async function requireSupabaseUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("No authenticated Supabase user is available.");
  }

  return user.id;
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

export function toIsoStringOrNull(value: string | undefined): string | null {
  return value?.trim() ? value : null;
}

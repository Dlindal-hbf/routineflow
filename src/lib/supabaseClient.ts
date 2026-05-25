"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
let didLogSupabaseConfig = false;

function getSupabaseUrlHostname(): string | null {
  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return "invalid-url";
  }
}

function getSupabaseKeyFormat(): "publishable" | "legacy-jwt" | "unknown" | "missing" {
  if (!supabaseAnonKey) {
    return "missing";
  }

  if (supabaseAnonKey.startsWith("sb_publishable_")) {
    return "publishable";
  }

  if (supabaseAnonKey.startsWith("eyJ")) {
    return "legacy-jwt";
  }

  return "unknown";
}

export function logSupabaseClientConfig(): void {
  if (didLogSupabaseConfig) {
    return;
  }

  didLogSupabaseConfig = true;
  console.info("[supabase] client config", {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    urlHostname: getSupabaseUrlHostname(),
    anonKeyFormat: getSupabaseKeyFormat(),
  });
}

export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  }

  try {
    void new URL(supabaseUrl);
  } catch {
    return `Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}".`;
  }

  return null;
}

export function getSupabaseClient(): SupabaseClient {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  logSupabaseClientConfig();

  if (!client) {
    client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return client;
}

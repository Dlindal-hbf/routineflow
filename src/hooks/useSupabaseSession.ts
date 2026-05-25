"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  getSupabaseConfigError,
  logSupabaseClientConfig,
} from "@/src/lib/supabaseClient";

type SupabaseSessionState = {
  loading: boolean;
  error: string | null;
  session: Session | null;
  user: User | null;
  isConfigError: boolean;
};

const listeners = new Set<(state: SupabaseSessionState) => void>();

let cachedSupabaseSessionState: SupabaseSessionState = {
  loading: true,
  error: null,
  session: null,
  user: null,
  isConfigError: false,
};
let bootstrapPromise: Promise<SupabaseSessionState> | null = null;
let authSubscriptionInitialized = false;

function formatSupabaseAuthError(context: string, error: unknown): string {
  if (!(error instanceof Error)) {
    return `${context} failed with an unknown error.`;
  }

  const details = {
    name: error.name,
    message: error.message,
    status:
      "status" in error && typeof error.status === "number"
        ? error.status
        : undefined,
    code:
      "code" in error && typeof error.code === "string"
        ? error.code
        : undefined,
  };

  const reason =
    error.message === "Failed to fetch"
      ? " This usually means the Supabase URL is unreachable from the browser, DNS failed, the hostname is wrong, or the request was blocked before auth settings were even checked."
      : "";

  return `${context} failed. ${JSON.stringify(details)}.${reason}`;
}

function emitSupabaseSessionState() {
  for (const listener of listeners) {
    listener(cachedSupabaseSessionState);
  }
}

function updateSupabaseSessionState(nextState: SupabaseSessionState) {
  cachedSupabaseSessionState = nextState;
  emitSupabaseSessionState();
}

function subscribeToSupabaseSessionState(
  listener: (state: SupabaseSessionState) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getBootstrapErrorState(configError: string): SupabaseSessionState {
  return {
    loading: false,
    error: configError,
    session: null,
    user: null,
    isConfigError: true,
  };
}

function ensureAuthSubscription() {
  if (authSubscriptionInitialized || getSupabaseConfigError()) {
    return;
  }

  authSubscriptionInitialized = true;
  const supabase = getSupabaseClient();
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    updateSupabaseSessionState({
      loading: false,
      error: null,
      session: nextSession,
      user: nextSession?.user ?? null,
      isConfigError: false,
    });
  });
}

export function getSupabaseSessionState(): SupabaseSessionState {
  const configError = getSupabaseConfigError();
  if (configError) {
    return getBootstrapErrorState(configError);
  }

  return cachedSupabaseSessionState;
}

export async function ensureSupabaseSessionState(): Promise<SupabaseSessionState> {
  const configError = getSupabaseConfigError();
  if (configError) {
    const errorState = getBootstrapErrorState(configError);
    updateSupabaseSessionState(errorState);
    return errorState;
  }

  ensureAuthSubscription();
  if (cachedSupabaseSessionState.user || cachedSupabaseSessionState.session) {
    return cachedSupabaseSessionState;
  }

  if (!bootstrapPromise) {
    logSupabaseClientConfig();
    const supabase = getSupabaseClient();
    bootstrapPromise = (async (): Promise<SupabaseSessionState> => {
      const {
        data: { session: existingSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[supabase] getSession error", sessionError);
        const nextState = {
          loading: false,
          error: formatSupabaseAuthError("Supabase getSession", sessionError),
          session: null,
          user: null,
          isConfigError: false,
        } satisfies SupabaseSessionState;
        updateSupabaseSessionState(nextState);
        return nextState;
      }

      if (existingSession) {
        const nextState = {
          loading: false,
          error: null,
          session: existingSession,
          user: existingSession.user ?? null,
          isConfigError: false,
        } satisfies SupabaseSessionState;
        updateSupabaseSessionState(nextState);
        return nextState;
      }

      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        console.error("[supabase] signInAnonymously error", signInError);
        const nextState = {
          loading: false,
          error: formatSupabaseAuthError("Supabase anonymous sign-in", signInError),
          session: null,
          user: null,
          isConfigError: false,
        } satisfies SupabaseSessionState;
        updateSupabaseSessionState(nextState);
        return nextState;
      }

      const nextState = {
        loading: false,
        error: null,
        session: data.session ?? null,
        user: data.session?.user ?? null,
        isConfigError: false,
      } satisfies SupabaseSessionState;
      updateSupabaseSessionState(nextState);
      return nextState;
    })().finally(() => {
      bootstrapPromise = null;
    });
  }

  return bootstrapPromise;
}

export function useSupabaseSession(): SupabaseSessionState {
  const [state, setState] = useState<SupabaseSessionState>(() => getSupabaseSessionState());

  useEffect(() => {
    const unsubscribe = subscribeToSupabaseSessionState(setState);
    void ensureSupabaseSessionState().then(setState);
    return unsubscribe;
  }, []);

  return state;
}

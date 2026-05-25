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
};

let cachedSupabaseSessionState: SupabaseSessionState | null = null;
let bootstrapPromise: Promise<SupabaseSessionState> | null = null;

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

export function useSupabaseSession(): SupabaseSessionState {
  const configError = getSupabaseConfigError();
  const [session, setSession] = useState<Session | null>(
    cachedSupabaseSessionState?.session ?? null
  );
  const [loading, setLoading] = useState(
    configError ? false : (cachedSupabaseSessionState?.loading ?? true)
  );
  const [error, setError] = useState<string | null>(
    configError ?? cachedSupabaseSessionState?.error ?? null
  );

  useEffect(() => {
    if (configError) {
      cachedSupabaseSessionState = {
        loading: false,
        error: configError,
        session: null,
        user: null,
      };
      return;
    }

    logSupabaseClientConfig();
    const supabase = getSupabaseClient();
    let isMounted = true;

    const bootstrap = async (): Promise<SupabaseSessionState> => {
      const {
        data: { session: existingSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[supabase] getSession error", sessionError);
        return {
          loading: false,
          error: formatSupabaseAuthError("Supabase getSession", sessionError),
          session: null,
          user: null,
        };
      }

      if (existingSession) {
        return {
          loading: false,
          error: null,
          session: existingSession,
          user: existingSession.user ?? null,
        };
      }

      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        console.error("[supabase] signInAnonymously error", signInError);
        return {
          loading: false,
          error: formatSupabaseAuthError("Supabase anonymous sign-in", signInError),
          session: null,
          user: null,
        };
      }

      return {
        loading: false,
        error: null,
        session: data.session ?? null,
        user: data.session?.user ?? null,
      };
    };

    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap().finally(() => {
        bootstrapPromise = null;
      });
    }

    void bootstrapPromise.then((nextState) => {
      cachedSupabaseSessionState = nextState;
      if (!isMounted) {
        return;
      }

      setSession(nextState.session);
      setError(nextState.error);
      setLoading(nextState.loading);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextState = {
        loading: false,
        error: null,
        session: nextSession,
        user: nextSession?.user ?? null,
      } satisfies SupabaseSessionState;
      cachedSupabaseSessionState = nextState;
      if (!isMounted) {
        return;
      }

      setSession(nextState.session);
      setError(nextState.error);
      setLoading(nextState.loading);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configError]);

  return {
    loading,
    error,
    session,
    user: session?.user ?? null,
  };
}

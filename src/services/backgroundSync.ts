"use client";

type SyncToast = {
  id: string;
  message: string;
};

type BackgroundSyncSnapshot = {
  pendingCount: number;
  toasts: SyncToast[];
};

const listeners = new Set<() => void>();
const dismissTimers = new Map<string, number>();

let pendingCount = 0;
let toasts: SyncToast[] = [];

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getBackgroundSyncSnapshot(): BackgroundSyncSnapshot {
  return {
    pendingCount,
    toasts,
  };
}

export function subscribeToBackgroundSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginBackgroundSync(): () => void {
  pendingCount += 1;
  emit();

  let finished = false;
  return () => {
    if (finished) {
      return;
    }

    finished = true;
    pendingCount = Math.max(0, pendingCount - 1);
    emit();
  };
}

export function dismissBackgroundSyncToast(toastId: string) {
  const timeoutId = dismissTimers.get(toastId);
  if (timeoutId) {
    window.clearTimeout(timeoutId);
    dismissTimers.delete(toastId);
  }

  toasts = toasts.filter((toast) => toast.id !== toastId);
  emit();
}

export function pushBackgroundSyncError(message: string) {
  const toastId = createId();
  toasts = [...toasts.slice(-2), { id: toastId, message }];
  emit();

  const timeoutId = window.setTimeout(() => {
    dismissBackgroundSyncToast(toastId);
  }, 5000);

  dismissTimers.set(toastId, timeoutId);
}

type RunBackgroundSyncOptions = {
  errorMessage: string;
  onError?: (error: unknown) => void;
  suppressErrorToast?: boolean;
};

export async function runBackgroundSync<T>(
  task: () => Promise<T>,
  options: RunBackgroundSyncOptions
): Promise<T> {
  const finish = beginBackgroundSync();
  try {
    return await task();
  } catch (error) {
    if (!options.suppressErrorToast) {
      pushBackgroundSyncError(options.errorMessage);
    }
    options.onError?.(error);
    throw error;
  } finally {
    finish();
  }
}

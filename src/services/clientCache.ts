"use client";

type CacheEntry<T> = {
  value?: T;
  promise?: Promise<T>;
  updatedAt?: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<() => void>>();

function getEntry<T>(key: string): CacheEntry<T> {
  return (cache.get(key) as CacheEntry<T> | undefined) ?? {};
}

function emit(key: string) {
  const keyListeners = listeners.get(key);
  if (!keyListeners) {
    return;
  }

  for (const listener of keyListeners) {
    listener();
  }
}

export function getCachedValue<T>(key: string): T | undefined {
  return getEntry<T>(key).value;
}

export function getCachedUpdatedAt(key: string): number | undefined {
  return getEntry(key).updatedAt;
}

export function isCachedValueStale(key: string, staleAfterMs: number): boolean {
  const updatedAt = getCachedUpdatedAt(key);
  if (!updatedAt) {
    return true;
  }

  return Date.now() - updatedAt > staleAfterMs;
}

export function subscribeToCachedValue(key: string, listener: () => void): () => void {
  const keyListeners = listeners.get(key) ?? new Set<() => void>();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);

  return () => {
    const currentListeners = listeners.get(key);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      listeners.delete(key);
    }
  };
}

export function setCachedValue<T>(key: string, value: T): T {
  cache.set(key, {
    ...getEntry<T>(key),
    value,
    updatedAt: Date.now(),
    promise: undefined,
  });
  emit(key);
  return value;
}

export function clearCachedValue(key: string) {
  cache.delete(key);
  emit(key);
}

export function clearCachedValuesByPrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      emit(key);
    }
  }
}

export async function revalidateCachedValue<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = getEntry<T>(key);
  if (existing.promise) {
    return existing.promise;
  }

  const promise = fetcher()
    .then((value) => {
      setCachedValue(key, value);
      return value;
    })
    .catch((error) => {
      const current = getEntry<T>(key);
      cache.set(key, {
        value: current.value,
        updatedAt: current.updatedAt,
        promise: undefined,
      });
      emit(key);
      throw error;
    });

  cache.set(key, {
    value: existing.value,
    updatedAt: existing.updatedAt,
    promise,
  });
  emit(key);

  return promise;
}

export async function fetchCachedValue<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return revalidateCachedValue(key, fetcher);
}

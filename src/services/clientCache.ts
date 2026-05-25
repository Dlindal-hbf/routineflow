"use client";

type CacheEntry<T> = {
  value?: T;
  promise?: Promise<T>;
  updatedAt?: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

function getEntry<T>(key: string): CacheEntry<T> {
  return (cache.get(key) as CacheEntry<T> | undefined) ?? {};
}

export function getCachedValue<T>(key: string): T | undefined {
  return getEntry<T>(key).value;
}

export function setCachedValue<T>(key: string, value: T): T {
  cache.set(key, {
    ...getEntry<T>(key),
    value,
    updatedAt: Date.now(),
    promise: undefined,
  });
  return value;
}

export function clearCachedValue(key: string) {
  cache.delete(key);
}

export function clearCachedValuesByPrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export async function fetchCachedValue<T>(
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
      throw error;
    });

  cache.set(key, {
    value: existing.value,
    updatedAt: existing.updatedAt,
    promise,
  });

  return promise;
}

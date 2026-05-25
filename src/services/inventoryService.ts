"use client";

import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { fetchCachedValue, getCachedValue, setCachedValue } from "@/src/services/clientCache";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

export type InventoryKind = "bunner" | "ost";
export type BunnerCategory = "Stor" | "Medium" | "Liten" | "Glutenfri" | "Tynn";
export type BunnerMetric =
  | "fra igår"
  | "bakt idag"
  | "klar for idag"
  | "sum solgt"
  | "teoretisk igjen"
  | "feillaget"
  | "ikke hentet"
  | "tørr/ødelagt"
  | "gitt ut feil"
  | "forhåndsbestilt"
  | "avvik"
  | "totalt på kjøl";
export type OstMetric =
  | "Antall gram"
  | "Levert"
  | "Korrigert"
  | "Forbruk"
  | "Beholdning etter forbruk"
  | "Beholdning etter telling"
  | "Avvik";
export type OstDayMeta = {
  signature: string;
  notes: string;
};

export const INVENTORY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const BUNNER_CATEGORIES: BunnerCategory[] = [
  "Stor",
  "Medium",
  "Liten",
  "Glutenfri",
  "Tynn",
];

export const BUNNER_METRICS: BunnerMetric[] = [
  "fra igår",
  "bakt idag",
  "klar for idag",
  "sum solgt",
  "teoretisk igjen",
  "feillaget",
  "ikke hentet",
  "tørr/ødelagt",
  "gitt ut feil",
  "forhåndsbestilt",
  "avvik",
  "totalt på kjøl",
];

export const OST_METRICS: OstMetric[] = [
  "Antall gram",
  "Levert",
  "Korrigert",
  "Forbruk",
  "Beholdning etter forbruk",
  "Beholdning etter telling",
  "Avvik",
];

export type BunnerInventoryData = Record<
  string,
  Record<BunnerCategory, Record<BunnerMetric, string>>
>;

export type BunnerInventorySnapshot = {
  id: string;
  name: string;
  createdAt: string;
  entries: BunnerInventoryData;
};

export type OstInventoryData = Record<string, Record<OstMetric, string>>;
export type OstInventoryMeta = Record<string, OstDayMeta>;
export type OstInventorySnapshot = {
  id: string;
  name: string;
  createdAt: string;
  entries: OstInventoryData;
  dayMeta: OstInventoryMeta;
};

type InventoryItemRow = {
  id: string;
  snapshot_id: string | null;
  day_name: string;
  category: string | null;
  metric: string;
  value: string;
  signature: string | null;
  notes: string | null;
};

type InventorySnapshotRow = {
  id: string;
  app_id: string;
  name: string;
  created_at: string;
};

const META_ROW_METRIC = "__meta__";

type BunnerInventoryState = {
  entries: BunnerInventoryData;
  snapshots: BunnerInventorySnapshot[];
};

type OstInventoryState = {
  entries: OstInventoryData;
  dayMeta: OstInventoryMeta;
  snapshots: OstInventorySnapshot[];
};

function getInventoryCacheKey(inventoryType: InventoryKind, userId: string) {
  return `inventory:${inventoryType}:${userId}`;
}

export function getCachedBunnerInventoryState(): BunnerInventoryState | undefined {
  return getCachedValue<BunnerInventoryState>("inventory:bunner:latest");
}

export function getCachedOstInventoryState(): OstInventoryState | undefined {
  return getCachedValue<OstInventoryState>("inventory:ost:latest");
}

function createEmptyBunnerDay(): Record<BunnerCategory, Record<BunnerMetric, string>> {
  const day = {} as Record<BunnerCategory, Record<BunnerMetric, string>>;

  for (const category of BUNNER_CATEGORIES) {
    day[category] = {} as Record<BunnerMetric, string>;
    for (const metric of BUNNER_METRICS) {
      day[category][metric] = "";
    }
  }

  return day;
}

export function createEmptyBunnerWeek(): BunnerInventoryData {
  const week = {} as BunnerInventoryData;
  for (const day of INVENTORY_DAYS) {
    week[day] = createEmptyBunnerDay();
  }
  return week;
}

function createEmptyOstDay(): Record<OstMetric, string> {
  const day = {} as Record<OstMetric, string>;
  for (const metric of OST_METRICS) {
    day[metric] = "";
  }
  return day;
}

export function createEmptyOstWeek(): OstInventoryData {
  const week = {} as OstInventoryData;
  for (const day of INVENTORY_DAYS) {
    week[day] = createEmptyOstDay();
  }
  return week;
}

export function createEmptyOstMeta(): OstInventoryMeta {
  const meta = {} as OstInventoryMeta;
  for (const day of INVENTORY_DAYS) {
    meta[day] = { signature: "", notes: "" };
  }
  return meta;
}

export function normalizeBunnerEntries(raw: unknown): BunnerInventoryData {
  const parsed =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const normalized = createEmptyBunnerWeek();

  for (const day of INVENTORY_DAYS) {
    const dayData =
      typeof parsed[day] === "object" && parsed[day] !== null
        ? (parsed[day] as Record<string, unknown>)
        : {};

    for (const category of BUNNER_CATEGORIES) {
      const categoryData =
        typeof dayData[category] === "object" && dayData[category] !== null
          ? (dayData[category] as Record<string, unknown>)
          : {};

      for (const metric of BUNNER_METRICS) {
        normalized[day][category][metric] =
          typeof categoryData[metric] === "string" ? categoryData[metric] : "";
      }
    }
  }

  return normalized;
}

export function normalizeOstEntries(raw: unknown): OstInventoryData {
  const parsed =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const normalized = createEmptyOstWeek();

  for (const day of INVENTORY_DAYS) {
    const dayData =
      typeof parsed[day] === "object" && parsed[day] !== null
        ? (parsed[day] as Record<string, unknown>)
        : {};

    for (const metric of OST_METRICS) {
      const legacyValue =
        metric === "Korrigert" && typeof dayData["Korrigert/levert"] === "string"
          ? (dayData["Korrigert/levert"] as string)
          : undefined;

      normalized[day][metric] =
        legacyValue ?? (typeof dayData[metric] === "string" ? dayData[metric] : "");
    }
  }

  return normalized;
}

export function normalizeOstMeta(raw: unknown): OstInventoryMeta {
  const parsed =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const normalized = createEmptyOstMeta();

  for (const day of INVENTORY_DAYS) {
    const dayMeta =
      typeof parsed[day] === "object" && parsed[day] !== null
        ? (parsed[day] as Partial<OstDayMeta>)
        : {};

    normalized[day] = {
      signature: typeof dayMeta.signature === "string" ? dayMeta.signature : "",
      notes: typeof dayMeta.notes === "string" ? dayMeta.notes : "",
    };
  }

  return normalized;
}

function mapBunnerRowsToEntries(rows: InventoryItemRow[]): BunnerInventoryData {
  const entries = createEmptyBunnerWeek();

  for (const row of rows) {
    if (!row.category || !BUNNER_CATEGORIES.includes(row.category as BunnerCategory)) {
      continue;
    }

    if (!BUNNER_METRICS.includes(row.metric as BunnerMetric)) {
      continue;
    }

    entries[row.day_name][row.category as BunnerCategory][row.metric as BunnerMetric] =
      row.value ?? "";
  }

  return entries;
}

function mapOstRowsToEntries(
  rows: InventoryItemRow[]
): { entries: OstInventoryData; dayMeta: OstInventoryMeta } {
  const entries = createEmptyOstWeek();
  const dayMeta = createEmptyOstMeta();

  for (const row of rows) {
    if (row.metric === META_ROW_METRIC) {
      dayMeta[row.day_name] = {
        signature: row.signature ?? "",
        notes: row.notes ?? "",
      };
      continue;
    }

    if (!OST_METRICS.includes(row.metric as OstMetric)) {
      continue;
    }

    entries[row.day_name][row.metric as OstMetric] = row.value ?? "";
  }

  return { entries, dayMeta };
}

function serializeBunnerRows(
  userId: string,
  inventoryType: InventoryKind,
  entries: BunnerInventoryData,
  snapshotId?: string
) {
  return INVENTORY_DAYS.flatMap((day) =>
    BUNNER_CATEGORIES.flatMap((category) =>
      BUNNER_METRICS.map((metric) => ({
        user_id: userId,
        snapshot_id: snapshotId ?? null,
        inventory_type: inventoryType,
        day_name: day,
        category,
        metric,
        value: entries[day]?.[category]?.[metric] ?? "",
      }))
    )
  );
}

function serializeOstRows(
  userId: string,
  inventoryType: InventoryKind,
  entries: OstInventoryData,
  dayMeta: OstInventoryMeta,
  snapshotId?: string
) {
  const metricRows = INVENTORY_DAYS.flatMap((day) =>
    OST_METRICS.map((metric) => ({
      user_id: userId,
      snapshot_id: snapshotId ?? null,
      inventory_type: inventoryType,
      day_name: day,
      category: null,
      metric,
      value: entries[day]?.[metric] ?? "",
      signature: null,
      notes: null,
    }))
  );

  const metaRows = INVENTORY_DAYS.map((day) => ({
    user_id: userId,
    snapshot_id: snapshotId ?? null,
    inventory_type: inventoryType,
    day_name: day,
    category: null,
    metric: META_ROW_METRIC,
    value: "",
    signature: dayMeta[day]?.signature ?? "",
    notes: dayMeta[day]?.notes ?? "",
  }));

  return [...metricRows, ...metaRows];
}

async function fetchSnapshotRows(inventoryType: InventoryKind, userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_snapshots")
    .select("id, app_id, name, created_at")
    .eq("user_id", userId)
    .eq("inventory_type", inventoryType)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as InventorySnapshotRow[];
}

async function fetchSnapshotItems(snapshotIds: string[], inventoryType: InventoryKind, userId: string) {
  if (snapshotIds.length === 0) {
    return [] as InventoryItemRow[];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, snapshot_id, day_name, category, metric, value, signature, notes")
    .eq("user_id", userId)
    .eq("inventory_type", inventoryType)
    .in("snapshot_id", snapshotIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as InventoryItemRow[];
}

export async function fetchBunnerInventoryState(): Promise<BunnerInventoryState> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getInventoryCacheKey("bunner", userId), async () => {
    const supabase = getSupabaseClient();

    const [{ data: liveRows, error: liveError }, snapshotRows] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, snapshot_id, day_name, category, metric, value, signature, notes")
        .eq("user_id", userId)
        .eq("inventory_type", "bunner")
        .is("snapshot_id", null),
      fetchSnapshotRows("bunner", userId),
    ]);

    if (liveError) {
      throw new Error(liveError.message);
    }

    const snapshotItems = await fetchSnapshotItems(
      snapshotRows.map((row) => row.id),
      "bunner",
      userId
    );

    const itemsBySnapshotId = new Map<string, InventoryItemRow[]>();
    for (const item of snapshotItems) {
      const snapshotId = item.snapshot_id;
      if (!snapshotId) {
        continue;
      }

      const existing = itemsBySnapshotId.get(snapshotId) ?? [];
      existing.push(item);
      itemsBySnapshotId.set(snapshotId, existing);
    }

    const state = {
      entries: mapBunnerRowsToEntries((liveRows ?? []) as InventoryItemRow[]),
      snapshots: snapshotRows.map((snapshot) => ({
        id: snapshot.app_id,
        name: snapshot.name,
        createdAt: snapshot.created_at,
        entries: mapBunnerRowsToEntries(itemsBySnapshotId.get(snapshot.id) ?? []),
      })),
    };

    setCachedValue("inventory:bunner:latest", state);
    return state;
  });
}

export async function fetchOstInventoryState(): Promise<OstInventoryState> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getInventoryCacheKey("ost", userId), async () => {
    const supabase = getSupabaseClient();

    const [{ data: liveRows, error: liveError }, snapshotRows] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, snapshot_id, day_name, category, metric, value, signature, notes")
        .eq("user_id", userId)
        .eq("inventory_type", "ost")
        .is("snapshot_id", null),
      fetchSnapshotRows("ost", userId),
    ]);

    if (liveError) {
      throw new Error(liveError.message);
    }

    const snapshotItems = await fetchSnapshotItems(
      snapshotRows.map((row) => row.id),
      "ost",
      userId
    );

    const itemsBySnapshotId = new Map<string, InventoryItemRow[]>();
    for (const item of snapshotItems) {
      const snapshotId = item.snapshot_id;
      if (!snapshotId) {
        continue;
      }

      const existing = itemsBySnapshotId.get(snapshotId) ?? [];
      existing.push(item);
      itemsBySnapshotId.set(snapshotId, existing);
    }

    const current = mapOstRowsToEntries((liveRows ?? []) as InventoryItemRow[]);

    const state = {
      entries: current.entries,
      dayMeta: current.dayMeta,
      snapshots: snapshotRows.map((snapshot) => {
        const mapped = mapOstRowsToEntries(itemsBySnapshotId.get(snapshot.id) ?? []);
        return {
          id: snapshot.app_id,
          name: snapshot.name,
          createdAt: snapshot.created_at,
          entries: mapped.entries,
          dayMeta: mapped.dayMeta,
        };
      }),
    };

    setCachedValue("inventory:ost:latest", state);
    return state;
  });
}

export async function saveBunnerCurrentEntries(entries: BunnerInventoryData): Promise<void> {
  const userId = await requireSupabaseUserId();
  const normalizedEntries = normalizeBunnerEntries(entries);
  const cacheKey = getInventoryCacheKey("bunner", userId);
  const cached = getCachedValue<BunnerInventoryState>(cacheKey);
  const nextState = {
    entries: normalizedEntries,
    snapshots: cached?.snapshots ?? [],
  };
  setCachedValue(cacheKey, nextState);
  setCachedValue("inventory:bunner:latest", nextState);
  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from("inventory_items")
    .delete()
    .eq("user_id", userId)
    .eq("inventory_type", "bunner")
    .is("snapshot_id", null);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows = serializeBunnerRows(userId, "bunner", normalizedEntries);
  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("inventory_items").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function saveOstCurrentState(
  entries: OstInventoryData,
  dayMeta: OstInventoryMeta
): Promise<void> {
  const userId = await requireSupabaseUserId();
  const normalizedEntries = normalizeOstEntries(entries);
  const normalizedDayMeta = normalizeOstMeta(dayMeta);
  const cacheKey = getInventoryCacheKey("ost", userId);
  const cached = getCachedValue<OstInventoryState>(cacheKey);
  const nextState = {
    entries: normalizedEntries,
    dayMeta: normalizedDayMeta,
    snapshots: cached?.snapshots ?? [],
  };
  setCachedValue(cacheKey, nextState);
  setCachedValue("inventory:ost:latest", nextState);
  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from("inventory_items")
    .delete()
    .eq("user_id", userId)
    .eq("inventory_type", "ost")
    .is("snapshot_id", null);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows = serializeOstRows(
    userId,
    "ost",
    normalizedEntries,
    normalizedDayMeta
  );

  const { error: insertError } = await supabase.from("inventory_items").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function upsertSnapshotMetadata(
  inventoryType: InventoryKind,
  snapshots: Array<{ id: string; name: string; createdAt: string }>,
  userId: string
) {
  const supabase = getSupabaseClient();

  const existing = await fetchSnapshotRows(inventoryType, userId);
  const existingByAppId = new Map(existing.map((row) => [row.app_id, row]));
  const nextAppIds = new Set(snapshots.map((snapshot) => snapshot.id));

  for (const row of existing) {
    if (nextAppIds.has(row.app_id)) {
      continue;
    }

    const { error } = await supabase
      .from("inventory_snapshots")
      .delete()
      .eq("id", row.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshots.length === 0) {
    return new Map<string, string>();
  }

  const rows = snapshots.map((snapshot) => {
    const existingRow = existingByAppId.get(snapshot.id);
    return {
      id: existingRow?.id,
      user_id: userId,
      app_id: snapshot.id,
      inventory_type: inventoryType,
      name: snapshot.name,
      created_at: existingRow?.created_at ?? snapshot.createdAt,
      updated_at: snapshot.createdAt,
    };
  });

  const { error: upsertError } = await supabase.from("inventory_snapshots").upsert(rows, {
    onConflict: "user_id,app_id",
  });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const refreshed = await fetchSnapshotRows(inventoryType, userId);
  return new Map(refreshed.map((row) => [row.app_id, row.id]));
}

export async function saveBunnerSnapshots(
  snapshots: BunnerInventorySnapshot[]
): Promise<void> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const normalizedSnapshots = snapshots.map((snapshot) => ({
    ...snapshot,
    entries: normalizeBunnerEntries(snapshot.entries),
  }));
  const snapshotIdMap = await upsertSnapshotMetadata(
    "bunner",
    normalizedSnapshots.map(({ id, name, createdAt }) => ({ id, name, createdAt })),
    userId
  );

  const snapshotDatabaseIds = [...snapshotIdMap.values()];
  if (snapshotDatabaseIds.length > 0) {
    const { error: deleteItemsError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("user_id", userId)
      .eq("inventory_type", "bunner")
      .in("snapshot_id", snapshotDatabaseIds);

    if (deleteItemsError) {
      throw new Error(deleteItemsError.message);
    }
  }

  const rows = normalizedSnapshots.flatMap((snapshot) =>
    serializeBunnerRows(userId, "bunner", snapshot.entries, snapshotIdMap.get(snapshot.id))
  );

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("inventory_items").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }

  const cacheKey = getInventoryCacheKey("bunner", userId);
  const cached = getCachedValue<BunnerInventoryState>(cacheKey);
  const nextState = {
    entries: cached?.entries ?? createEmptyBunnerWeek(),
    snapshots: normalizedSnapshots,
  };
  setCachedValue(cacheKey, nextState);
  setCachedValue("inventory:bunner:latest", nextState);
}

export async function saveOstSnapshots(
  snapshots: OstInventorySnapshot[]
): Promise<void> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const normalizedSnapshots = snapshots.map((snapshot) => ({
    ...snapshot,
    entries: normalizeOstEntries(snapshot.entries),
    dayMeta: normalizeOstMeta(snapshot.dayMeta),
  }));
  const snapshotIdMap = await upsertSnapshotMetadata(
    "ost",
    normalizedSnapshots.map(({ id, name, createdAt }) => ({ id, name, createdAt })),
    userId
  );

  const snapshotDatabaseIds = [...snapshotIdMap.values()];
  if (snapshotDatabaseIds.length > 0) {
    const { error: deleteItemsError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("user_id", userId)
      .eq("inventory_type", "ost")
      .in("snapshot_id", snapshotDatabaseIds);

    if (deleteItemsError) {
      throw new Error(deleteItemsError.message);
    }
  }

  const rows = normalizedSnapshots.flatMap((snapshot) =>
    serializeOstRows(
      userId,
      "ost",
      snapshot.entries,
      snapshot.dayMeta,
      snapshotIdMap.get(snapshot.id)
    )
  );

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("inventory_items").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }

  const cacheKey = getInventoryCacheKey("ost", userId);
  const cached = getCachedValue<OstInventoryState>(cacheKey);
  const nextState = {
    entries: cached?.entries ?? createEmptyOstWeek(),
    dayMeta: cached?.dayMeta ?? createEmptyOstMeta(),
    snapshots: normalizedSnapshots,
  };
  setCachedValue(cacheKey, nextState);
  setCachedValue("inventory:ost:latest", nextState);
}

export async function deleteInventorySnapshot(
  inventoryType: InventoryKind,
  snapshotAppId: string
): Promise<void> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("inventory_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("inventory_type", inventoryType)
    .eq("app_id", snapshotAppId);

  if (error) {
    throw new Error(error.message);
  }

  if (inventoryType === "bunner") {
    const cacheKey = getInventoryCacheKey("bunner", userId);
    const cached = getCachedValue<BunnerInventoryState>(cacheKey);
    if (cached) {
      const nextState = {
        ...cached,
        snapshots: cached.snapshots.filter((snapshot) => snapshot.id !== snapshotAppId),
      };
      setCachedValue(cacheKey, nextState);
      setCachedValue("inventory:bunner:latest", nextState);
    }
    return;
  }

  const cacheKey = getInventoryCacheKey("ost", userId);
  const cached = getCachedValue<OstInventoryState>(cacheKey);
  if (cached) {
    const nextState = {
      ...cached,
      snapshots: cached.snapshots.filter((snapshot) => snapshot.id !== snapshotAppId),
    };
    setCachedValue(cacheKey, nextState);
    setCachedValue("inventory:ost:latest", nextState);
  }
}

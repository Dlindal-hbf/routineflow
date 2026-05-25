"use client";

import type {
  CompensationActivityEntry,
  CompensationCase,
} from "@/lib/compensation-types";
import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { fetchCachedValue, getCachedValue, setCachedValue } from "@/src/services/clientCache";
import { ensureCustomerForCase } from "@/src/services/customerService";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

type CustomerInteractionRow = {
  id: string;
  customer_id: string;
  case_number: string;
  created_by: string;
  assigned_to: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_reference: string | null;
  issue_category: CompensationCase["issueCategory"];
  issue_description: string;
  related_product_name: string | null;
  related_order_number: string | null;
  internal_notes: string | null;
  compensation_type: CompensationCase["compensationType"];
  compensation_value: number | null;
  currency: "NOK";
  replacement_item_name: string | null;
  gift_card_reference: string | null;
  decision_note: string | null;
  fulfillment_mode: CompensationCase["fulfillmentMode"];
  status: CompensationCase["status"];
  ready_for_claim_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  expiry_date: string | null;
  fulfilled_by: string | null;
  claim_note: string | null;
  archived_at: string | null;
  cancelled_at: string | null;
  archive_reason: string | null;
  activity_log: CompensationActivityEntry[] | null;
  created_at: string;
  updated_at: string;
};

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}0000-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

function createCaseNumber(): string {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
  const timePart = `${String(now.getUTCHours()).padStart(2, "0")}${String(
    now.getUTCMinutes()
  ).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COMP-${datePart}-${timePart}-${randomPart}`;
}

function isUniqueCaseNumberViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string; details?: string };
  return (
    maybeError.code === "23505" &&
    `${maybeError.message ?? ""} ${maybeError.details ?? ""}`.includes(
      "customer_interactions_case_number_idx"
    )
  );
}

function toSafeCreateError(): Error {
  return new Error("Could not create case. Please try again.");
}

function mapInteractionRow(row: CustomerInteractionRow): CompensationCase {
  return {
    id: row.id,
    caseNumber: row.case_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    assignedTo: row.assigned_to ?? undefined,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email ?? undefined,
    customerReference: row.customer_reference ?? undefined,
    issueCategory: row.issue_category,
    issueDescription: row.issue_description,
    relatedProductName: row.related_product_name ?? undefined,
    relatedOrderNumber: row.related_order_number ?? undefined,
    internalNotes: row.internal_notes ?? undefined,
    compensationType: row.compensation_type,
    compensationValue: row.compensation_value,
    currency: row.currency,
    replacementItemName: row.replacement_item_name ?? undefined,
    giftCardReference: row.gift_card_reference ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    fulfillmentMode: row.fulfillment_mode,
    status: row.status,
    readyForClaimAt: row.ready_for_claim_at ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    fulfilledBy: row.fulfilled_by ?? undefined,
    claimNote: row.claim_note ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    archiveReason: row.archive_reason ?? undefined,
    activityLog: Array.isArray(row.activity_log) ? row.activity_log : [],
  };
}

const FAKE_COMPENSATION_CUSTOMER_NAMES = new Set([
  "Thomas Nilsen",
  "Maria Johansen",
  "Lina Aas",
  "Isak Berg",
]);

function isFakeCompensationCase(customerName: string): boolean {
  return FAKE_COMPENSATION_CUSTOMER_NAMES.has(customerName.trim());
}

function filterOutFakeCompensationCases<T extends { customerName: string }>(
  cases: T[]
): T[] {
  return cases.filter((caseRecord) => !isFakeCompensationCase(caseRecord.customerName));
}

function getCustomerInteractionsCacheKey(userId: string) {
  return `customer-interactions:${userId}`;
}

export function getCachedCustomerInteractions(): CompensationCase[] | undefined {
  const cached = getCachedValue<CompensationCase[]>("customer-interactions:latest");
  return cached ? filterOutFakeCompensationCases(cached) : undefined;
}

async function findExistingCustomerIdForInteraction(interactionId: string, userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("customer_interactions")
    .select("customer_id")
    .eq("user_id", userId)
    .eq("id", interactionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.customer_id as string | undefined) ?? undefined;
}

export async function fetchCustomerInteractions(): Promise<CompensationCase[]> {
  const userId = await requireSupabaseUserId();
  return fetchCachedValue(getCustomerInteractionsCacheKey(userId), async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("customer_interactions")
      .select(
        "id, customer_id, case_number, created_by, assigned_to, customer_name, customer_phone, customer_email, customer_reference, issue_category, issue_description, related_product_name, related_order_number, internal_notes, compensation_type, compensation_value, currency, replacement_item_name, gift_card_reference, decision_note, fulfillment_mode, status, ready_for_claim_at, claimed_at, completed_at, expiry_date, fulfilled_by, claim_note, archived_at, cancelled_at, archive_reason, activity_log, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = ((data ?? []) as CustomerInteractionRow[])
      .map(mapInteractionRow)
      .filter((caseRecord) => !isFakeCompensationCase(caseRecord.customerName));
    setCachedValue("customer-interactions:latest", mapped);
    return mapped;
  });
}

export async function upsertCustomerInteraction(
  caseRecord: CompensationCase
): Promise<CompensationCase> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const interactionId = isUuid(caseRecord.id) ? caseRecord.id : createUuid();
  const existingCustomerId = await findExistingCustomerIdForInteraction(interactionId, userId);
  const isCreate = !existingCustomerId;
  const customerId = await ensureCustomerForCase(caseRecord, existingCustomerId);

  const payloadBase = {
    id: interactionId,
    user_id: userId,
    customer_id: customerId,
    created_by: caseRecord.createdBy,
    assigned_to: normalizeOptionalText(caseRecord.assignedTo),
    customer_name: caseRecord.customerName.trim(),
    customer_phone: caseRecord.customerPhone.trim(),
    customer_email: normalizeOptionalText(caseRecord.customerEmail),
    customer_reference: normalizeOptionalText(caseRecord.customerReference),
    issue_category: caseRecord.issueCategory,
    issue_description: caseRecord.issueDescription.trim(),
    related_product_name: normalizeOptionalText(caseRecord.relatedProductName),
    related_order_number: normalizeOptionalText(caseRecord.relatedOrderNumber),
    internal_notes: normalizeOptionalText(caseRecord.internalNotes),
    compensation_type: caseRecord.compensationType,
    compensation_value: caseRecord.compensationValue,
    currency: caseRecord.currency,
    replacement_item_name: normalizeOptionalText(caseRecord.replacementItemName),
    gift_card_reference: normalizeOptionalText(caseRecord.giftCardReference),
    decision_note: normalizeOptionalText(caseRecord.decisionNote),
    fulfillment_mode: caseRecord.fulfillmentMode,
    status: caseRecord.status,
    ready_for_claim_at: normalizeOptionalText(caseRecord.readyForClaimAt),
    claimed_at: normalizeOptionalText(caseRecord.claimedAt),
    completed_at: normalizeOptionalText(caseRecord.completedAt),
    expiry_date: normalizeOptionalText(caseRecord.expiryDate),
    fulfilled_by: normalizeOptionalText(caseRecord.fulfilledBy),
    claim_note: normalizeOptionalText(caseRecord.claimNote),
    archived_at: normalizeOptionalText(caseRecord.archivedAt),
    cancelled_at: normalizeOptionalText(caseRecord.cancelledAt),
    archive_reason: normalizeOptionalText(caseRecord.archiveReason),
    activity_log: caseRecord.activityLog,
    created_at: caseRecord.createdAt,
    updated_at: caseRecord.updatedAt,
  };

  let responseData: CustomerInteractionRow | null = null;
  let attempt = 0;
  const maxAttempts = isCreate ? 6 : 1;

  while (attempt < maxAttempts) {
    attempt += 1;
    const payload = {
      ...payloadBase,
      case_number: isCreate ? createCaseNumber() : caseRecord.caseNumber,
    };

    const { data, error } = await supabase
      .from("customer_interactions")
      .upsert(payload)
      .select(
        "id, customer_id, case_number, created_by, assigned_to, customer_name, customer_phone, customer_email, customer_reference, issue_category, issue_description, related_product_name, related_order_number, internal_notes, compensation_type, compensation_value, currency, replacement_item_name, gift_card_reference, decision_note, fulfillment_mode, status, ready_for_claim_at, claimed_at, completed_at, expiry_date, fulfilled_by, claim_note, archived_at, cancelled_at, archive_reason, activity_log, created_at, updated_at"
      )
      .single();

    if (!error) {
      responseData = data as CustomerInteractionRow;
      break;
    }

    if (isCreate && isUniqueCaseNumberViolation(error) && attempt < maxAttempts) {
      continue;
    }

    if (isCreate) {
      throw toSafeCreateError();
    }

    throw new Error(error.message);
  }

  if (!responseData) {
    throw toSafeCreateError();
  }

  const mapped = mapInteractionRow(responseData);
  const cacheKey = getCustomerInteractionsCacheKey(userId);
  const current = getCachedValue<CompensationCase[]>(cacheKey) ?? [];
  const next = [
    mapped,
    ...current.filter(
      (entry) => entry.id !== mapped.id && !isFakeCompensationCase(entry.customerName)
    ),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  setCachedValue(cacheKey, next);
  setCachedValue("customer-interactions:latest", next);
  return mapped;
}

export async function deleteCustomerInteraction(caseId: string): Promise<void> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("customer_interactions")
    .delete()
    .eq("user_id", userId)
    .eq("id", caseId);

  if (error) {
    throw new Error(error.message);
  }

  const cacheKey = getCustomerInteractionsCacheKey(userId);
  const current = getCachedValue<CompensationCase[]>(cacheKey) ?? [];
  const next = current.filter(
    (entry) => entry.id !== caseId && !isFakeCompensationCase(entry.customerName)
  );
  setCachedValue(cacheKey, next);
  setCachedValue("customer-interactions:latest", next);
}

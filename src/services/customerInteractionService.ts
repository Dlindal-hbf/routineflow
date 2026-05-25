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

function getCustomerInteractionsCacheKey(userId: string) {
  return `customer-interactions:${userId}`;
}

export function getCachedCustomerInteractions(): CompensationCase[] | undefined {
  return getCachedValue<CompensationCase[]>("customer-interactions:latest");
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

    const mapped = ((data ?? []) as CustomerInteractionRow[]).map(mapInteractionRow);
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
  const customerId = await ensureCustomerForCase(caseRecord, existingCustomerId);

  const payload = {
    id: interactionId,
    user_id: userId,
    customer_id: customerId,
    case_number: caseRecord.caseNumber,
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

  const { data, error } = await supabase
    .from("customer_interactions")
    .upsert(payload)
    .select(
      "id, customer_id, case_number, created_by, assigned_to, customer_name, customer_phone, customer_email, customer_reference, issue_category, issue_description, related_product_name, related_order_number, internal_notes, compensation_type, compensation_value, currency, replacement_item_name, gift_card_reference, decision_note, fulfillment_mode, status, ready_for_claim_at, claimed_at, completed_at, expiry_date, fulfilled_by, claim_note, archived_at, cancelled_at, archive_reason, activity_log, created_at, updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const mapped = mapInteractionRow(data as CustomerInteractionRow);
  const cacheKey = getCustomerInteractionsCacheKey(userId);
  const current = getCachedValue<CompensationCase[]>(cacheKey) ?? [];
  const next = [mapped, ...current.filter((entry) => entry.id !== mapped.id)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  setCachedValue(cacheKey, next);
  setCachedValue("customer-interactions:latest", next);
  return mapped;
}

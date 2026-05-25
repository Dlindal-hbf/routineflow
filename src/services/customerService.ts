"use client";

import type { CompensationCase } from "@/lib/compensation-types";
import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { requireSupabaseUserId } from "@/src/services/serviceUtils";

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  customer_reference: string | null;
  latest_notes: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRecord = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  customerReference?: string;
  latestNotes?: string;
  lastInteractionAt?: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapCustomerRow(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email ?? undefined,
    customerReference: row.customer_reference ?? undefined,
    latestNotes: row.latest_notes ?? undefined,
    lastInteractionAt: row.last_interaction_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findExistingCustomer(
  userId: string,
  caseRecord: CompensationCase
): Promise<CustomerRow | null> {
  const supabase = getSupabaseClient();
  const phone = caseRecord.customerPhone.trim();
  const email = normalizeText(caseRecord.customerEmail);
  const customerReference = normalizeText(caseRecord.customerReference);

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, customer_reference, latest_notes, last_interaction_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const candidates = (data ?? []) as CustomerRow[];
  return (
    candidates.find((candidate) => candidate.phone === phone) ??
    candidates.find((candidate) => email && candidate.email === email) ??
    candidates.find(
      (candidate) =>
        customerReference &&
        candidate.customer_reference === customerReference &&
        candidate.full_name === caseRecord.customerName.trim()
    ) ??
    null
  );
}

export async function fetchCustomers(): Promise<CustomerRecord[]> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, customer_reference, latest_notes, last_interaction_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CustomerRow[]).map(mapCustomerRow);
}

export async function ensureCustomerForCase(
  caseRecord: CompensationCase,
  existingCustomerId?: string
): Promise<string> {
  const userId = await requireSupabaseUserId();
  const supabase = getSupabaseClient();

  let customerId = existingCustomerId;
  if (!customerId) {
    const existingCustomer = await findExistingCustomer(userId, caseRecord);
    customerId = existingCustomer?.id;
  }

  const customerPayload = {
    user_id: userId,
    full_name: caseRecord.customerName.trim(),
    phone: caseRecord.customerPhone.trim(),
    email: normalizeText(caseRecord.customerEmail),
    customer_reference: normalizeText(caseRecord.customerReference),
    latest_notes: normalizeText(caseRecord.internalNotes),
    last_interaction_at: caseRecord.updatedAt,
  };

  if (customerId) {
    const { error } = await supabase
      .from("customers")
      .update(customerPayload)
      .eq("user_id", userId)
      .eq("id", customerId);

    if (error) {
      throw new Error(error.message);
    }

    return customerId;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(customerPayload)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

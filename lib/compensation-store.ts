import {
  COMPENSATION_DEFAULT_CURRENCY,
  DEFAULT_COMPENSATION_FORM_VALUE,
} from "@/lib/compensation-constants";
import type {
  CompensationActivityEntry,
  CompensationCancelPayload,
  CompensationCase,
  CompensationCompletePayload,
  CompensationFormValue,
  CompensationMutationResult,
  CompensationStatus,
} from "@/lib/compensation-types";
import {
  getCompensationStatusLabel,
  isCompensationClaimable,
  isCompensationEditable,
  resolveCompensationStatus,
} from "@/lib/compensation-utils";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trimOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function resolveAssignedOwner(value: string, fallbackOwner: string): string {
  return trimOptionalText(value) ?? fallbackOwner;
}

function toNumericValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function createActivityEntry(
  type: CompensationActivityEntry["type"],
  actor: string,
  timestamp: string,
  note?: string
): CompensationActivityEntry {
  return {
    id: createId(),
    type,
    actor,
    timestamp,
    note: note?.trim() ? note.trim() : undefined,
  };
}

function nextCaseNumber(): string {
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

function mergeStatusActivities(
  activityLog: CompensationActivityEntry[],
  actor: string,
  timestamp: string,
  previousStatus: CompensationStatus,
  nextStatus: CompensationStatus
): CompensationActivityEntry[] {
  if (previousStatus === nextStatus) {
    return activityLog;
  }

  if (nextStatus === "completed") {
    return [
      createActivityEntry("marked_completed", actor, timestamp),
      ...activityLog,
    ];
  }

  if (nextStatus === "cancelled") {
    return [createActivityEntry("cancelled", actor, timestamp), ...activityLog];
  }

  if (nextStatus === "expired") {
    return [createActivityEntry("expired", "System", timestamp), ...activityLog];
  }

  return activityLog;
}

export function buildCompensationFormValue(
  caseRecord?: CompensationCase
): CompensationFormValue {
  if (!caseRecord) {
    return DEFAULT_COMPENSATION_FORM_VALUE;
  }

  return {
    customerName: caseRecord.customerName,
    customerPhone: caseRecord.customerPhone,
    customerEmail: caseRecord.customerEmail ?? "",
    customerReference: caseRecord.customerReference ?? "",
    issueCategory: caseRecord.issueCategory,
    issueDescription: caseRecord.issueDescription,
    relatedProductName: caseRecord.relatedProductName ?? "",
    relatedOrderNumber: caseRecord.relatedOrderNumber ?? "",
    internalNotes: caseRecord.internalNotes ?? "",
    compensationType: caseRecord.compensationType,
    compensationValue:
      caseRecord.compensationValue != null ? String(caseRecord.compensationValue) : "",
    replacementItemName: caseRecord.replacementItemName ?? "",
    giftCardReference: caseRecord.giftCardReference ?? "",
    decisionNote: caseRecord.decisionNote ?? "",
    fulfillmentMode: caseRecord.fulfillmentMode,
    completeImmediately:
      caseRecord.fulfillmentMode === "immediate" &&
      resolveCompensationStatus(caseRecord) === "completed",
    readyState:
      caseRecord.fulfillmentMode === "later_claim" &&
      resolveCompensationStatus(caseRecord) === "ready_for_claim"
        ? "ready_now"
        : "prepare_later",
    readyForClaimAt: caseRecord.readyForClaimAt
      ? caseRecord.readyForClaimAt.slice(0, 16)
      : "",
    expiryDate: caseRecord.expiryDate ? caseRecord.expiryDate.slice(0, 10) : "",
    assignedTo: caseRecord.assignedTo ?? caseRecord.createdBy,
  };
}

export function createCompensationCaseRecord(
  cases: CompensationCase[],
  formValue: CompensationFormValue,
  actor: string
): { nextCases: CompensationCase[]; result: CompensationMutationResult } {
  const timestamp = new Date().toISOString();
  const activityLog: CompensationActivityEntry[] = [
    createActivityEntry("created", actor, timestamp),
  ];

  const caseRecord: CompensationCase = {
    id: createId(),
    caseNumber: nextCaseNumber(),
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor,
    storeId: undefined,
    assignedTo: resolveAssignedOwner(formValue.assignedTo, actor),
    customerName: formValue.customerName.trim(),
    customerPhone: formValue.customerPhone.trim(),
    customerEmail: trimOptionalText(formValue.customerEmail),
    customerReference: trimOptionalText(formValue.customerReference),
    issueCategory: formValue.issueCategory,
    issueDescription: formValue.issueDescription.trim(),
    relatedProductName: trimOptionalText(formValue.relatedProductName),
    relatedOrderNumber: trimOptionalText(formValue.relatedOrderNumber),
    internalNotes: trimOptionalText(formValue.internalNotes),
    compensationType: formValue.compensationType,
    compensationValue: toNumericValue(formValue.compensationValue),
    currency: COMPENSATION_DEFAULT_CURRENCY,
    replacementItemName: trimOptionalText(formValue.replacementItemName),
    giftCardReference: trimOptionalText(formValue.giftCardReference),
    decisionNote: trimOptionalText(formValue.decisionNote),
    fulfillmentMode: formValue.fulfillmentMode,
    activityLog,
    status: "pending",
    readyForClaimAt: undefined,
    claimedAt: undefined,
    completedAt: undefined,
    expiryDate: undefined,
    fulfilledBy: undefined,
    claimNote: undefined,
    archivedAt: undefined,
    cancelledAt: undefined,
    archiveReason: undefined,
  };

  return {
    nextCases: [caseRecord, ...cases],
    result: {
      caseRecord,
      historyMessage: `Opprettet kompensasjonssak ${caseRecord.caseNumber} for ${caseRecord.customerName}.`,
    },
  };
}

export function updateCompensationCaseRecord(
  cases: CompensationCase[],
  caseId: string,
  formValue: CompensationFormValue,
  actor: string
): { nextCases: CompensationCase[]; result: CompensationMutationResult } | null {
  const existing = cases.find((caseRecord) => caseRecord.id === caseId);
  if (!existing) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const previousStatus = resolveCompensationStatus(existing);
  const nextStatus = existing.status;

  const updatedCase: CompensationCase = {
    ...existing,
    updatedAt: timestamp,
    assignedTo: resolveAssignedOwner(
      formValue.assignedTo,
      existing.assignedTo ?? existing.createdBy
    ),
    customerName: formValue.customerName.trim(),
    customerPhone: formValue.customerPhone.trim(),
    customerEmail: trimOptionalText(formValue.customerEmail),
    customerReference: trimOptionalText(formValue.customerReference),
    issueCategory: formValue.issueCategory,
    issueDescription: formValue.issueDescription.trim(),
    relatedProductName: trimOptionalText(formValue.relatedProductName),
    relatedOrderNumber: trimOptionalText(formValue.relatedOrderNumber),
    internalNotes: trimOptionalText(formValue.internalNotes),
    compensationType: formValue.compensationType,
    compensationValue: toNumericValue(formValue.compensationValue),
    replacementItemName: trimOptionalText(formValue.replacementItemName),
    giftCardReference: trimOptionalText(formValue.giftCardReference),
    decisionNote: trimOptionalText(formValue.decisionNote),
    fulfillmentMode: formValue.fulfillmentMode,
    status: existing.status,
    activityLog: mergeStatusActivities(
      [createActivityEntry("updated", actor, timestamp), ...existing.activityLog],
      actor,
      timestamp,
      previousStatus,
      nextStatus
    ),
  };

  return {
    nextCases: cases.map((caseRecord) =>
      caseRecord.id === caseId ? updatedCase : caseRecord
    ),
    result: {
      caseRecord: updatedCase,
      historyMessage: `Oppdaterte kompensasjonssak ${updatedCase.caseNumber} (${getCompensationStatusLabel(nextStatus)}).`,
    },
  };
}

export function completeCompensationCaseRecord(
  cases: CompensationCase[],
  caseId: string,
  payload: CompensationCompletePayload
): { nextCases: CompensationCase[]; result: CompensationMutationResult } | null {
  const existing = cases.find((caseRecord) => caseRecord.id === caseId);
  if (!existing || !isCompensationClaimable(existing)) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const fulfilledBy = payload.fulfilledBy.trim() || "Staff";
  const claimNote = payload.claimNote.trim();
  const updatedCase: CompensationCase = {
    ...existing,
    status: "completed",
    claimedAt: timestamp,
    completedAt: timestamp,
    archivedAt: timestamp,
    fulfilledBy,
    claimNote: claimNote || existing.claimNote,
    updatedAt: timestamp,
    activityLog: [
      createActivityEntry(
        "marked_completed",
        fulfilledBy,
        timestamp,
        claimNote || undefined
      ),
      ...existing.activityLog,
    ],
  };

  return {
    nextCases: cases.map((caseRecord) =>
      caseRecord.id === caseId ? updatedCase : caseRecord
    ),
    result: {
      caseRecord: updatedCase,
      historyMessage: `Lukket kompensasjonssak ${updatedCase.caseNumber}.`,
    },
  };
}

export function cancelCompensationCaseRecord(
  cases: CompensationCase[],
  caseId: string,
  payload: CompensationCancelPayload
): { nextCases: CompensationCase[]; result: CompensationMutationResult } | null {
  const existing = cases.find((caseRecord) => caseRecord.id === caseId);
  if (!existing || !isCompensationEditable(existing)) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const archiveReason = payload.archiveReason.trim();
  const updatedCase: CompensationCase = {
    ...existing,
    status: "completed",
    cancelledAt: undefined,
    archivedAt: timestamp,
    completedAt: existing.completedAt ?? timestamp,
    archiveReason: archiveReason || "Lukket",
    updatedAt: timestamp,
    activityLog: [
      createActivityEntry(
        "cancelled",
        payload.actor.trim() || "Staff",
        timestamp,
        archiveReason || undefined
      ),
      ...existing.activityLog,
    ],
  };

  return {
    nextCases: cases.map((caseRecord) =>
      caseRecord.id === caseId ? updatedCase : caseRecord
    ),
    result: {
      caseRecord: updatedCase,
      historyMessage: `Lukket kompensasjonssak ${updatedCase.caseNumber}.`,
    },
  };
}

export function reopenCompensationCaseRecord(
  cases: CompensationCase[],
  caseId: string,
  actor: string
): { nextCases: CompensationCase[]; result: CompensationMutationResult } | null {
  const existing = cases.find((caseRecord) => caseRecord.id === caseId);
  if (!existing) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const updatedCase: CompensationCase = {
    ...existing,
    status: "pending",
    updatedAt: timestamp,
    archivedAt: undefined,
    completedAt: undefined,
    claimedAt: undefined,
    fulfilledBy: undefined,
    claimNote: undefined,
    cancelledAt: undefined,
    archiveReason: undefined,
    activityLog: [createActivityEntry("updated", actor, timestamp, "Case reopened"), ...existing.activityLog],
  };

  return {
    nextCases: cases.map((caseRecord) =>
      caseRecord.id === caseId ? updatedCase : caseRecord
    ),
    result: {
      caseRecord: updatedCase,
      historyMessage: `Gjenåpnet kompensasjonssak ${updatedCase.caseNumber}.`,
    },
  };
}

export function deleteCompensationCaseRecord(
  cases: CompensationCase[],
  caseId: string
): { nextCases: CompensationCase[]; result: CompensationMutationResult } | null {
  const existing = cases.find((caseRecord) => caseRecord.id === caseId);
  if (!existing) {
    return null;
  }

  return {
    nextCases: cases.filter((caseRecord) => caseRecord.id !== caseId),
    result: {
      caseRecord: existing,
      historyMessage: `Slettet kompensasjonssak ${existing.caseNumber}.`,
    },
  };
}

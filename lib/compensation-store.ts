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
  CompensationReadyState,
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

function toOptionalIsoString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const timestamp = new Date(trimmed);
  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }

  return timestamp.toISOString();
}

function toNumericValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function addDays(value: Date, amount: number): Date {
  const next = new Date(value.getTime());
  next.setDate(next.getDate() + amount);
  return next;
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

function buildLaterClaimStatus(readyState: CompensationReadyState): CompensationStatus {
  return readyState === "ready_now" ? "ready_for_claim" : "pending";
}

function buildInitialLifecycle(
  formValue: CompensationFormValue,
  actor: string,
  timestamp: string
): Pick<
  CompensationCase,
  | "status"
  | "readyForClaimAt"
  | "claimedAt"
  | "completedAt"
  | "expiryDate"
  | "fulfilledBy"
  | "claimNote"
  | "archivedAt"
  | "cancelledAt"
  | "archiveReason"
> {
  if (formValue.fulfillmentMode === "immediate") {
    if (formValue.completeImmediately) {
      return {
        status: "completed",
        readyForClaimAt: undefined,
        claimedAt: timestamp,
        completedAt: timestamp,
        expiryDate: undefined,
        fulfilledBy: actor,
        claimNote: undefined,
        archivedAt: timestamp,
        cancelledAt: undefined,
        archiveReason: undefined,
      };
    }

    return {
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
  }

  const expiryDate =
    toOptionalIsoString(formValue.expiryDate) ??
    addDays(new Date(timestamp), 30).toISOString();

  const readyForClaimAt =
    formValue.readyState === "ready_now"
      ? toOptionalIsoString(formValue.readyForClaimAt) ?? timestamp
      : toOptionalIsoString(formValue.readyForClaimAt);

  return {
    status: buildLaterClaimStatus(formValue.readyState),
    readyForClaimAt,
    claimedAt: undefined,
    completedAt: undefined,
    expiryDate,
    fulfilledBy: undefined,
    claimNote: undefined,
    archivedAt: undefined,
    cancelledAt: undefined,
    archiveReason: undefined,
  };
}

function nextCaseNumber(cases: CompensationCase[]): string {
  const nextNumber =
    Math.max(
      1000,
      ...cases.map((caseRecord) => {
        const match = caseRecord.caseNumber.match(/(\d+)$/);
        return match ? Number(match[1]) : 1000;
      })
    ) + 1;

  return `COMP-${nextNumber}`;
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

  if (nextStatus === "ready_for_claim") {
    return [
      createActivityEntry("marked_ready_for_claim", actor, timestamp),
      ...activityLog,
    ];
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
  const lifecycle = buildInitialLifecycle(formValue, actor, timestamp);
  const activityLog: CompensationActivityEntry[] = [
    createActivityEntry("created", actor, timestamp),
  ];

  if (lifecycle.status === "ready_for_claim") {
    activityLog.unshift(createActivityEntry("marked_ready_for_claim", actor, timestamp));
  }

  if (lifecycle.status === "completed") {
    activityLog.unshift(createActivityEntry("marked_completed", actor, timestamp));
  }

  const caseRecord: CompensationCase = {
    id: createId(),
    caseNumber: nextCaseNumber(cases),
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
    ...lifecycle,
  };

  return {
    nextCases: [caseRecord, ...cases],
    result: {
      caseRecord,
      historyMessage: `Created compensation case ${caseRecord.caseNumber} for ${caseRecord.customerName}.`,
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
  const lifecycle = buildInitialLifecycle(formValue, actor, timestamp);
  const nextStatus = lifecycle.status;

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
    status: lifecycle.status,
    readyForClaimAt: lifecycle.readyForClaimAt,
    claimedAt: lifecycle.claimedAt,
    completedAt: lifecycle.completedAt,
    expiryDate: lifecycle.expiryDate,
    fulfilledBy: lifecycle.fulfilledBy,
    claimNote: lifecycle.claimNote,
    archivedAt: lifecycle.archivedAt,
    cancelledAt: lifecycle.cancelledAt,
    archiveReason: lifecycle.archiveReason,
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
      historyMessage: `Updated compensation case ${updatedCase.caseNumber} (${getCompensationStatusLabel(nextStatus)}).`,
    },
  };
}

export function markCompensationCaseReadyForClaim(
  cases: CompensationCase[],
  caseId: string,
  actor: string
): { nextCases: CompensationCase[]; result: CompensationMutationResult } | null {
  const existing = cases.find((caseRecord) => caseRecord.id === caseId);
  if (
    !existing ||
    !isCompensationEditable(existing) ||
    existing.fulfillmentMode !== "later_claim"
  ) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const updatedCase: CompensationCase = {
    ...existing,
    status: "ready_for_claim",
    readyForClaimAt: existing.readyForClaimAt ?? timestamp,
    updatedAt: timestamp,
    activityLog: [
      createActivityEntry("marked_ready_for_claim", actor, timestamp),
      ...existing.activityLog,
    ],
  };

  return {
    nextCases: cases.map((caseRecord) =>
      caseRecord.id === caseId ? updatedCase : caseRecord
    ),
    result: {
      caseRecord: updatedCase,
      historyMessage: `Marked ${updatedCase.caseNumber} ready for claim.`,
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
      historyMessage: `Completed compensation case ${updatedCase.caseNumber}.`,
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
    status: "cancelled",
    cancelledAt: timestamp,
    archivedAt: timestamp,
    archiveReason: archiveReason || "Cancelled",
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
      historyMessage: `Cancelled compensation case ${updatedCase.caseNumber}.`,
    },
  };
}

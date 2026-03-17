import {
  COMPENSATION_DEFAULT_CURRENCY,
  COMPENSATION_STORAGE_KEY,
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
  getCompensationClosedAt,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function normalizeStatus(value: unknown): CompensationStatus {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "ready_for_claim" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "expired"
  ) {
    return value;
  }

  return "pending";
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

function normalizeActivityEntry(value: unknown): CompensationActivityEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const type =
    value.type === "created" ||
    value.type === "updated" ||
    value.type === "marked_ready_for_claim" ||
    value.type === "marked_completed" ||
    value.type === "cancelled" ||
    value.type === "expired"
      ? value.type
      : "updated";

  return {
    id: toText(value.id, createId()),
    type,
    timestamp: toText(value.timestamp, new Date().toISOString()),
    actor: toText(value.actor, "Staff"),
    note: toOptionalText(value.note),
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

function syncCaseLifecycle(caseRecord: CompensationCase): CompensationCase {
  const resolvedStatus = resolveCompensationStatus(caseRecord);
  if (resolvedStatus === caseRecord.status) {
    return caseRecord;
  }

  if (resolvedStatus !== "expired") {
    return caseRecord;
  }

  const archivedAt = getCompensationClosedAt(
    {
      ...caseRecord,
      status: resolvedStatus,
    },
    new Date()
  );

  const alreadyExpired = caseRecord.activityLog.some(
    (entry) => entry.type === "expired"
  );

  return {
    ...caseRecord,
    status: "expired",
    archivedAt: archivedAt ?? caseRecord.expiryDate,
    activityLog: alreadyExpired
      ? caseRecord.activityLog
      : [
          {
            id: `${caseRecord.id}-expired`,
            type: "expired",
            timestamp: caseRecord.expiryDate ?? new Date().toISOString(),
            actor: "System",
          },
          ...caseRecord.activityLog,
        ],
  };
}

function normalizeCase(value: unknown): CompensationCase | null {
  if (!isRecord(value)) {
    return null;
  }

  const activityLog = Array.isArray(value.activityLog)
    ? value.activityLog.flatMap((entry) => {
        const normalized = normalizeActivityEntry(entry);
        return normalized ? [normalized] : [];
      })
    : [];

  return syncCaseLifecycle({
    id: toText(value.id, createId()),
    caseNumber: toText(value.caseNumber, "COMP-1001"),
    createdAt: toText(value.createdAt, new Date().toISOString()),
    updatedAt: toText(value.updatedAt, new Date().toISOString()),
    createdBy: toText(value.createdBy, "Staff"),
    storeId: toOptionalText(value.storeId),
    assignedTo: toOptionalText(value.assignedTo),
    customerName: toText(value.customerName),
    customerPhone: toText(value.customerPhone),
    customerEmail: toOptionalText(value.customerEmail),
    customerReference: toOptionalText(value.customerReference),
    issueCategory:
      value.issueCategory === "wrong_item" ||
      value.issueCategory === "damaged_item" ||
      value.issueCategory === "quality_issue" ||
      value.issueCategory === "missing_item" ||
      value.issueCategory === "service_issue" ||
      value.issueCategory === "delay" ||
      value.issueCategory === "other"
        ? value.issueCategory
        : "other",
    issueDescription: toText(value.issueDescription),
    relatedProductName: toOptionalText(value.relatedProductName),
    relatedOrderNumber: toOptionalText(value.relatedOrderNumber),
    internalNotes: toOptionalText(value.internalNotes),
    compensationType:
      value.compensationType === "gift_card" ||
      value.compensationType === "replacement_product" ||
      value.compensationType === "immediate_fix" ||
      value.compensationType === "store_credit" ||
      value.compensationType === "other"
        ? value.compensationType
        : "other",
    compensationValue: toNullableNumber(value.compensationValue),
    currency: "NOK",
    replacementItemName: toOptionalText(value.replacementItemName),
    giftCardReference: toOptionalText(value.giftCardReference),
    decisionNote: toOptionalText(value.decisionNote),
    fulfillmentMode: value.fulfillmentMode === "immediate" ? "immediate" : "later_claim",
    status: normalizeStatus(value.status),
    readyForClaimAt: toOptionalText(value.readyForClaimAt),
    claimedAt: toOptionalText(value.claimedAt),
    completedAt: toOptionalText(value.completedAt),
    expiryDate: toOptionalText(value.expiryDate),
    fulfilledBy: toOptionalText(value.fulfilledBy),
    claimNote: toOptionalText(value.claimNote),
    archivedAt: toOptionalText(value.archivedAt),
    cancelledAt: toOptionalText(value.cancelledAt),
    archiveReason: toOptionalText(value.archiveReason),
    activityLog,
  });
}

function createSeedCases(): CompensationCase[] {
  const now = new Date();
  const addHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);
  const subtractDays = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const toIso = (value: Date) => value.toISOString();

  const firstCompletedAt = toIso(subtractDays(2));
  const secondCreatedAt = toIso(subtractDays(1));
  const secondReadyAt = toIso(addHours(4));
  const secondExpiryAt = toIso(addHours(24 * 20));
  const thirdCreatedAt = toIso(subtractDays(7));
  const thirdExpiredAt = toIso(subtractDays(1));
  const fourthCancelledAt = toIso(subtractDays(4));
  const fifthCreatedAt = toIso(subtractDays(3));

  return [
    {
      id: "comp-seed-1",
      caseNumber: "COMP-1001",
      createdAt: firstCompletedAt,
      updatedAt: firstCompletedAt,
      createdBy: "Manager",
      customerName: "Maria Johansen",
      customerPhone: "988 44 210",
      customerEmail: "maria@example.com",
      customerReference: "ORD-44110",
      issueCategory: "quality_issue",
      issueDescription: "Cold pizza delivered after a long wait.",
      relatedProductName: "Large Pepperoni",
      relatedOrderNumber: "44110",
      internalNotes: "Customer called same evening and shared receipt photo.",
      compensationType: "gift_card",
      compensationValue: 150,
      currency: "NOK",
      giftCardReference: "GC-8841",
      decisionNote: "Issued immediately at pickup.",
      fulfillmentMode: "immediate",
      status: "completed",
      claimedAt: firstCompletedAt,
      completedAt: firstCompletedAt,
      fulfilledBy: "Manager",
      archivedAt: firstCompletedAt,
      activityLog: [
        {
          id: "comp-seed-1-complete",
          type: "marked_completed",
          timestamp: firstCompletedAt,
          actor: "Manager",
        },
        {
          id: "comp-seed-1-created",
          type: "created",
          timestamp: firstCompletedAt,
          actor: "Manager",
        },
      ],
    },
    {
      id: "comp-seed-2",
      caseNumber: "COMP-1002",
      createdAt: secondCreatedAt,
      updatedAt: secondCreatedAt,
      createdBy: "Staff",
      assignedTo: "Dennis",
      customerName: "Isak Berg",
      customerPhone: "909 22 713",
      customerReference: "ORD-44178",
      issueCategory: "wrong_item",
      issueDescription: "Received the wrong pizza and needs a replacement product.",
      relatedProductName: "Medium Vesuvio",
      relatedOrderNumber: "44178",
      internalNotes: "Customer will return after work.",
      compensationType: "replacement_product",
      compensationValue: null,
      currency: "NOK",
      replacementItemName: "Medium Vesuvio",
      decisionNote: "Replacement promised for later collection.",
      fulfillmentMode: "later_claim",
      status: "ready_for_claim",
      readyForClaimAt: secondReadyAt,
      expiryDate: secondExpiryAt,
      activityLog: [
        {
          id: "comp-seed-2-ready",
          type: "marked_ready_for_claim",
          timestamp: secondCreatedAt,
          actor: "Staff",
        },
        {
          id: "comp-seed-2-created",
          type: "created",
          timestamp: secondCreatedAt,
          actor: "Staff",
        },
      ],
    },
    {
      id: "comp-seed-3",
      caseNumber: "COMP-1003",
      createdAt: thirdCreatedAt,
      updatedAt: thirdExpiredAt,
      createdBy: "Staff",
      assignedTo: "Evening shift",
      customerName: "Lina Aas",
      customerPhone: "954 10 221",
      issueCategory: "missing_item",
      issueDescription: "Customer never returned to collect the promised replacement meal.",
      relatedOrderNumber: "ORD-44202",
      compensationType: "replacement_product",
      compensationValue: null,
      currency: "NOK",
      replacementItemName: "Medium Margherita",
      decisionNote: "Held for pickup until expiry date.",
      fulfillmentMode: "later_claim",
      status: "ready_for_claim",
      readyForClaimAt: toIso(subtractDays(6)),
      expiryDate: thirdExpiredAt,
      activityLog: [
        {
          id: "comp-seed-3-ready",
          type: "marked_ready_for_claim",
          timestamp: toIso(subtractDays(6)),
          actor: "Staff",
        },
        {
          id: "comp-seed-3-created",
          type: "created",
          timestamp: thirdCreatedAt,
          actor: "Staff",
        },
      ],
    },
    {
      id: "comp-seed-4",
      caseNumber: "COMP-1004",
      createdAt: fourthCancelledAt,
      updatedAt: fourthCancelledAt,
      createdBy: "Manager",
      customerName: "Thomas Nilsen",
      customerPhone: "971 67 900",
      issueCategory: "service_issue",
      issueDescription: "Requested reimbursement after duplicate complaint resolution.",
      internalNotes: "Resolved through refund in POS, no extra case needed.",
      compensationType: "other",
      compensationValue: null,
      currency: "NOK",
      decisionNote: "Duplicate case closed.",
      fulfillmentMode: "later_claim",
      status: "cancelled",
      cancelledAt: fourthCancelledAt,
      archivedAt: fourthCancelledAt,
      archiveReason: "Resolved outside compensation workflow.",
      activityLog: [
        {
          id: "comp-seed-4-cancel",
          type: "cancelled",
          timestamp: fourthCancelledAt,
          actor: "Manager",
          note: "Resolved outside compensation workflow.",
        },
        {
          id: "comp-seed-4-created",
          type: "created",
          timestamp: fourthCancelledAt,
          actor: "Manager",
        },
      ],
    },
    {
      id: "comp-seed-5",
      caseNumber: "COMP-1005",
      createdAt: fifthCreatedAt,
      updatedAt: fifthCreatedAt,
      createdBy: "Staff",
      assignedTo: "Day shift",
      customerName: "Sara Eide",
      customerPhone: "915 33 449",
      customerReference: "ORD-44310",
      issueCategory: "delay",
      issueDescription: "Customer was promised store credit after a delayed pickup order.",
      relatedOrderNumber: "44310",
      internalNotes: "Credit needs manager approval before release.",
      compensationType: "store_credit",
      compensationValue: 100,
      currency: "NOK",
      decisionNote: "Pending until store credit is added in POS.",
      fulfillmentMode: "later_claim",
      status: "pending",
      expiryDate: secondExpiryAt,
      activityLog: [
        {
          id: "comp-seed-5-created",
          type: "created",
          timestamp: fifthCreatedAt,
          actor: "Staff",
        },
      ],
    },
  ];
}

export function loadCompensationCases(): CompensationCase[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = localStorage.getItem(COMPENSATION_STORAGE_KEY);
  if (!stored) {
    const seededCases = createSeedCases().map(syncCaseLifecycle);
    saveCompensationCases(seededCases);
    return seededCases;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedCases = parsed.flatMap((entry) => {
      const normalized = normalizeCase(entry);
      return normalized ? [normalized] : [];
    });

    const syncedCases = normalizedCases.map(syncCaseLifecycle);
    if (JSON.stringify(syncedCases) !== JSON.stringify(normalizedCases)) {
      saveCompensationCases(syncedCases);
    }

    return syncedCases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    const seededCases = createSeedCases().map(syncCaseLifecycle);
    saveCompensationCases(seededCases);
    return seededCases;
  }
}

export function saveCompensationCases(cases: CompensationCase[]): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(COMPENSATION_STORAGE_KEY, JSON.stringify(cases));
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

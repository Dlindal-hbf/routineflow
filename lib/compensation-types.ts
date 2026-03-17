import type { DateKey } from "@/types/calendar";

export type CompensationStatus =
  | "pending"
  | "approved"
  | "ready_for_claim"
  | "completed"
  | "cancelled"
  | "expired";

export type CompensationFulfillmentMode = "immediate" | "later_claim";

export type CompensationType =
  | "gift_card"
  | "replacement_product"
  | "immediate_fix"
  | "store_credit"
  | "other";

export type CompensationIssueCategory =
  | "wrong_item"
  | "damaged_item"
  | "quality_issue"
  | "missing_item"
  | "service_issue"
  | "delay"
  | "other";

export type CompensationActivityType =
  | "created"
  | "updated"
  | "marked_ready_for_claim"
  | "marked_completed"
  | "cancelled"
  | "expired";

export type CompensationTab =
  | "all"
  | "active"
  | "ready_for_claim"
  | "completed"
  | "archive";

export type CompensationSortKey =
  | "newest"
  | "oldest"
  | "customer_name"
  | "ready_for_claim"
  | "last_updated";

export type CompensationDateFilter =
  | "all_time"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days";

export type CompensationReadyState = "ready_now" | "prepare_later";

export interface CompensationActivityEntry {
  id: string;
  type: CompensationActivityType;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface CompensationCase {
  id: string;
  caseNumber: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  storeId?: string;
  assignedTo?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerReference?: string;
  issueCategory: CompensationIssueCategory;
  issueDescription: string;
  relatedProductName?: string;
  relatedOrderNumber?: string;
  internalNotes?: string;
  compensationType: CompensationType;
  compensationValue: number | null;
  currency: "NOK";
  replacementItemName?: string;
  giftCardReference?: string;
  decisionNote?: string;
  fulfillmentMode: CompensationFulfillmentMode;
  status: CompensationStatus;
  readyForClaimAt?: string;
  claimedAt?: string;
  completedAt?: string;
  expiryDate?: string;
  fulfilledBy?: string;
  claimNote?: string;
  archivedAt?: string;
  cancelledAt?: string;
  archiveReason?: string;
  activityLog: CompensationActivityEntry[];
}

export interface CompensationFormValue {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerReference: string;
  issueCategory: CompensationIssueCategory;
  issueDescription: string;
  relatedProductName: string;
  relatedOrderNumber: string;
  internalNotes: string;
  compensationType: CompensationType;
  compensationValue: string;
  replacementItemName: string;
  giftCardReference: string;
  decisionNote: string;
  fulfillmentMode: CompensationFulfillmentMode;
  completeImmediately: boolean;
  readyState: CompensationReadyState;
  readyForClaimAt: string;
  expiryDate: string;
  assignedTo: string;
}

export interface CompensationCompletePayload {
  fulfilledBy: string;
  claimNote: string;
}

export interface CompensationCancelPayload {
  actor: string;
  archiveReason: string;
}

export interface CompensationCaseFilters {
  query: string;
  status: CompensationStatus | "all";
  compensationType: CompensationType | "all";
  issueCategory: CompensationIssueCategory | "all";
  dateRange: CompensationDateFilter;
}

export interface CompensationArchiveDay {
  dayKey: DateKey;
  cases: CompensationCase[];
}

export interface CompensationMutationResult {
  caseRecord: CompensationCase;
  historyMessage: string;
}

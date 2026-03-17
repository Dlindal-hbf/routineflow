import type {
  CompensationDateFilter,
  CompensationFormValue,
  CompensationIssueCategory,
  CompensationSortKey,
  CompensationStatus,
  CompensationTab,
  CompensationType,
} from "@/lib/compensation-types";

export const COMPENSATION_STORAGE_KEY = "compensationCases.v1";
export const COMPENSATION_HISTORY_TIMEZONE = "Europe/Oslo";
export const COMPENSATION_DEFAULT_CURRENCY = "NOK";

export const COMPENSATION_TABS: Array<{ value: CompensationTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "ready_for_claim", label: "Ready for claim" },
  { value: "completed", label: "Completed" },
  { value: "archive", label: "Archive" },
];

export const COMPENSATION_STATUSES: CompensationStatus[] = [
  "pending",
  "approved",
  "ready_for_claim",
  "completed",
  "cancelled",
  "expired",
];

export const COMPENSATION_STATUS_LABELS: Record<CompensationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  ready_for_claim: "Ready for claim",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const COMPENSATION_STATUS_BADGE_CLASS_NAMES: Record<
  CompensationStatus,
  string
> = {
  pending: "border-slate-200 bg-slate-100 text-slate-700",
  approved: "border-primary/20 bg-primary/10 text-primary",
  ready_for_claim: "border-accent/40 bg-accent/20 text-accent-foreground",
  completed: "border-primary/15 bg-primary/10 text-primary",
  cancelled: "border-red-200 bg-red-50 text-red-600",
  expired: "border-slate-300 bg-slate-100 text-slate-600",
};

export const COMPENSATION_STATUS_TONE_CLASS_NAMES: Record<
  CompensationStatus,
  string
> = {
  pending: "bg-slate-400",
  approved: "bg-primary",
  ready_for_claim: "bg-accent-gold",
  completed: "bg-primary",
  cancelled: "bg-red-500",
  expired: "bg-slate-500",
};

export const COMPENSATION_TYPES: CompensationType[] = [
  "gift_card",
  "replacement_product",
  "immediate_fix",
  "store_credit",
  "other",
];

export const COMPENSATION_TYPE_LABELS: Record<CompensationType, string> = {
  gift_card: "Gift card",
  replacement_product: "Replacement product",
  immediate_fix: "Immediate fix",
  store_credit: "Store credit",
  other: "Other",
};

export const COMPENSATION_TYPE_TONE_CLASS_NAMES: Record<CompensationType, string> =
  {
    gift_card: "bg-accent-gold",
    replacement_product: "bg-primary",
    immediate_fix: "bg-emerald-500",
    store_credit: "bg-sky-500",
    other: "bg-slate-400",
  };

export const COMPENSATION_ISSUE_CATEGORIES: CompensationIssueCategory[] = [
  "wrong_item",
  "damaged_item",
  "quality_issue",
  "missing_item",
  "service_issue",
  "delay",
  "other",
];

export const COMPENSATION_ISSUE_CATEGORY_LABELS: Record<
  CompensationIssueCategory,
  string
> = {
  wrong_item: "Wrong item",
  damaged_item: "Damaged item",
  quality_issue: "Quality issue",
  missing_item: "Missing item",
  service_issue: "Service issue",
  delay: "Delay",
  other: "Other",
};

export const COMPENSATION_ISSUE_CATEGORY_TONE_CLASS_NAMES: Record<
  CompensationIssueCategory,
  string
> = {
  wrong_item: "bg-sky-500",
  damaged_item: "bg-amber-500",
  quality_issue: "bg-primary",
  missing_item: "bg-slate-500",
  service_issue: "bg-violet-500",
  delay: "bg-orange-500",
  other: "bg-slate-400",
};

export const COMPENSATION_DATE_FILTER_OPTIONS: Array<{
  value: CompensationDateFilter;
  label: string;
}> = [
  { value: "all_time", label: "All time" },
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
];

export const COMPENSATION_SORT_OPTIONS: Array<{
  value: CompensationSortKey;
  label: string;
}> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "customer_name", label: "Customer name" },
  { value: "ready_for_claim", label: "Ready for claim" },
  { value: "last_updated", label: "Last updated" },
];

export const DEFAULT_COMPENSATION_FORM_VALUE: CompensationFormValue = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerReference: "",
  issueCategory: "wrong_item",
  issueDescription: "",
  relatedProductName: "",
  relatedOrderNumber: "",
  internalNotes: "",
  compensationType: "gift_card",
  compensationValue: "",
  replacementItemName: "",
  giftCardReference: "",
  decisionNote: "",
  fulfillmentMode: "later_claim",
  completeImmediately: true,
  readyState: "ready_now",
  readyForClaimAt: "",
  expiryDate: "",
  assignedTo: "",
};

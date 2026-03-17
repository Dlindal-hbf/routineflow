import {
  getDateKeyFromTimestamp,
  getTodayDateKey,
} from "@/lib/date-utils";
import {
  COMPENSATION_DEFAULT_CURRENCY,
  COMPENSATION_HISTORY_TIMEZONE,
  COMPENSATION_ISSUE_CATEGORY_LABELS,
  COMPENSATION_STATUS_BADGE_CLASS_NAMES,
  COMPENSATION_STATUS_LABELS,
  COMPENSATION_TYPE_LABELS,
} from "@/lib/compensation-constants";
import type {
  CompensationActivityEntry,
  CompensationCase,
  CompensationCaseFilters,
  CompensationDateFilter,
  CompensationIssueCategory,
  CompensationSortKey,
  CompensationStatus,
  CompensationTab,
  CompensationType,
} from "@/lib/compensation-types";

function parseTimestamp(value?: string): number {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().trim();
}

function normalizeCompactSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePhoneSearchValue(value: string): string {
  return value.replace(/\D/g, "");
}

function resolveReferenceTimestamp(
  caseRecord: CompensationCase,
  useClosedAt: boolean,
  now: Date
): string {
  if (useClosedAt) {
    return getCompensationClosedAt(caseRecord, now) ?? caseRecord.updatedAt;
  }

  return caseRecord.createdAt;
}

function matchesDateRange(
  caseRecord: CompensationCase,
  dateRange: CompensationDateFilter,
  useClosedAt: boolean,
  now: Date
): boolean {
  if (dateRange === "all_time") {
    return true;
  }

  const referenceTimestamp = resolveReferenceTimestamp(caseRecord, useClosedAt, now);
  const referenceTime = parseTimestamp(referenceTimestamp);
  if (Number.isNaN(referenceTime)) {
    return false;
  }

  if (dateRange === "today") {
    return (
      getDateKeyFromTimestamp(referenceTimestamp, {
        timeZone: COMPENSATION_HISTORY_TIMEZONE,
      }) === getTodayDateKey(COMPENSATION_HISTORY_TIMEZONE)
    );
  }

  const dayCount =
    dateRange === "last_7_days"
      ? 7
      : dateRange === "last_30_days"
      ? 30
      : 90;

  return referenceTime >= now.getTime() - dayCount * 24 * 60 * 60 * 1000;
}

export function getCompensationStatusLabel(status: CompensationStatus): string {
  return COMPENSATION_STATUS_LABELS[status];
}

export function getCompensationStatusBadgeClassName(
  status: CompensationStatus
): string {
  return COMPENSATION_STATUS_BADGE_CLASS_NAMES[status];
}

export function getCompensationTypeLabel(type: CompensationType): string {
  return COMPENSATION_TYPE_LABELS[type];
}

export function getCompensationIssueCategoryLabel(
  issueCategory: CompensationIssueCategory
): string {
  return COMPENSATION_ISSUE_CATEGORY_LABELS[issueCategory];
}

export function getCompensationClosedAt(
  caseRecord: CompensationCase,
  now: Date = new Date()
): string | undefined {
  const resolvedStatus = resolveCompensationStatus(caseRecord, now);

  if (caseRecord.archivedAt) {
    return caseRecord.archivedAt;
  }

  if (resolvedStatus === "completed") {
    return caseRecord.completedAt;
  }

  if (resolvedStatus === "cancelled") {
    return caseRecord.cancelledAt;
  }

  if (resolvedStatus === "expired") {
    return caseRecord.expiryDate;
  }

  return undefined;
}

export function resolveCompensationStatus(
  caseRecord: CompensationCase,
  now: Date = new Date()
): CompensationStatus {
  if (
    (caseRecord.status === "completed" && caseRecord.completedAt) ||
    caseRecord.status === "cancelled" ||
    caseRecord.status === "expired"
  ) {
    return caseRecord.status;
  }

  if (caseRecord.expiryDate) {
    const expiryTime = parseTimestamp(caseRecord.expiryDate);
    if (!Number.isNaN(expiryTime) && expiryTime < now.getTime()) {
      return "expired";
    }
  }

  return caseRecord.status;
}

export function isCompensationArchived(
  caseRecord: CompensationCase,
  now: Date = new Date()
): boolean {
  const resolvedStatus = resolveCompensationStatus(caseRecord, now);
  return (
    resolvedStatus === "completed" ||
    resolvedStatus === "cancelled" ||
    resolvedStatus === "expired"
  );
}

export function isCompensationClaimable(
  caseRecord: CompensationCase,
  now: Date = new Date()
): boolean {
  if (resolveCompensationStatus(caseRecord, now) !== "ready_for_claim") {
    return false;
  }

  if (!caseRecord.readyForClaimAt) {
    return true;
  }

  const readyTime = parseTimestamp(caseRecord.readyForClaimAt);
  if (Number.isNaN(readyTime)) {
    return true;
  }

  return readyTime <= now.getTime();
}

export function isCompensationEditable(
  caseRecord: CompensationCase,
  now: Date = new Date()
): boolean {
  return !isCompensationArchived(caseRecord, now);
}

export function getCompensationAssignedOwner(caseRecord: CompensationCase): string {
  return caseRecord.assignedTo || caseRecord.createdBy;
}

export function isCompensationOverdue(
  caseRecord: CompensationCase,
  now: Date = new Date()
): boolean {
  return resolveCompensationStatus(caseRecord, now) === "expired";
}

export function buildCompensationSearchText(caseRecord: CompensationCase): string {
  const fullText = [
    caseRecord.caseNumber,
    caseRecord.customerName,
    caseRecord.customerPhone,
    caseRecord.customerEmail,
    caseRecord.customerReference,
    caseRecord.issueDescription,
    caseRecord.relatedProductName,
    caseRecord.relatedOrderNumber,
    caseRecord.replacementItemName,
    caseRecord.giftCardReference,
    caseRecord.internalNotes,
    caseRecord.decisionNote,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    normalizeSearchValue(fullText),
    normalizeCompactSearchValue(fullText),
    normalizePhoneSearchValue(fullText),
  ].join(" ");
}

export function formatCompensationValue(
  value: number | null,
  currency: string = COMPENSATION_DEFAULT_CURRENCY
): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getCompensationSummary(caseRecord: CompensationCase): string {
  const typeLabel = getCompensationTypeLabel(caseRecord.compensationType);
  const formattedValue = formatCompensationValue(
    caseRecord.compensationValue,
    caseRecord.currency
  );

  if (caseRecord.compensationType === "replacement_product") {
    return caseRecord.replacementItemName
      ? `${typeLabel}: ${caseRecord.replacementItemName}`
      : typeLabel;
  }

  if (caseRecord.compensationType === "gift_card") {
    if (caseRecord.giftCardReference && formattedValue) {
      return `${typeLabel}: ${formattedValue} (${caseRecord.giftCardReference})`;
    }

    return formattedValue ? `${typeLabel}: ${formattedValue}` : typeLabel;
  }

  return formattedValue ? `${typeLabel}: ${formattedValue}` : typeLabel;
}

export function getCompensationActivityLabel(
  activity: CompensationActivityEntry
): string {
  switch (activity.type) {
    case "created":
      return "Case created";
    case "updated":
      return "Case updated";
    case "marked_ready_for_claim":
      return "Marked ready for claim";
    case "marked_completed":
      return "Marked completed";
    case "cancelled":
      return "Case cancelled";
    case "expired":
      return "Case expired";
    default:
      return "Updated";
  }
}

export function filterCompensationCases(
  cases: CompensationCase[],
  filters: CompensationCaseFilters,
  options?: { useClosedAt?: boolean; now?: Date }
): CompensationCase[] {
  const { useClosedAt = false, now = new Date() } = options ?? {};
  const normalizedQuery = normalizeSearchValue(filters.query);
  const compactQuery = normalizeCompactSearchValue(filters.query);
  const phoneQuery = normalizePhoneSearchValue(filters.query);

  return cases.filter((caseRecord) => {
    const resolvedStatus = resolveCompensationStatus(caseRecord, now);
    const searchableText = buildCompensationSearchText(caseRecord);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      searchableText.includes(normalizedQuery) ||
      (compactQuery.length > 0 && searchableText.includes(compactQuery)) ||
      (phoneQuery.length > 0 && searchableText.includes(phoneQuery));

    const matchesStatus =
      filters.status === "all" || resolvedStatus === filters.status;
    const matchesType =
      filters.compensationType === "all" ||
      caseRecord.compensationType === filters.compensationType;
    const matchesIssueCategory =
      filters.issueCategory === "all" ||
      caseRecord.issueCategory === filters.issueCategory;
    const matchesDate = matchesDateRange(
      caseRecord,
      filters.dateRange,
      useClosedAt,
      now
    );

    return (
      matchesQuery && matchesStatus && matchesType && matchesIssueCategory && matchesDate
    );
  });
}

export function sortCompensationCases(
  cases: CompensationCase[],
  sortKey: CompensationSortKey,
  now: Date = new Date()
): CompensationCase[] {
  return [...cases].sort((a, b) => {
    if (sortKey === "customer_name") {
      return a.customerName.localeCompare(b.customerName, "nb-NO");
    }

    if (sortKey === "ready_for_claim") {
      const aTime = parseTimestamp(a.readyForClaimAt);
      const bTime = parseTimestamp(b.readyForClaimAt);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
        return -1;
      }
      return aTime - bTime;
    }

    const aValue =
      sortKey === "oldest"
        ? parseTimestamp(a.createdAt)
        : sortKey === "last_updated"
        ? parseTimestamp(a.updatedAt)
        : parseTimestamp(getCompensationClosedAt(a, now) ?? a.createdAt);
    const bValue =
      sortKey === "oldest"
        ? parseTimestamp(b.createdAt)
        : sortKey === "last_updated"
        ? parseTimestamp(b.updatedAt)
        : parseTimestamp(getCompensationClosedAt(b, now) ?? b.createdAt);

    if (sortKey === "oldest") {
      return aValue - bValue;
    }

    return bValue - aValue;
  });
}

export function selectActiveCompensationCases(
  cases: CompensationCase[],
  now: Date = new Date()
): CompensationCase[] {
  return cases.filter((caseRecord) => !isCompensationArchived(caseRecord, now));
}

export function selectReadyForClaimCompensationCases(
  cases: CompensationCase[],
  now: Date = new Date()
): CompensationCase[] {
  return cases.filter(
    (caseRecord) => resolveCompensationStatus(caseRecord, now) === "ready_for_claim"
  );
}

export function selectCompletedCompensationCases(
  cases: CompensationCase[],
  now: Date = new Date()
): CompensationCase[] {
  return cases.filter(
    (caseRecord) => resolveCompensationStatus(caseRecord, now) === "completed"
  );
}

export function selectArchivedCompensationCases(
  cases: CompensationCase[],
  now: Date = new Date()
): CompensationCase[] {
  return cases.filter((caseRecord) => isCompensationArchived(caseRecord, now));
}

export function selectOverdueCompensationCases(
  cases: CompensationCase[],
  now: Date = new Date()
): CompensationCase[] {
  return cases.filter((caseRecord) => isCompensationOverdue(caseRecord, now));
}

export function countCompletedCompensationCasesToday(
  cases: CompensationCase[],
  now: Date = new Date()
): number {
  const todayKey = getTodayDateKey(COMPENSATION_HISTORY_TIMEZONE);

  return cases.filter((caseRecord) => {
    const completedAt = getCompensationClosedAt(caseRecord, now);
    if (!completedAt) {
      return false;
    }

    return (
      resolveCompensationStatus(caseRecord, now) === "completed" &&
      getDateKeyFromTimestamp(completedAt, {
        timeZone: COMPENSATION_HISTORY_TIMEZONE,
      }) === todayKey
    );
  }).length;
}

export function selectCompensationCasesForTab(
  cases: CompensationCase[],
  tab: CompensationTab,
  now: Date = new Date()
): CompensationCase[] {
  switch (tab) {
    case "active":
      return selectActiveCompensationCases(cases, now);
    case "ready_for_claim":
      return selectReadyForClaimCompensationCases(cases, now);
    case "completed":
      return selectCompletedCompensationCases(cases, now);
    case "archive":
      return selectArchivedCompensationCases(cases, now);
    default:
      return cases;
  }
}

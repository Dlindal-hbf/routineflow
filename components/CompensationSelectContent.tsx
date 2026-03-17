"use client";

import type { AppSelectOption } from "@/components/ui/app-select";
import {
  COMPENSATION_ISSUE_CATEGORIES,
  COMPENSATION_ISSUE_CATEGORY_TONE_CLASS_NAMES,
  COMPENSATION_STATUSES,
  COMPENSATION_STATUS_TONE_CLASS_NAMES,
  COMPENSATION_TYPES,
  COMPENSATION_TYPE_TONE_CLASS_NAMES,
} from "@/lib/compensation-constants";
import type {
  CompensationIssueCategory,
  CompensationStatus,
  CompensationType,
} from "@/lib/compensation-types";
import {
  getCompensationIssueCategoryLabel,
  getCompensationStatusLabel,
  getCompensationTypeLabel,
} from "@/lib/compensation-utils";
import { cn } from "@/lib/utils";

export const compensationStatusFilterOptions: AppSelectOption<
  CompensationStatus | "all"
>[] = [
  { value: "all", label: "All statuses" },
  ...COMPENSATION_STATUSES.map((status) => ({
    value: status,
    label: getCompensationStatusLabel(status),
  })),
];

export const compensationTypeFilterOptions: AppSelectOption<
  CompensationType | "all"
>[] = [
  { value: "all", label: "All types" },
  ...COMPENSATION_TYPES.map((type) => ({
    value: type,
    label: getCompensationTypeLabel(type),
  })),
];

export const compensationIssueFilterOptions: AppSelectOption<
  CompensationIssueCategory | "all"
>[] = [
  { value: "all", label: "All issues" },
  ...COMPENSATION_ISSUE_CATEGORIES.map((category) => ({
    value: category,
    label: getCompensationIssueCategoryLabel(category),
  })),
];

export const compensationTypeOptions: AppSelectOption<CompensationType>[] =
  COMPENSATION_TYPES.map((type) => ({
    value: type,
    label: getCompensationTypeLabel(type),
  }));

export const compensationIssueOptions: AppSelectOption<CompensationIssueCategory>[] =
  COMPENSATION_ISSUE_CATEGORIES.map((category) => ({
    value: category,
    label: getCompensationIssueCategoryLabel(category),
  }));

function Dot({
  className,
}: {
  className: string;
}) {
  return <span className={cn("size-2.5 shrink-0 rounded-full", className)} />;
}

function renderSemanticValue(label: string, toneClassName?: string) {
  return (
    <span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-900">
      {toneClassName ? <Dot className={toneClassName} /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

function renderSemanticOption(label: string, toneClassName?: string) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {toneClassName ? <Dot className={toneClassName} /> : null}
      <span className="truncate font-medium text-current">{label}</span>
    </div>
  );
}

export function renderCompensationStatusValue(
  option: AppSelectOption<CompensationStatus | "all">
) {
  if (option.value === "all") {
    return renderSemanticValue(option.label);
  }

  return renderSemanticValue(
    option.label,
    COMPENSATION_STATUS_TONE_CLASS_NAMES[option.value]
  );
}

export function renderCompensationStatusOption(
  option: AppSelectOption<CompensationStatus | "all">
) {
  if (option.value === "all") {
    return renderSemanticOption(option.label);
  }

  return renderSemanticOption(
    option.label,
    COMPENSATION_STATUS_TONE_CLASS_NAMES[option.value]
  );
}

export function renderCompensationTypeValue(
  option: AppSelectOption<CompensationType | "all">
) {
  if (option.value === "all") {
    return renderSemanticValue(option.label);
  }

  return renderSemanticValue(
    option.label,
    COMPENSATION_TYPE_TONE_CLASS_NAMES[option.value]
  );
}

export function renderCompensationTypeOption(
  option: AppSelectOption<CompensationType | "all">
) {
  if (option.value === "all") {
    return renderSemanticOption(option.label);
  }

  return renderSemanticOption(
    option.label,
    COMPENSATION_TYPE_TONE_CLASS_NAMES[option.value]
  );
}

export function renderCompensationIssueValue(
  option: AppSelectOption<CompensationIssueCategory | "all">
) {
  if (option.value === "all") {
    return renderSemanticValue(option.label);
  }

  return renderSemanticValue(
    option.label,
    COMPENSATION_ISSUE_CATEGORY_TONE_CLASS_NAMES[option.value]
  );
}

export function renderCompensationIssueOption(
  option: AppSelectOption<CompensationIssueCategory | "all">
) {
  if (option.value === "all") {
    return renderSemanticOption(option.label);
  }

  return renderSemanticOption(
    option.label,
    COMPENSATION_ISSUE_CATEGORY_TONE_CLASS_NAMES[option.value]
  );
}

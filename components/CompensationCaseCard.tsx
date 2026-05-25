"use client";

import { CheckCircle2, CircleDot, PenLine, Phone, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CompensationStatusBadge from "@/components/CompensationStatusBadge";
import type { CompensationCase } from "@/lib/compensation-types";
import { formatShortDate } from "@/lib/date-utils";
import {
  getCompensationAssignedOwner,
  getCompensationIssueCategoryLabel,
  getCompensationSummary,
  isCompensationClaimable,
  resolveCompensationStatus,
} from "@/lib/compensation-utils";

interface CompensationCaseCardProps {
  caseRecord: CompensationCase;
  onOpen: (caseRecord: CompensationCase) => void;
  onEdit?: (caseRecord: CompensationCase) => void;
  onMarkReady?: (caseRecord: CompensationCase) => void;
  onComplete?: (caseRecord: CompensationCase) => void;
}

export default function CompensationCaseCard({
  caseRecord,
  onOpen,
  onEdit,
  onMarkReady,
  onComplete,
}: CompensationCaseCardProps) {
  const resolvedStatus = resolveCompensationStatus(caseRecord);
  const claimable = isCompensationClaimable(caseRecord);

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <button
            type="button"
            onClick={() => onOpen(caseRecord)}
            className="flex-1 text-left"
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <CompensationStatusBadge status={resolvedStatus} />
              <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {getCompensationIssueCategoryLabel(caseRecord.issueCategory)}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-slate-900">
                {caseRecord.customerName}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {caseRecord.customerPhone}
                </span>
                <span className="inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  {getCompensationAssignedOwner(caseRecord)}
                </span>
                <span>Created {formatShortDate(caseRecord.createdAt)}</span>
              </div>

              <p className="line-clamp-1 text-base text-slate-600">
                {caseRecord.issueDescription}
              </p>

              <p className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-slate-800">
                <CircleDot className="h-4 w-4 shrink-0 text-primary" />
                <span className="line-clamp-1">{getCompensationSummary(caseRecord)}</span>
              </p>
            </div>
          </button>

          <div className="min-w-0 lg:w-auto">
            <div className="mt-2 flex flex-wrap gap-2 lg:mt-0">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(caseRecord)}
                  className="rounded-lg"
                >
                  <PenLine className="h-4 w-4" />
                  Edit
                </Button>
              )}

              {onMarkReady && resolvedStatus === "pending" && (
                <Button
                  size="sm"
                  onClick={() => onMarkReady(caseRecord)}
                  className="rounded-lg"
                >
                  Mark ready
                </Button>
              )}

              {onComplete && claimable && (
                <Button
                  size="sm"
                  onClick={() => onComplete(caseRecord)}
                  className="rounded-lg"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Claim
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

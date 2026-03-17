"use client";

import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  PenLine,
  UserRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CompensationStatusBadge from "@/components/CompensationStatusBadge";
import type { CompensationCase } from "@/lib/compensation-types";
import { formatTimestamp } from "@/lib/date-utils";
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
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <CompensationStatusBadge status={resolvedStatus} />
              <span className="text-sm font-medium text-slate-500">
                {caseRecord.caseNumber}
              </span>
              <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-sm text-primary">
                {getCompensationIssueCategoryLabel(caseRecord.issueCategory)}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-semibold text-slate-900">
                  {caseRecord.customerName}
                </h3>
                <p className="mt-2 line-clamp-2 text-lg text-slate-600">
                  {caseRecord.issueDescription}
                </p>
                <p className="mt-3 text-base font-medium text-slate-800">
                  {getCompensationSummary(caseRecord)}
                </p>
              </div>
              <ChevronRight className="mt-1 hidden h-6 w-6 text-slate-400 lg:block" />
            </div>
          </button>

          <div className="min-w-0 lg:w-[290px]">
            <div className="grid gap-3 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                <span>{caseRecord.customerPhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Created {formatTimestamp(caseRecord.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <span>
                  {caseRecord.readyForClaimAt
                    ? `Available ${formatTimestamp(caseRecord.readyForClaimAt)}`
                    : `Updated ${formatTimestamp(caseRecord.updatedAt)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                <span>Responsible {getCompensationAssignedOwner(caseRecord)}</span>
              </div>
              {caseRecord.fulfilledBy && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Fulfilled by {caseRecord.fulfilledBy}</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
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

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpen(caseRecord)}
                className="rounded-lg"
              >
                View
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

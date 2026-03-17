"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Calendar,
  FileText,
  MessageSquare,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CompensationStatusBadge from "@/components/CompensationStatusBadge";
import type { CompensationCase } from "@/lib/compensation-types";
import { formatTimestamp } from "@/lib/date-utils";
import {
  getCompensationActivityLabel,
  getCompensationAssignedOwner,
  getCompensationClosedAt,
  getCompensationIssueCategoryLabel,
  getCompensationSummary,
  getCompensationTypeLabel,
  isCompensationClaimable,
  isCompensationEditable,
  resolveCompensationStatus,
} from "@/lib/compensation-utils";

interface CompensationCaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseRecord: CompensationCase | null;
  currentActor: string;
  onEdit: (caseRecord: CompensationCase) => void;
  onMarkReady: (caseRecord: CompensationCase) => void;
  onComplete: (
    caseRecord: CompensationCase,
    payload: { fulfilledBy: string; claimNote: string }
  ) => void;
  onCancel: (
    caseRecord: CompensationCase,
    payload: { actor: string; archiveReason: string }
  ) => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-700">{value || "Not set"}</div>
    </div>
  );
}

export default function CompensationCaseDetailDialog({
  open,
  onOpenChange,
  caseRecord,
  currentActor,
  onEdit,
  onMarkReady,
  onComplete,
  onCancel,
}: CompensationCaseDetailDialogProps) {
  const [fulfillmentName, setFulfillmentName] = useState(currentActor);
  const [claimNote, setClaimNote] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [showCompletePanel, setShowCompletePanel] = useState(false);
  const [showCancelPanel, setShowCancelPanel] = useState(false);

  const resetPanels = () => {
    setShowCompletePanel(false);
    setShowCancelPanel(false);
    setClaimNote("");
    setArchiveReason("");
    setFulfillmentName(currentActor);
  };

  if (!caseRecord) {
    return null;
  }

  const resolvedStatus = resolveCompensationStatus(caseRecord);
  const canEdit = isCompensationEditable(caseRecord);
  const canComplete = isCompensationClaimable(caseRecord);
  const closedAt = getCompensationClosedAt(caseRecord);
  const orderedActivity = [...caseRecord.activityLog].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetPanels();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span>{caseRecord.customerName}</span>
            <CompensationStatusBadge status={resolvedStatus} />
          </DialogTitle>
          <DialogDescription>
            {caseRecord.caseNumber} / {getCompensationSummary(caseRecord)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
          <Section title="Ownership">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Created by" value={caseRecord.createdBy} />
              <DetailRow
                label="Responsible"
                value={getCompensationAssignedOwner(caseRecord)}
              />
              <DetailRow label="Fulfilled by" value={caseRecord.fulfilledBy} />
              <DetailRow label="Claimed at" value={caseRecord.claimedAt ? formatTimestamp(caseRecord.claimedAt) : undefined} />
            </div>
          </Section>

          <Section title="Customer">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Customer name" value={caseRecord.customerName} />
              <DetailRow label="Phone" value={caseRecord.customerPhone} />
              <DetailRow label="Email" value={caseRecord.customerEmail} />
              <DetailRow label="Reference" value={caseRecord.customerReference} />
            </div>
          </Section>

          <Section title="Lifecycle">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Created" value={formatTimestamp(caseRecord.createdAt)} />
              <DetailRow label="Updated" value={formatTimestamp(caseRecord.updatedAt)} />
                <DetailRow
                  label="Available from"
                  value={
                    caseRecord.readyForClaimAt
                      ? formatTimestamp(caseRecord.readyForClaimAt)
                    : undefined
                }
              />
              <DetailRow
                label="Closed"
                value={closedAt ? formatTimestamp(closedAt) : undefined}
              />
              <DetailRow
                label="Fulfilled by"
                value={caseRecord.fulfilledBy || caseRecord.assignedTo}
              />
              <DetailRow
                label="Expiry"
                value={
                  caseRecord.expiryDate ? formatTimestamp(caseRecord.expiryDate) : undefined
                }
              />
            </div>
          </Section>

          <Section title="Complaint">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileText className="h-4 w-4" />
                <span>{getCompensationIssueCategoryLabel(caseRecord.issueCategory)}</span>
              </div>
              <p className="text-sm text-slate-700">{caseRecord.issueDescription}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Related product" value={caseRecord.relatedProductName} />
                <DetailRow label="Order number" value={caseRecord.relatedOrderNumber} />
              </div>
              <DetailRow label="Internal notes" value={caseRecord.internalNotes} />
            </div>
          </Section>

          <Section title="Compensation">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow
                label="Type"
                value={getCompensationTypeLabel(caseRecord.compensationType)}
              />
              <DetailRow label="Summary" value={getCompensationSummary(caseRecord)} />
              <DetailRow label="Gift card reference" value={caseRecord.giftCardReference} />
              <DetailRow label="Replacement item" value={caseRecord.replacementItemName} />
              <DetailRow
                label="Fulfillment mode"
                value={
                  caseRecord.fulfillmentMode === "immediate"
                    ? "Immediate"
                    : "Later claim"
                }
              />
              <DetailRow label="Decision note" value={caseRecord.decisionNote} />
            </div>
          </Section>
        </div>

        {(showCompletePanel || showCancelPanel) && (
          <Section title={showCompletePanel ? "Confirm claim" : "Cancel case"}>
            {showCompletePanel ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Fulfilled by
                  </label>
                  <Input
                    value={fulfillmentName}
                    onChange={(event) => setFulfillmentName(event.target.value)}
                    placeholder="Staff member"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Claim note
                  </label>
                  <Textarea
                    value={claimNote}
                    onChange={(event) => setClaimNote(event.target.value)}
                    placeholder="What was handed over to the customer?"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={resetPanels}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!window.confirm("Complete this claim now?")) {
                        return;
                      }
                      onComplete(caseRecord, {
                        fulfilledBy: fulfillmentName,
                        claimNote,
                      });
                      resetPanels();
                    }}
                  >
                    Confirm completion
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Cancellation reason
                  </label>
                  <Textarea
                    value={archiveReason}
                    onChange={(event) => setArchiveReason(event.target.value)}
                    placeholder="Why is this case being cancelled?"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetPanels}>
                    Keep case
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onCancel(caseRecord, {
                        actor: currentActor,
                        archiveReason,
                      });
                      resetPanels();
                    }}
                  >
                    Confirm cancellation
                  </Button>
                </div>
              </div>
            )}
          </Section>
        )}

        <Section title="Activity">
          <div className="space-y-3">
            {orderedActivity.map((activity) => (
              <div
                key={activity.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4" />
                  <span>{formatTimestamp(activity.timestamp)}</span>
                  <span>/</span>
                  <UserRound className="h-4 w-4" />
                  <span>{activity.actor}</span>
                </div>
                <div className="mt-2 font-medium text-slate-900">
                  {getCompensationActivityLabel(activity)}
                </div>
                {activity.note && (
                  <div className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                    <MessageSquare className="mt-0.5 h-4 w-4" />
                    <span>{activity.note}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <DialogFooter className="justify-between sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => onEdit(caseRecord)}>
                Edit case
              </Button>
            )}
            {canEdit &&
              resolvedStatus === "pending" &&
              caseRecord.fulfillmentMode === "later_claim" && (
                <Button variant="outline" onClick={() => onMarkReady(caseRecord)}>
                  Mark ready for claim
                </Button>
              )}
            {canEdit && canComplete && (
              <Button
                onClick={() => {
                  setFulfillmentName(currentActor);
                  setShowCancelPanel(false);
                  setShowCompletePanel(true);
                }}
              >
                Claim
              </Button>
            )}
            {canEdit && (
              <Button
                variant="destructive"
                onClick={() => {
                  setShowCompletePanel(false);
                  setShowCancelPanel(true);
                }}
              >
                Cancel case
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

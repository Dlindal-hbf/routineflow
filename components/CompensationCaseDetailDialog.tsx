"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MessageSquare, Package, Phone, UserRound } from "lucide-react";
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
import { formatShortDate } from "@/lib/date-utils";
import {
  getCompensationActivityLabel,
  getCompensationAssignedOwner,
  getCompensationIssueCategoryLabel,
  getCompensationStatusLabel,
  getCompensationSummary,
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
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-sm leading-6 text-slate-900">{value}</div>
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
  const [showActivity, setShowActivity] = useState(false);

  const resetPanels = () => {
    setShowCompletePanel(false);
    setShowCancelPanel(false);
    setShowActivity(false);
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
  const orderedActivity = [...caseRecord.activityLog].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
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
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="space-y-3">
            <DialogTitle className="flex flex-wrap items-center gap-3">
              <span>{caseRecord.customerName}</span>
              <CompensationStatusBadge status={resolvedStatus} />
              <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {getCompensationIssueCategoryLabel(caseRecord.issueCategory)}
              </span>
            </DialogTitle>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {caseRecord.customerPhone}
              </span>
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                Responsible {getCompensationAssignedOwner(caseRecord)}
              </span>
              <span>Created {formatShortDate(caseRecord.createdAt)}</span>
              <span>Updated {formatShortDate(caseRecord.updatedAt)}</span>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Customer case details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Section title="Problem">
            <p className="text-base leading-7 text-slate-800">
              {caseRecord.issueDescription}
            </p>

            {caseRecord.relatedProductName && (
              <DetailRow
                label="Related product"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4 text-slate-400" />
                    {caseRecord.relatedProductName}
                  </span>
                }
              />
            )}

            {caseRecord.internalNotes && (
              <DetailRow label="Notes" value={caseRecord.internalNotes} />
            )}
          </Section>

          <Section title="Resolution">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Action" value={getCompensationSummary(caseRecord)} />
              <DetailRow
                label="Status"
                value={getCompensationStatusLabel(resolvedStatus)}
              />
              <DetailRow
                label="Responsible"
                value={getCompensationAssignedOwner(caseRecord)}
              />
              {caseRecord.fulfilledBy && (
                <DetailRow label="Fulfilled by" value={caseRecord.fulfilledBy} />
              )}
              {caseRecord.compensationType === "gift_card" &&
                caseRecord.giftCardReference && (
                  <DetailRow
                    label="Gift card reference"
                    value={caseRecord.giftCardReference}
                  />
                )}
              {caseRecord.decisionNote && (
                <DetailRow label="Notes" value={caseRecord.decisionNote} />
              )}
              {caseRecord.claimNote && (
                <DetailRow label="Claim note" value={caseRecord.claimNote} />
              )}
            </div>
          </Section>

          {(showCompletePanel || showCancelPanel) && (
            <section className="rounded-2xl bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">
                {showCompletePanel ? "Confirm claim" : "Close case"}
              </h3>

              {showCompletePanel ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Reason
                    </label>
                    <Textarea
                      value={archiveReason}
                      onChange={(event) => setArchiveReason(event.target.value)}
                      placeholder="Why is this case being closed?"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetPanels}>
                      Keep case open
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
                      Confirm close
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="border-t border-slate-200 pt-5">
            <Button
              variant="ghost"
              className="h-auto px-0 text-sm font-medium text-slate-600 hover:bg-transparent hover:text-slate-900"
              onClick={() => setShowActivity((current) => !current)}
            >
              {showActivity ? "Hide activity" : "Show activity"}
            </Button>

            {showActivity && (
              <div className="mt-4 space-y-3">
                {orderedActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {getCompensationActivityLabel(activity)} -{" "}
                      {formatShortDate(activity.timestamp)}
                    </div>
                    {activity.note && (
                      <div className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{activity.note}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
                  Mark ready
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
                Close case
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

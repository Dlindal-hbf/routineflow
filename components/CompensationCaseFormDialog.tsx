"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPENSATION_ISSUE_CATEGORIES,
  COMPENSATION_TYPES,
} from "@/lib/compensation-constants";
import type {
  CompensationFormValue,
  CompensationIssueCategory,
  CompensationType,
} from "@/lib/compensation-types";
import {
  getCompensationIssueCategoryLabel,
  getCompensationTypeLabel,
} from "@/lib/compensation-utils";

interface CompensationCaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  value: CompensationFormValue;
  onChange: (value: CompensationFormValue) => void;
  onSubmit: () => void;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2">{label}</Label>
      {children}
    </div>
  );
}

export default function CompensationCaseFormDialog({
  open,
  onOpenChange,
  mode,
  value,
  onChange,
  onSubmit,
}: CompensationCaseFormDialogProps) {
  const updateField = <K extends keyof CompensationFormValue>(
    key: K,
    nextValue: CompensationFormValue[K]
  ) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  const showsValueField =
    value.compensationType === "gift_card" ||
    value.compensationType === "store_credit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Compensation" : "Edit Compensation"}
          </DialogTitle>
          <DialogDescription>
            Register customer details, the issue, and how the case should be handled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Section
            title="Customer"
            description="Keep claim handling quick by saving the best lookup details."
          >
            <Field label="Customer name">
              <Input
                value={value.customerName}
                onChange={(event) => updateField("customerName", event.target.value)}
                placeholder="Customer name"
              />
            </Field>
            <Field label="Phone number">
              <Input
                value={value.customerPhone}
                onChange={(event) => updateField("customerPhone", event.target.value)}
                placeholder="Phone number"
              />
            </Field>
            <Field label="Email">
              <Input
                value={value.customerEmail}
                onChange={(event) => updateField("customerEmail", event.target.value)}
                placeholder="Email (optional)"
                type="email"
              />
            </Field>
            <Field label="Order / customer reference">
              <Input
                value={value.customerReference}
                onChange={(event) => updateField("customerReference", event.target.value)}
                placeholder="Reference number"
              />
            </Field>
          </Section>

          <Section
            title="Complaint"
            description="Capture the issue clearly so the next shift can understand it at a glance."
          >
            <Field label="Issue category">
              <Select
                value={value.issueCategory}
                onValueChange={(nextValue) =>
                  updateField("issueCategory", nextValue as CompensationIssueCategory)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPENSATION_ISSUE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {getCompensationIssueCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Related order number">
              <Input
                value={value.relatedOrderNumber}
                onChange={(event) => updateField("relatedOrderNumber", event.target.value)}
                placeholder="Order number"
              />
            </Field>
            <Field label="Issue description" className="md:col-span-2">
              <Textarea
                value={value.issueDescription}
                onChange={(event) => updateField("issueDescription", event.target.value)}
                placeholder="What happened?"
                rows={4}
              />
            </Field>
            <Field label="Related product">
              <Input
                value={value.relatedProductName}
                onChange={(event) => updateField("relatedProductName", event.target.value)}
                placeholder="Product name"
              />
            </Field>
            <Field label="Assigned to">
              <Input
                value={value.assignedTo}
                onChange={(event) => updateField("assignedTo", event.target.value)}
                placeholder="Defaults to creator"
              />
            </Field>
          </Section>

          <Section
            title="Compensation"
            description="Only show the fields that matter for the chosen resolution."
          >
            <Field label="Compensation type">
              <Select
                value={value.compensationType}
                onValueChange={(nextValue) =>
                  updateField("compensationType", nextValue as CompensationType)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPENSATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getCompensationTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {showsValueField && (
              <Field label="Compensation value (NOK)">
                <Input
                  value={value.compensationValue}
                  onChange={(event) => updateField("compensationValue", event.target.value)}
                  placeholder="150"
                  inputMode="decimal"
                />
              </Field>
            )}

            {value.compensationType === "replacement_product" && (
              <Field label="Replacement item name">
                <Input
                  value={value.replacementItemName}
                  onChange={(event) => updateField("replacementItemName", event.target.value)}
                  placeholder="Replacement product"
                />
              </Field>
            )}

            {value.compensationType === "gift_card" && (
              <Field label="Gift card reference">
                <Input
                  value={value.giftCardReference}
                  onChange={(event) => updateField("giftCardReference", event.target.value)}
                  placeholder="Gift card code"
                />
              </Field>
            )}

            <Field label="Decision note" className="md:col-span-2">
              <Textarea
                value={value.decisionNote}
                onChange={(event) => updateField("decisionNote", event.target.value)}
                placeholder="Why this compensation was chosen"
                rows={3}
              />
            </Field>
          </Section>

          <Section
            title="Fulfillment"
            description="Support both immediate handling and later customer claims."
          >
            <Field label="Fulfillment mode">
              <Select
                value={value.fulfillmentMode}
                onValueChange={(nextValue) =>
                  updateField("fulfillmentMode", nextValue as "immediate" | "later_claim")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="later_claim">Customer will claim later</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {value.fulfillmentMode === "immediate" ? (
              <Field label="Complete immediately">
                <Select
                  value={value.completeImmediately ? "yes" : "no"}
                  onValueChange={(nextValue) =>
                    updateField("completeImmediately", nextValue === "yes")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">Save as pending</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Ready state">
                  <Select
                    value={value.readyState}
                    onValueChange={(nextValue) =>
                      updateField(
                        "readyState",
                        nextValue as "ready_now" | "prepare_later"
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ready_now">Available immediately</SelectItem>
                      <SelectItem value="prepare_later">Prepare later</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Available from">
                  <Input
                    value={value.readyForClaimAt}
                    onChange={(event) => updateField("readyForClaimAt", event.target.value)}
                    type="datetime-local"
                  />
                </Field>
                <Field label="Expiry date">
                  <Input
                    value={value.expiryDate}
                    onChange={(event) => updateField("expiryDate", event.target.value)}
                    type="date"
                  />
                </Field>
              </>
            )}
          </Section>

          <Section
            title="Notes"
            description="Internal notes stay with the case and are visible in the detail view."
          >
            <Field label="Internal notes" className="md:col-span-2">
              <Textarea
                value={value.internalNotes}
                onChange={(event) => updateField("internalNotes", event.target.value)}
                placeholder="Internal context for the team"
                rows={3}
              />
            </Field>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            {mode === "create" ? "Create case" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

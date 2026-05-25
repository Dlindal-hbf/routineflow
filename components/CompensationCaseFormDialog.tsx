"use client";

import type { ReactNode } from "react";
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
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { Textarea } from "@/components/ui/textarea";
import {
  compensationIssueOptions,
  compensationTypeOptions,
  renderCompensationIssueOption,
  renderCompensationIssueValue,
  renderCompensationTypeOption,
  renderCompensationTypeValue,
} from "@/components/CompensationSelectContent";
import type {
  CompensationFormValue,
  CompensationIssueCategory,
  CompensationType,
} from "@/lib/compensation-types";

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
    <section className="rounded-2xl bg-slate-50/70 p-5">
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
            {mode === "create" ? "New customer case" : "Edit customer case"}
          </DialogTitle>
          <DialogDescription>
            Save the customer, the problem, and the resolution in one simple case.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Section
            title="Customer"
            description="Only collect the details staff need to find the case again."
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
          </Section>

          <Section
            title="Problem"
            description="Capture what happened clearly so the next shift can understand it fast."
          >
            <Field label="Issue category">
              <AppSelect
                value={value.issueCategory}
                onValueChange={(nextValue) =>
                  updateField("issueCategory", nextValue as CompensationIssueCategory)
                }
                options={compensationIssueOptions}
                renderValue={renderCompensationIssueValue}
                renderOption={renderCompensationIssueOption}
              />
            </Field>
            <Field label="Responsible">
              <Input
                value={value.assignedTo}
                onChange={(event) => updateField("assignedTo", event.target.value)}
                placeholder="Defaults to creator"
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
          </Section>

          <Section
            title="Resolution"
            description="Only show the fields that matter for the action you are giving the customer."
          >
            <Field label="Action type">
              <AppSelect
                value={value.compensationType}
                onValueChange={(nextValue) =>
                  updateField("compensationType", nextValue as CompensationType)
                }
                options={compensationTypeOptions}
                renderValue={renderCompensationTypeValue}
                renderOption={renderCompensationTypeOption}
              />
            </Field>

            {showsValueField && (
              <Field label="Value (NOK)">
                <Input
                  value={value.compensationValue}
                  onChange={(event) => updateField("compensationValue", event.target.value)}
                  placeholder="150"
                  inputMode="decimal"
                />
              </Field>
            )}

            {value.compensationType === "replacement_product" && (
              <Field label="Replacement item">
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

            <Field label="Resolution note" className="md:col-span-2">
              <Textarea
                value={value.decisionNote}
                onChange={(event) => updateField("decisionNote", event.target.value)}
                placeholder="What did you decide to do?"
                rows={3}
              />
            </Field>
          </Section>

          <Section title="Notes" description="Short team notes stay with the case.">
            <Field label="Notes" className="md:col-span-2">
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

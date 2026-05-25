"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import HistoryEmptyState from "@/components/history/HistoryEmptyState";
import CompensationCaseCard from "@/components/CompensationCaseCard";
import CompensationCaseDetailDialog from "@/components/CompensationCaseDetailDialog";
import CompensationCaseFormDialog from "@/components/CompensationCaseFormDialog";
import {
  compensationIssueFilterOptions,
  compensationTypeFilterOptions,
  renderCompensationIssueOption,
  renderCompensationIssueValue,
  renderCompensationTypeOption,
  renderCompensationTypeValue,
} from "@/components/CompensationSelectContent";
import {
  COMPENSATION_DATE_FILTER_OPTIONS,
  COMPENSATION_SORT_OPTIONS,
  DEFAULT_COMPENSATION_FORM_VALUE,
} from "@/lib/compensation-constants";
import {
  buildCompensationFormValue,
} from "@/lib/compensation-store";
import type {
  CompensationCase,
  CompensationCaseFilters,
  CompensationSortKey,
  CompensationTab,
} from "@/lib/compensation-types";
import { useCompensationCases } from "@/lib/use-compensation-cases";
import {
  filterCompensationCases,
  isCompensationEditable,
  selectArchivedCompensationCases,
  selectCompensationCasesForTab,
  selectOpenCompensationCases,
  sortCompensationCases,
} from "@/lib/compensation-utils";

interface CompensationModuleProps {
  onBack: () => void;
  currentActor: string;
  onHistoryEntry?: (description: string) => void;
}

type CaseStatusFilter = "open" | "closed";

export default function CompensationModule({
  onBack,
  currentActor,
  onHistoryEntry,
}: CompensationModuleProps) {
  const {
    cases,
    loading,
    refreshing,
    error,
    createCase,
    updateCase,
    completeCase,
    reopenCase,
    cancelCase,
    deleteCase,
  } = useCompensationCases();

  const [statusFilter, setStatusFilter] = useState<CaseStatusFilter>("open");
  const [filters, setFilters] = useState<CompensationCaseFilters>({
    query: "",
    status: "all",
    compensationType: "all",
    issueCategory: "all",
    dateRange: "all_time",
  });
  const [sortKey, setSortKey] = useState<CompensationSortKey>("newest");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formValue, setFormValue] = useState(DEFAULT_COMPENSATION_FORM_VALUE);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [casePendingDelete, setCasePendingDelete] = useState<CompensationCase | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  const openCases = useMemo(() => selectOpenCompensationCases(cases), [cases]);
  const closedCases = useMemo(() => selectArchivedCompensationCases(cases), [cases]);

  const baseCasesForTab = useMemo(
    () => selectCompensationCasesForTab(cases, statusFilter as CompensationTab),
    [cases, statusFilter]
  );

  const visibleCases = useMemo(() => {
    const filtered = filterCompensationCases(baseCasesForTab, filters, {
      useClosedAt: statusFilter === "closed",
    });
    return sortCompensationCases(filtered, sortKey);
  }, [baseCasesForTab, filters, sortKey, statusFilter]);

  const commitHistory = (description: string | undefined) => {
    if (description && onHistoryEntry) {
      onHistoryEntry(description);
    }
  };

  const openCreateDialog = () => {
    setFormMode("create");
    setEditingCaseId(null);
    setFormValue({
      ...DEFAULT_COMPENSATION_FORM_VALUE,
      assignedTo: currentActor,
    });
    setFormOpen(true);
  };

  const openEditDialog = (caseRecord: CompensationCase) => {
    setFormMode("edit");
    setEditingCaseId(caseRecord.id);
    setFormValue(buildCompensationFormValue(caseRecord));
    setFormOpen(true);
  };

  const openDetailDialog = (caseRecord: CompensationCase) => {
    setSelectedCaseId(caseRecord.id);
    setDetailOpen(true);
  };

  const submitForm = async () => {
    if (!formValue.customerName.trim() || !formValue.customerPhone.trim()) {
      window.alert("Customer name and phone number are required.");
      return;
    }

    if (!formValue.issueDescription.trim()) {
      window.alert("Please describe the issue before saving.");
      return;
    }

    if (formMode === "create") {
      const result = await createCase(formValue, currentActor);
      if (result) {
        commitHistory(result.historyMessage);
        setSelectedCaseId(result.caseRecord.id);
      }
    } else if (editingCaseId) {
      const result = await updateCase(editingCaseId, formValue, currentActor);
      if (result) {
        commitHistory(result.historyMessage);
      }
    }

    setFormOpen(false);
  };

  const handleComplete = async (
    caseRecord: CompensationCase,
    payload: { fulfilledBy: string; claimNote: string }
  ) => {
    const result = await completeCase(caseRecord.id, payload);
    if (result) {
      commitHistory(result.historyMessage);
      setSelectedCaseId(result.caseRecord.id);
    }
  };

  const handleCancel = async (
    caseRecord: CompensationCase,
    payload: { actor: string; archiveReason: string }
  ) => {
    const result = await cancelCase(caseRecord.id, payload);
    if (result) {
      commitHistory(result.historyMessage);
      setSelectedCaseId(result.caseRecord.id);
    }
  };

  const handleDelete = async (caseRecord: CompensationCase) => {
    const result = await deleteCase(caseRecord.id);
    if (result) {
      commitHistory(result.historyMessage);
      if (selectedCaseId === caseRecord.id) {
        setSelectedCaseId(null);
        setDetailOpen(false);
      }
    }
    return result;
  };

  const handleReopen = async (caseRecord: CompensationCase) => {
    const result = await reopenCase(caseRecord.id, currentActor);
    if (result) {
      commitHistory(result.historyMessage);
      setSelectedCaseId(result.caseRecord.id);
    }
  };

  const requestDelete = (caseRecord: CompensationCase) => {
    setCasePendingDelete(caseRecord);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!casePendingDelete || deletePending) {
      return;
    }

    setDeletePending(true);
    const result = await handleDelete(casePendingDelete);
    if (result) {
      setDeleteConfirmOpen(false);
      setCasePendingDelete(null);
    }
    setDeletePending(false);
  };

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <button
              onClick={onBack}
              className="mt-4 flex items-center gap-2 text-xl text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gold-muted">
              <HandCoins className="h-8 w-8 text-accent-gold" />
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight">Compensation</h1>
              <p className="mt-1 text-2xl text-slate-500">
                A calm daily-use notebook for customer problems and resolutions
              </p>
            </div>
          </div>

          <Button
            className="h-14 rounded-2xl bg-primary px-6 text-2xl hover:bg-primary/90"
            onClick={openCreateDialog}
          >
            <Plus className="mr-3 h-6 w-6" />
            New case
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        <>
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {[
            { key: "open" as CaseStatusFilter, label: "Open", count: openCases.length },
            { key: "closed" as CaseStatusFilter, label: "Closed", count: closedCases.length },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setStatusFilter(option.key)}
              className={
                statusFilter === option.key
                  ? "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        <div className="mt-8 mb-8 grid gap-4 xl:grid-cols-[1.4fr_repeat(2,minmax(0,0.8fr))]">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="Search name, phone, or issue"
              className="h-16 rounded-2xl border-slate-200 bg-white pl-16 text-xl"
            />
          </div>

          <AppSelect
            value={filters.compensationType}
            onValueChange={(nextValue) =>
              setFilters((current) => ({
                ...current,
                compensationType: nextValue as CompensationCaseFilters["compensationType"],
              }))
            }
            options={compensationTypeFilterOptions}
            size="lg"
            triggerLabel="Type"
            renderValue={renderCompensationTypeValue}
            renderOption={renderCompensationTypeOption}
          />

          <Button
            variant="outline"
            className="h-16 rounded-2xl border-slate-200 text-base font-medium"
            onClick={() => setShowAdvancedFilters((current) => !current)}
          >
            {showAdvancedFilters ? (
              <ChevronUp className="mr-2 h-4 w-4" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            Advanced filters
          </Button>
        </div>

        {showAdvancedFilters && (
          <Card className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <AppSelect
                value={filters.dateRange}
                onValueChange={(nextValue) =>
                  setFilters((current) => ({
                    ...current,
                    dateRange: nextValue as CompensationCaseFilters["dateRange"],
                  }))
                }
                options={COMPENSATION_DATE_FILTER_OPTIONS}
                size="lg"
                triggerLabel="Date"
              />

              <AppSelect
                value={filters.issueCategory}
                onValueChange={(nextValue) =>
                  setFilters((current) => ({
                    ...current,
                    issueCategory: nextValue as CompensationCaseFilters["issueCategory"],
                  }))
                }
                options={compensationIssueFilterOptions}
                size="lg"
                triggerLabel="Issue"
                renderValue={renderCompensationIssueValue}
                renderOption={renderCompensationIssueOption}
              />

              <AppSelect
                value={sortKey}
                onValueChange={(nextValue) => setSortKey(nextValue as CompensationSortKey)}
                options={COMPENSATION_SORT_OPTIONS}
                size="lg"
                triggerLabel="Sort"
              />
            </CardContent>
          </Card>
        )}

        {visibleCases.length === 0 ? (
          <HistoryEmptyState
            title="No compensation cases match these filters."
            description="Try another tab or clear a few filters to see more results."
          />
        ) : (
          <div className="space-y-5">
            {refreshing && (
              <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4 text-sm text-slate-500">
                  Refreshing the latest compensation cases in the background...
                </CardContent>
              </Card>
            )}
            {loading && !refreshing && (
              <Card className="rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4 text-sm text-slate-500">
                  Loading compensation cases...
                </CardContent>
              </Card>
            )}
            {visibleCases.map((caseRecord) => (
              <CompensationCaseCard
                key={caseRecord.id}
                caseRecord={caseRecord}
                onOpen={openDetailDialog}
                onEdit={
                  isCompensationEditable(caseRecord)
                    ? openEditDialog
                    : undefined
                }
                onComplete={openDetailDialog}
                onDelete={requestDelete}
              />
            ))}
          </div>
        )}
        </>
      </main>

      <CompensationCaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        value={formValue}
        onChange={setFormValue}
        onSubmit={submitForm}
      />
      <CompensationCaseDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        caseRecord={selectedCase}
        currentActor={currentActor}
        onEdit={(caseRecord) => {
          setDetailOpen(false);
          openEditDialog(caseRecord);
        }}
        onComplete={handleComplete}
        onReopen={handleReopen}
        onCancel={handleCancel}
        onDelete={requestDelete}
        deletePending={deletePending && casePendingDelete?.id === selectedCase?.id}
      />

      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (deletePending) {
            return;
          }
          setDeleteConfirmOpen(nextOpen);
          if (!nextOpen) {
            setCasePendingDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl">
          <DialogHeader>
            <DialogTitle>Delete case?</DialogTitle>
            <DialogDescription>
              This case will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setCasePendingDelete(null);
              }}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-w-[120px] bg-red-600 text-white hover:bg-red-700"
              onClick={() => void confirmDelete()}
              disabled={deletePending}
            >
              {deletePending ? "Deleting..." : "Delete case"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

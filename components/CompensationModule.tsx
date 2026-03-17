"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  HandCoins,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HistoryEmptyState from "@/components/history/HistoryEmptyState";
import CompensationArchiveView from "@/components/CompensationArchiveView";
import CompensationCaseCard from "@/components/CompensationCaseCard";
import CompensationCaseDetailDialog from "@/components/CompensationCaseDetailDialog";
import CompensationCaseFormDialog from "@/components/CompensationCaseFormDialog";
import {
  COMPENSATION_DATE_FILTER_OPTIONS,
  COMPENSATION_ISSUE_CATEGORIES,
  COMPENSATION_SORT_OPTIONS,
  COMPENSATION_STATUSES,
  COMPENSATION_TABS,
  COMPENSATION_TYPES,
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
  countCompletedCompensationCasesToday,
  filterCompensationCases,
  getCompensationIssueCategoryLabel,
  getCompensationStatusLabel,
  getCompensationTypeLabel,
  isCompensationEditable,
  resolveCompensationStatus,
  selectActiveCompensationCases,
  selectArchivedCompensationCases,
  selectCompensationCasesForTab,
  selectOverdueCompensationCases,
  selectReadyForClaimCompensationCases,
  sortCompensationCases,
} from "@/lib/compensation-utils";

interface CompensationModuleProps {
  onBack: () => void;
  currentActor: string;
  onHistoryEntry?: (description: string) => void;
}

function SummaryCard({
  label,
  value,
  accentClassName,
}: {
  label: string;
  value: number;
  accentClassName?: string;
}) {
  return (
    <Card className={`rounded-3xl border bg-white shadow-sm ${accentClassName || "border-slate-200"}`}>
      <CardContent className="p-6">
        <div className="text-4xl font-bold text-slate-900">{value}</div>
        <div className="mt-2 text-lg text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function CompensationModule({
  onBack,
  currentActor,
  onHistoryEntry,
}: CompensationModuleProps) {
  const { cases, createCase, updateCase, markReadyForClaim, completeCase, cancelCase } =
    useCompensationCases();

  const [tab, setTab] = useState<CompensationTab>("all");
  const [archiveViewMode, setArchiveViewMode] = useState<"list" | "calendar">("list");
  const [filters, setFilters] = useState<CompensationCaseFilters>({
    query: "",
    status: "all",
    compensationType: "all",
    issueCategory: "all",
    dateRange: "all_time",
  });
  const [sortKey, setSortKey] = useState<CompensationSortKey>("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formValue, setFormValue] = useState(DEFAULT_COMPENSATION_FORM_VALUE);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  const activeCases = useMemo(() => selectActiveCompensationCases(cases), [cases]);
  const readyCases = useMemo(() => selectReadyForClaimCompensationCases(cases), [cases]);
  const archivedCases = useMemo(() => selectArchivedCompensationCases(cases), [cases]);
  const overdueCases = useMemo(() => selectOverdueCompensationCases(cases), [cases]);
  const completedTodayCount = useMemo(
    () => countCompletedCompensationCasesToday(cases),
    [cases]
  );

  const baseCasesForTab = useMemo(
    () => selectCompensationCasesForTab(cases, tab),
    [cases, tab]
  );

  const visibleCases = useMemo(() => {
    const filtered = filterCompensationCases(baseCasesForTab, filters, {
      useClosedAt: tab === "archive",
    });
    return sortCompensationCases(filtered, sortKey);
  }, [baseCasesForTab, filters, sortKey, tab]);

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

  const submitForm = () => {
    if (!formValue.customerName.trim() || !formValue.customerPhone.trim()) {
      window.alert("Customer name and phone number are required.");
      return;
    }

    if (!formValue.issueDescription.trim()) {
      window.alert("Please describe the issue before saving.");
      return;
    }

    if (formMode === "create") {
      const result = createCase(formValue, currentActor);
      if (result) {
        commitHistory(result.historyMessage);
        setSelectedCaseId(result.caseRecord.id);
      }
    } else if (editingCaseId) {
      const result = updateCase(editingCaseId, formValue, currentActor);
      if (result) {
        commitHistory(result.historyMessage);
      }
    }

    setFormOpen(false);
  };

  const handleMarkReady = (caseRecord: CompensationCase) => {
    const result = markReadyForClaim(caseRecord.id, currentActor);
    if (result) {
      commitHistory(result.historyMessage);
      setSelectedCaseId(result.caseRecord.id);
    }
  };

  const handleComplete = (
    caseRecord: CompensationCase,
    payload: { fulfilledBy: string; claimNote: string }
  ) => {
    const result = completeCase(caseRecord.id, payload);
    if (result) {
      commitHistory(result.historyMessage);
      setSelectedCaseId(result.caseRecord.id);
    }
  };

  const handleCancel = (
    caseRecord: CompensationCase,
    payload: { actor: string; archiveReason: string }
  ) => {
    const result = cancelCase(caseRecord.id, payload);
    if (result) {
      commitHistory(result.historyMessage);
      setSelectedCaseId(result.caseRecord.id);
    }
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
                Register, track, claim, and archive customer make-good cases
              </p>
            </div>
          </div>

          <Button
            className="h-14 rounded-2xl bg-primary px-6 text-2xl hover:bg-primary/90"
            onClick={openCreateDialog}
          >
            <Plus className="mr-3 h-6 w-6" />
            New compensation
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {overdueCases.length > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/20 px-5 py-4 text-accent-foreground">
            <AlertTriangle className="h-5 w-5" />
            <span>
              {overdueCases.length} compensation case{overdueCases.length === 1 ? "" : "s"}{" "}
              have expired and were moved into the archive.
            </span>
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Active cases" value={activeCases.length} />
          <SummaryCard
            label="Ready for claim"
            value={readyCases.length}
            accentClassName="border-primary"
          />
          <SummaryCard label="Completed today" value={completedTodayCount} />
          <SummaryCard label="Archived / closed" value={archivedCases.length} />
        </div>

        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-6 text-lg font-medium">
            {COMPENSATION_TABS.map((tabOption) => (
              <button
                key={tabOption.value}
                onClick={() => setTab(tabOption.value)}
                className={
                  tab === tabOption.value
                    ? "border-b-2 border-primary pb-3 text-primary"
                    : "pb-3 text-foreground/60 hover:text-foreground"
                }
              >
                {tabOption.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 mb-8 grid gap-4 xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.7fr))]">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="Search customer, phone, reference, or issue"
              className="h-16 rounded-2xl border-slate-200 bg-white pl-16 text-xl"
            />
          </div>

          <Select
            value={filters.status}
            onValueChange={(nextValue) =>
              setFilters((current) => ({
                ...current,
                status: nextValue as CompensationCaseFilters["status"],
              }))
            }
          >
            <SelectTrigger className="h-16 w-full rounded-2xl bg-white text-base">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {COMPENSATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {getCompensationStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.compensationType}
            onValueChange={(nextValue) =>
              setFilters((current) => ({
                ...current,
                compensationType: nextValue as CompensationCaseFilters["compensationType"],
              }))
            }
          >
            <SelectTrigger className="h-16 w-full rounded-2xl bg-white text-base">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {COMPENSATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {getCompensationTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.issueCategory}
            onValueChange={(nextValue) =>
              setFilters((current) => ({
                ...current,
                issueCategory: nextValue as CompensationCaseFilters["issueCategory"],
              }))
            }
          >
            <SelectTrigger className="h-16 w-full rounded-2xl bg-white text-base">
              <SelectValue placeholder="Issue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All issues</SelectItem>
              {COMPENSATION_ISSUE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {getCompensationIssueCategoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <Select
              value={filters.dateRange}
              onValueChange={(nextValue) =>
                setFilters((current) => ({
                  ...current,
                  dateRange: nextValue as CompensationCaseFilters["dateRange"],
                }))
              }
            >
              <SelectTrigger className="h-16 w-full rounded-2xl bg-white text-base">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                {COMPENSATION_DATE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortKey}
              onValueChange={(nextValue) => setSortKey(nextValue as CompensationSortKey)}
            >
              <SelectTrigger className="h-16 w-full rounded-2xl bg-white text-base">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {COMPENSATION_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tab === "archive" && (
          <div className="mb-6 flex items-center justify-end gap-2">
            <Button
              variant={archiveViewMode === "list" ? "default" : "outline"}
              onClick={() => setArchiveViewMode("list")}
              className="rounded-lg"
            >
              List view
            </Button>
            <Button
              variant={archiveViewMode === "calendar" ? "default" : "outline"}
              onClick={() => setArchiveViewMode("calendar")}
              className="rounded-lg"
            >
              Calendar view
            </Button>
          </div>
        )}

        {tab === "archive" && archiveViewMode === "calendar" ? (
          <CompensationArchiveView cases={visibleCases} onOpen={openDetailDialog} />
        ) : visibleCases.length === 0 ? (
          <HistoryEmptyState
            title="No compensation cases match these filters."
            description="Try another tab or clear a few filters to see more results."
          />
        ) : (
          <div className="space-y-5">
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
                onMarkReady={
                  resolveCompensationStatus(caseRecord) === "pending" &&
                  caseRecord.fulfillmentMode === "later_claim"
                    ? handleMarkReady
                    : undefined
                }
                onComplete={openDetailDialog}
              />
            ))}
          </div>
        )}
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
        onMarkReady={handleMarkReady}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  cancelCompensationCaseRecord,
  completeCompensationCaseRecord,
  createCompensationCaseRecord,
  loadCompensationCases,
  markCompensationCaseReadyForClaim,
  saveCompensationCases,
  updateCompensationCaseRecord,
} from "@/lib/compensation-store";
import {
  COMPENSATION_STORAGE_KEY,
} from "@/lib/compensation-constants";
import type {
  CompensationCancelPayload,
  CompensationCase,
  CompensationCompletePayload,
  CompensationFormValue,
  CompensationMutationResult,
} from "@/lib/compensation-types";

type MutationFn = (
  currentCases: CompensationCase[]
) => { nextCases: CompensationCase[]; result: CompensationMutationResult } | null;

export function useCompensationCases() {
  const [cases, setCases] = useState<CompensationCase[]>(() => loadCompensationCases());

  useEffect(() => {
    saveCompensationCases(cases);
  }, [cases]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === COMPENSATION_STORAGE_KEY) {
        setCases(loadCompensationCases());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const runMutation = (
    mutation: MutationFn
  ): CompensationMutationResult | null => {
    const outcome = mutation(cases);
    if (!outcome) {
      return null;
    }

    setCases(outcome.nextCases);
    return outcome.result;
  };

  return {
    cases,
    createCase: (formValue: CompensationFormValue, actor: string) =>
      runMutation((currentCases) =>
        createCompensationCaseRecord(currentCases, formValue, actor)
      ),
    updateCase: (caseId: string, formValue: CompensationFormValue, actor: string) =>
      runMutation((currentCases) =>
        updateCompensationCaseRecord(currentCases, caseId, formValue, actor)
      ),
    markReadyForClaim: (caseId: string, actor: string) =>
      runMutation((currentCases) =>
        markCompensationCaseReadyForClaim(currentCases, caseId, actor)
      ),
    completeCase: (caseId: string, payload: CompensationCompletePayload) =>
      runMutation((currentCases) =>
        completeCompensationCaseRecord(currentCases, caseId, payload)
      ),
    cancelCase: (caseId: string, payload: CompensationCancelPayload) =>
      runMutation((currentCases) =>
        cancelCompensationCaseRecord(currentCases, caseId, payload)
      ),
  };
}

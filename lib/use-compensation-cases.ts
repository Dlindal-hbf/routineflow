"use client";

import { useEffect, useState } from "react";
import {
  cancelCompensationCaseRecord,
  completeCompensationCaseRecord,
  createCompensationCaseRecord,
  markCompensationCaseReadyForClaim,
  updateCompensationCaseRecord,
} from "@/lib/compensation-store";
import type {
  CompensationCancelPayload,
  CompensationCase,
  CompensationCompletePayload,
  CompensationFormValue,
  CompensationMutationResult,
} from "@/lib/compensation-types";
import { ensureLegacyBusinessDataMigrated } from "@/src/services/localMigrationService";
import {
  fetchCustomerInteractions,
  getCachedCustomerInteractions,
  upsertCustomerInteraction,
} from "@/src/services/customerInteractionService";

type MutationFn = (
  currentCases: CompensationCase[]
) => { nextCases: CompensationCase[]; result: CompensationMutationResult } | null;

export function useCompensationCases(enabled = true) {
  const cachedCases = enabled ? getCachedCustomerInteractions() : undefined;
  const hasCachedCases = cachedCases !== undefined;
  const [cases, setCases] = useState<CompensationCase[]>(cachedCases ?? []);
  const [loading, setLoading] = useState(enabled && !hasCachedCases);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        setLoading(!hasCachedCases);
        setRefreshing(hasCachedCases);
        setError(null);
        await ensureLegacyBusinessDataMigrated();
        const fetchedCases = await fetchCustomerInteractions();
        if (!isMounted) {
          return;
        }

        setCases(fetchedCases);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load compensation cases.");
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [enabled, hasCachedCases]);

  const runMutation = async (
    mutation: MutationFn
  ): Promise<CompensationMutationResult | null> => {
    const outcome = mutation(cases);
    if (!outcome) {
      return null;
    }

    try {
      setError(null);
      const persisted = await upsertCustomerInteraction(outcome.result.caseRecord);
      setCases((current) => {
        const withoutPrevious = current.filter((caseRecord) => {
          if (caseRecord.id === outcome.result.caseRecord.id) {
            return false;
          }

          return caseRecord.caseNumber !== persisted.caseNumber;
        });

        return [persisted, ...withoutPrevious].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        );
      });

      return {
        ...outcome.result,
        caseRecord: persisted,
      };
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to save compensation case."
      );
      return null;
    }
  };

  return {
    cases,
    loading,
    refreshing,
    error,
    reload: async () => {
      setLoading(cases.length === 0);
      setRefreshing(cases.length > 0);
      setError(null);
      try {
        const fetchedCases = await fetchCustomerInteractions();
        setCases(fetchedCases);
      } catch (reloadError) {
        setError(reloadError instanceof Error ? reloadError.message : "Failed to reload compensation cases.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
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

"use client";

import { useEffect, useRef, useState } from "react";
import {
  cancelCompensationCaseRecord,
  completeCompensationCaseRecord,
  createCompensationCaseRecord,
  deleteCompensationCaseRecord,
  reopenCompensationCaseRecord,
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
import { isCachedValueStale } from "@/src/services/clientCache";
import {
  deleteCustomerInteraction,
  fetchCustomerInteractions,
  getCachedCustomerInteractions,
  upsertCustomerInteraction,
} from "@/src/services/customerInteractionService";
import { runBackgroundSync } from "@/src/services/backgroundSync";

const CUSTOMER_INTERACTIONS_CACHE_KEY = "customer-interactions:latest";
const COMPENSATION_STALE_AFTER_MS = 30_000;

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
  const latestCasesRef = useRef(cases);

  useEffect(() => {
    latestCasesRef.current = cases;
  }, [cases]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const shouldRefresh =
      !hasCachedCases ||
      isCachedValueStale(CUSTOMER_INTERACTIONS_CACHE_KEY, COMPENSATION_STALE_AFTER_MS);

    const load = async () => {
      if (!shouldRefresh) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setLoading(!hasCachedCases);
        setRefreshing(hasCachedCases);
        setError(null);
        const fetchedCases = await runBackgroundSync(
          async () => {
            await ensureLegacyBusinessDataMigrated();
            return fetchCustomerInteractions();
          },
          {
            errorMessage:
              "Kunne ikke oppdatere kompensasjonssaker. Viser sist lagrede data.",
          }
        );
        if (!isMounted) {
          return;
        }

        setCases(fetchedCases);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Kunne ikke laste kompensasjonssaker.");
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

  const runDelete = async (
    caseId: string
  ): Promise<CompensationMutationResult | null> => {
    const currentCases = latestCasesRef.current;
    const outcome = deleteCompensationCaseRecord(currentCases, caseId);
    if (!outcome) {
      return null;
    }

    setError(null);
    setCases(outcome.nextCases);

    void runBackgroundSync(
      () => deleteCustomerInteraction(caseId),
      {
        errorMessage: "Kunne ikke slette kompensasjonssaken. Endringen ble rullet tilbake.",
        onError: (mutationError) => {
          setError(
            mutationError instanceof Error
              ? mutationError.message
              : "Kunne ikke slette kompensasjonssaken."
          );
          if (latestCasesRef.current === outcome.nextCases) {
            setCases(currentCases);
          }
        },
      }
    ).catch(() => undefined);

    return outcome.result;
  };

  const runMutation = async (
    mutation: MutationFn
  ): Promise<CompensationMutationResult | null> => {
    const currentCases = latestCasesRef.current;
    const outcome = mutation(currentCases);
    if (!outcome) {
      return null;
    }

    setError(null);
    setCases(outcome.nextCases);

    void runBackgroundSync(
      () => upsertCustomerInteraction(outcome.result.caseRecord),
      {
        errorMessage: "Kunne ikke lagre kompensasjonssaken. Endringen ble rullet tilbake.",
        onError: (mutationError) => {
          setError(
            mutationError instanceof Error
              ? mutationError.message
              : "Kunne ikke lagre kompensasjonssaken."
          );
          if (latestCasesRef.current === outcome.nextCases) {
            setCases(currentCases);
          }
        },
      }
    )
      .then((persisted) => {
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
      })
      .catch(() => undefined);

    return outcome.result;
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
        const fetchedCases = await runBackgroundSync(() => fetchCustomerInteractions(), {
          errorMessage:
            "Kunne ikke oppdatere kompensasjonssaker. Viser sist lagrede data.",
        });
        setCases(fetchedCases);
      } catch (reloadError) {
        setError(reloadError instanceof Error ? reloadError.message : "Kunne ikke laste inn kompensasjonssaker på nytt.");
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
    completeCase: (caseId: string, payload: CompensationCompletePayload) =>
      runMutation((currentCases) =>
        completeCompensationCaseRecord(currentCases, caseId, payload)
      ),
    reopenCase: (caseId: string, actor: string) =>
      runMutation((currentCases) =>
        reopenCompensationCaseRecord(currentCases, caseId, actor)
      ),
    cancelCase: (caseId: string, payload: CompensationCancelPayload) =>
      runMutation((currentCases) =>
        cancelCompensationCaseRecord(currentCases, caseId, payload)
      ),
    deleteCase: (caseId: string) => runDelete(caseId),
  };
}

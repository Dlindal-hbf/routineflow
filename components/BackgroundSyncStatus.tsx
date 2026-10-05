"use client";

import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissBackgroundSyncToast,
  getBackgroundSyncSnapshot,
  subscribeToBackgroundSync,
} from "@/src/services/backgroundSync";

const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 400;

export default function BackgroundSyncStatus() {
  const [snapshot, setSnapshot] = useState(getBackgroundSyncSnapshot);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => subscribeToBackgroundSync(() => setSnapshot(getBackgroundSyncSnapshot())), []);

  useEffect(() => {
    if (snapshot.pendingCount > 0) {
      const timeout = window.setTimeout(() => {
        setShowIndicator(true);
      }, SHOW_DELAY_MS);

      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setShowIndicator(false);
    }, HIDE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [snapshot.pendingCount]);

  if (!showIndicator && snapshot.toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-3">
      {showIndicator && (
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-lg backdrop-blur">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          <span>
            Synkroniserer i bakgrunnen{snapshot.pendingCount > 1 ? ` (${snapshot.pendingCount})` : ""}
          </span>
        </div>
      )}

      {snapshot.toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="flex-1">{toast.message}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 rounded-full p-0 text-slate-500 hover:text-slate-900"
            onClick={() => dismissBackgroundSyncToast(toast.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

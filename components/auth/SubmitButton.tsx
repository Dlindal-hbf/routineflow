"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SubmitButtonProps {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
}

export function SubmitButton({ children, pending = false, pendingLabel = "Behandler …" }: SubmitButtonProps) {
  const status = useFormStatus();
  const busy = pending || status.pending;
  return (
    <Button type="submit" disabled={busy} className="h-11 w-full whitespace-normal rounded-md bg-[#771816] px-4 text-white hover:bg-[#601311] focus-visible:ring-[#771816]/40">
      {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
      <span>{busy ? pendingLabel : children}</span>
    </Button>
  );
}

export default SubmitButton;

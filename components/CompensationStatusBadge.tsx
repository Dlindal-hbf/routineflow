"use client";

import { Badge } from "@/components/ui/badge";
import type { CompensationStatus } from "@/lib/compensation-types";
import {
  getCompensationVisibleStatusBadgeClassName,
  getCompensationVisibleStatusLabel,
  getCompensationVisibleStatus,
} from "@/lib/compensation-utils";

interface CompensationStatusBadgeProps {
  status: CompensationStatus;
}

export default function CompensationStatusBadge({
  status,
}: CompensationStatusBadgeProps) {
  const visibleStatus = getCompensationVisibleStatus(status);

  return (
    <Badge
      variant="outline"
      className={`rounded-full border px-3 py-1 text-sm ${getCompensationVisibleStatusBadgeClassName(
        visibleStatus
      )}`}
    >
      {getCompensationVisibleStatusLabel(visibleStatus)}
    </Badge>
  );
}

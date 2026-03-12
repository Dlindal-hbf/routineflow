import { processDueResets } from "@/src/lib/scheduling/reset-engine";
import { ResetEngineInput } from "@/src/lib/scheduling/reset-types";

export function processResets(input: ResetEngineInput, now: Date = new Date()) {
  return processDueResets(input, now);
}

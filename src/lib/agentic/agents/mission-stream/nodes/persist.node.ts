import prisma from "../../../../../../prisma/prisma";
import { MAX_PROGRESS_EVENTS_PER_ATTEMPT, safeProgress, type CareerProgress } from "../tools/events.tool";

export type ProgressScope = Readonly<{ userId: string; missionId: string; runId: string; attempt: number }>;
/** Serialize writes in process so the UI sees steps in order. Never store private tool data. */
export function createMissionProgressWriter(scope: ProgressScope) {
  let pending: Promise<void> = Promise.resolve();
  let accepted = 0;
  let failed = false;
  const emit = (value: CareerProgress) => {
    const safe = safeProgress(value);
    if (accepted >= MAX_PROGRESS_EVENTS_PER_ATTEMPT) return;
    accepted += 1;
    pending = pending.then(async () => {
      await prisma.careerMissionProgressEvent.create({ data: { ...scope, ...safe } });
    }).catch(() => { failed = true; }); // telemetry cannot change career mission outcome
  };
  return { emit, flush: async (): Promise<boolean> => { await pending; return !failed; } };
}

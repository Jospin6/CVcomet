/** Server-side event adapter; LangGraph execution remains in the Career Supervisor. */
import type { AgentEvent } from "../../../core/contracts.ts";
import { mapGraphProgress, type CareerProgress } from "../tools/events.tool";
import { createMissionProgressWriter, type ProgressScope } from "../nodes/persist.node";

export function createMissionStreamAgent(scope: ProgressScope) {
  const writer = createMissionProgressWriter(scope);
  const onGraphEvent = (event: AgentEvent) => {
    const progress = mapGraphProgress(event);
    if (progress) writer.emit(progress);
  };
  const onProgress = (event: CareerProgress) => writer.emit(event);
  return { onGraphEvent, onProgress, flush: writer.flush };
}

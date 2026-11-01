import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { extractResumeTool, type ProfileResumeDocument } from "../tools/extract-resume.tool";
import type { ExtractedProfile } from "../agent/state";

export function createExtractNode(scope: ExecutionScope, document: ProfileResumeDocument,
  extract: (doc: ProfileResumeDocument, signal: AbortSignal) => Promise<ExtractedProfile> =
    (doc, signal) => extractResumeTool(scope.identity, doc, signal),
) {
  return async () => ({ extracted: await extract(document, scope.budget.signal) });
}

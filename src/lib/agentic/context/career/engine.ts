import { AgenticError } from "../../core/errors.ts";
import { boundedModelContext } from "../../core/context/limits.ts";
import type { CareerContextRepository, CareerContextRequest, CareerContextSnapshot, CareerContextKind } from "./contracts.ts";
import { parseContextRequest } from "./policy.ts";
import { projectProfile, projectResume, projectJob, projectApplication, projectCoverLetter } from "./projectors.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
}

/**
 * Only called by trusted server-side agents with an identity obtained from the session.
 * All payloads are transient; do not return snapshots from an HTTP route or checkpoint
 * them in LangGraph state. A graph should checkpoint IDs/revisions, then reload facts.
 */
export function createCareerContextEngine(repository: CareerContextRepository) {
  return {
    async load(request: CareerContextRequest): Promise<CareerContextSnapshot> {
      const selectors = parseContextRequest(request);
      const actorId = selectors.actorId;
      assertActive(request.signal);
      const facts: Partial<Record<CareerContextKind, unknown>> = {};
      const references: Partial<Record<CareerContextKind, { id: string; revision?: number }>> = {};

      async function owned(kind: CareerContextKind, id: string, read: () => Promise<unknown>): Promise<Record<string, unknown>> {
        assertActive(request.signal);
        let row: unknown;
        try { row = await read(); }
        catch { throw new AgenticError("AGENT_CONTEXT_UNAVAILABLE", 503); }
        assertActive(request.signal);
        if (!isRecord(row)) throw new AgenticError("AGENT_CONTEXT_NOT_FOUND", 404);
        const revision = typeof row.revision === "number" && Number.isSafeInteger(row.revision)
          ? row.revision : undefined;
        references[kind] = { id, ...(revision === undefined ? {} : { revision }) };
        return row;
      }

      // Read application first so all other selected resources can be checked for
      // consistency with the exact user-owned dossier, rather than mixing documents.
      if (selectors.applicationId) {
        const app = await owned("application", selectors.applicationId, () =>
          repository.getApplication(actorId, selectors.applicationId!));
        for (const [key, expected] of [
          ["cvId", selectors.resumeId], ["jobId", selectors.jobId],
          ["coverLetterId", selectors.coverLetterId],
        ] as const) {
          if (expected && app[key] != null && app[key] !== expected) {
            throw new AgenticError("AGENT_CONTEXT_INCONSISTENT", 409);
          }
        }
        facts.application = projectApplication(app);
      }
      if (selectors.profile) {
        const profile = await owned("profile", actorId, () => repository.getProfile(actorId));
        facts.profile = projectProfile(profile, request.identity.agentId);
      }
      if (selectors.resumeId) {
        const resume = await owned("resume", selectors.resumeId, () =>
          repository.getResume(actorId, selectors.resumeId!));
        // Only the Resume Editor agent can inspect hidden editing sections;
        // all evaluation, discovery and drafting agents see rendered sections.
        facts.resume = projectResume(resume, request.identity.agentId !== "resume");
      }
      if (selectors.jobId) {
        const job = await owned("job", selectors.jobId, () =>
          repository.getJob(actorId, selectors.jobId!));
        facts.job = projectJob(job);
      }
      if (selectors.coverLetterId) {
        const letter = await owned("cover-letter", selectors.coverLetterId, () =>
          repository.getCoverLetter(actorId, selectors.coverLetterId!));
        // Prevent mixing a letter whose attached job or CV differs from the requested one.
        if ((selectors.resumeId && letter.cvId != null && letter.cvId !== selectors.resumeId) ||
            (selectors.jobId && letter.jobId != null && letter.jobId !== selectors.jobId)) {
          throw new AgenticError("AGENT_CONTEXT_INCONSISTENT", 409);
        }
        facts["cover-letter"] = projectCoverLetter(letter);
      }
      assertActive(request.signal);
      let modelContext: string;
      try { modelContext = boundedModelContext(facts); }
      catch { throw new AgenticError("AGENT_CONTEXT_LIMIT_EXCEEDED", 413); }
      // References are deliberately not serialized into modelContext.
      return { facts, references, modelContext };
    },
  };
}

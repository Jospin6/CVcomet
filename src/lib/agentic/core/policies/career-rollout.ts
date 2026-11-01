/** Server-side deterministic rollout and emergency rollback for the Career Assistant only.
 * The authenticated account ID must come from the server, never the request body.
 * This function emits no raw actor IDs or prompts and has no mutable state.
 */
import { createHash } from "node:crypto";

export type CareerAgentEngine = "GRAPH" | "LEGACY";
export type CareerRolloutConfiguration = Readonly<{
  [key: string]: string | undefined; // Compatible with NodeJS.ProcessEnv without weak-type errors.
  CVCOMET_CAREER_AGENT_ENGINE?: string;
  CVCOMET_CAREER_AGENT_ROLLOUT_PERCENT?: string;
  CVCOMET_CAREER_AGENT_KILL_SWITCH?: string;
}>;

/** A change to this version redistributes the cohort; keep fixed for a rollout. */
const COHORT_VERSION = "cvcomet-career-supervisor:v1:";

export function careerRolloutBucket(actorId: string): number {
  if (!actorId || actorId.trim() !== actorId || actorId.length > 256) {
    throw new Error("INVALID_AUTHENTICATED_ACTOR");
  }
  const digest = createHash("sha256").update(COHORT_VERSION).update(actorId).digest();
  return digest.readUInt32BE(0) / 0x100000000 * 100;
}

export function chooseCareerAgentEngine(actorId: string, settings: CareerRolloutConfiguration): CareerAgentEngine {
  // Explicit rollback always takes precedence; never automatically rerun a failed model call.
  if (["true", "1", "on"].includes((settings.CVCOMET_CAREER_AGENT_KILL_SWITCH ?? "").trim().toLowerCase())) {
    return "LEGACY";
  }
  const mode = (settings.CVCOMET_CAREER_AGENT_ENGINE ?? "graph").trim().toLowerCase();
  if (mode === "graph") return "GRAPH"; // Preserve existing stage-16..19 behavior when unset.
  if (mode === "legacy") return "LEGACY";
  if (mode !== "rollout") return "LEGACY"; // Unknown deployment configuration fails closed.
  const raw = settings.CVCOMET_CAREER_AGENT_ROLLOUT_PERCENT ?? "0";
  if (!/^(?:100|\d{1,2})(?:\.\d{1,2})?$/.test(raw)) return "LEGACY";
  const percent = Number(raw);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return "LEGACY";
  if (percent === 0) return "LEGACY";
  if (percent === 100) return "GRAPH";
  return careerRolloutBucket(actorId) < percent ? "GRAPH" : "LEGACY";
}

/** Nonidentifying rollout metadata only; do not expose the actor's bucket. */
export function safeCareerRolloutConfig(settings: CareerRolloutConfiguration) {
  const mode = (settings.CVCOMET_CAREER_AGENT_ENGINE ?? "graph").trim().toLowerCase();
  const valid = mode === "legacy" || mode === "graph" || mode === "rollout";
  const raw = settings.CVCOMET_CAREER_AGENT_ROLLOUT_PERCENT ?? "0";
  const percent = /^(?:100|\d{1,2})(?:\.\d{1,2})?$/.test(raw) && Number(raw) <= 100 ? Number(raw) : null;
  const killSwitch = ["true", "1", "on"].includes((settings.CVCOMET_CAREER_AGENT_KILL_SWITCH ?? "").trim().toLowerCase());
  return { mode: valid ? mode : "invalid", percent: mode === "rollout" ? percent : null, killSwitch,
    effectiveMode: killSwitch ? "legacy" : valid ? mode : "legacy" };
}

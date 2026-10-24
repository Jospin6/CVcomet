/** Pure phase-07 policy; keep it importable in node:test without Prisma. */
import { CareerContractError } from "./contracts.ts";

export const MISSION_LEASE_MS = 90_000;
export const MISSION_HISTORY_LIMIT = 6;
export const MISSION_MAX_CONTEXT_CHARS = 7_200;
export const MISSION_MAX_LIST = 30;

export type MissionTurn = Readonly<{ question: string; answer: string }>;
export type AgentHistoryMessage = Readonly<{ role: "user" | "assistant"; content: string }>;

/** Oldest-to-newest turns; no private tool results or pending answers. */
export function contextFromCompletedRuns(runs: readonly MissionTurn[]): AgentHistoryMessage[] {
  const selected: AgentHistoryMessage[] = [];
  let budget = MISSION_MAX_CONTEXT_CHARS;
  for (const run of [...runs].slice(-MISSION_HISTORY_LIMIT).reverse()) {
    if (!run.question?.trim() || !run.answer?.trim()) continue;
    const question = run.question.trim().slice(0, 1600);
    const answer = run.answer.trim().slice(0, 2200);
    const amount = question.length + answer.length;
    if (amount > budget) break;
    budget -= amount;
    selected.unshift({ role: "assistant", content: answer });
    selected.unshift({ role: "user", content: question });
  }
  return selected;
}

export function assertMissionRequestKey(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CareerContractError(400, "INVALID_REQUEST_KEY");
  }
  return value.toLowerCase();
}

export function assertSameMissionRequest(original: string, next: string): void {
  if (original !== next) throw new CareerContractError(409, "REQUEST_KEY_REUSED");
}

export function requireApprovalDecision(status: string, expiresAt: Date, now: Date, decision: string): "APPROVED" | "REJECTED" {
  if (status !== "PENDING") throw new CareerContractError(409, "APPROVAL_ALREADY_DECIDED");
  if (expiresAt.getTime() <= now.getTime()) throw new CareerContractError(410, "APPROVAL_EXPIRED");
  if (decision === "approve") return "APPROVED";
  if (decision === "reject") return "REJECTED";
  throw new CareerContractError(400, "INVALID_APPROVAL_DECISION");
}

/**
 * Pure bounded execution core for Career Agent v1.
 * No database, provider, auth session, or browser imports: deterministic tests
 * can exercise exactly the same policy gates as the deployed agent.
 */
import { CAREER_READ_TOOLS, CareerContractError, type CareerReadTool } from "./contracts.ts";

export const AGENT_MAX_READS = 3;
export const AGENT_MAX_RESULT_CHARS = 10000;
export const AGENT_MAX_MESSAGE_CHARS = 6000;

export type AgentCall = Readonly<{ tool: CareerReadTool; input: Record<string, unknown> }>;
export type AgentRead = Readonly<{
  tool: CareerReadTool;
  source: "owner_confirmed" | "self_reported";
  result: unknown;
  truncated: boolean;
}>;
export type AgentStep = Readonly<{ tool: CareerReadTool; status: "completed" }>;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input) &&
    (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null);
}

/** Deliberately fail closed even if the model provided syntactically valid JSON. */
export function validateAgentCalls(proposed: unknown): AgentCall[] {
  if (!Array.isArray(proposed) || proposed.length > AGENT_MAX_READS) {
    throw new CareerContractError(422, "AGENT_PLAN_REJECTED");
  }
  const seen = new Set<string>();
  return proposed.map((candidate): AgentCall => {
    if (!isPlainObject(candidate) || typeof candidate.tool !== "string" ||
      !((CAREER_READ_TOOLS as readonly string[]).includes(candidate.tool)) ||
      !isPlainObject(candidate.input) || JSON.stringify(candidate.input).length > 1024 ||
      Object.keys(candidate).some(k => k !== "tool" && k !== "input") ||
      seen.has(candidate.tool)) {
      throw new CareerContractError(422, "AGENT_PLAN_REJECTED");
    }
    seen.add(candidate.tool);
    return { tool: candidate.tool as CareerReadTool, input: candidate.input };
  });
}

/**
 * A selected application is trusted only after the server verifies ownership.
 * Read it deterministically rather than depending on the LLM to select the
 * correct tool. This read is counted in the existing three-tool budget.
 */
export function withApplicationContext(proposed: unknown, applicationId?: string): AgentCall[] {
  const calls = validateAgentCalls(proposed);
  if (!applicationId) return calls;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
    throw new CareerContractError(400, "INVALID_APPLICATION_ID");
  }
  const contextual: AgentCall = {
    tool: "get_my_application",
    input: { applicationId },
  };
  const otherCalls = calls
    .filter(call => call.tool !== "get_my_application")
    .slice(0, AGENT_MAX_READS - 1);
  return [contextual, ...otherCalls];
}

/** Avoid passing arbitrarily large DB records to an AI provider or a client. */
export function boundAgentRead(value: unknown, maxChars = AGENT_MAX_RESULT_CHARS) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return { result: null, truncated: false };
  if (serialized.length <= maxChars) return { result: value, truncated: false };
  return { result: { excerpt: serialized.slice(0, maxChars), omitted: true }, truncated: true };
}

/**
 * Tool executor MUST enforce actor ownership in its DB queries, as the existing
 * Career OS tool registry does. Never accept actor IDs from a model's arguments.
 */
/** Time-limit even a slow DB READ. The underlying query may finish later, but
 * it cannot cause a write because this executor is read-only. */
async function withAgentDeadline<T>(action: () => Promise<T>, options: { signal?: AbortSignal; deadline?: number }): Promise<T> {
  if (options.signal?.aborted || (options.deadline !== undefined && Date.now() >= options.deadline)) {
    throw new CareerContractError(504, "AGENT_TIME_BUDGET_EXCEEDED");
  }
  return new Promise<T>((resolve, reject) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (callback: () => void) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => finish(() => reject(new CareerContractError(504, "AGENT_TIME_BUDGET_EXCEEDED")));
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    if (options.deadline !== undefined) timer = setTimeout(abort, Math.max(1, options.deadline - Date.now()));
    Promise.resolve().then(action).then(
      value => finish(() => resolve(value)),
      error => finish(() => reject(error)),
    );
  });
}

export async function executeAgentReads(
  proposed: unknown,
  execute: (tool: CareerReadTool, input: Record<string, unknown>) => Promise<unknown>,
  options: { signal?: AbortSignal; deadline?: number } = {},
): Promise<{ reads: AgentRead[]; steps: AgentStep[] }> {
  const calls = validateAgentCalls(proposed);
  const reads: AgentRead[] = [];
  const steps: AgentStep[] = [];
  for (const call of calls) {
    if (options.signal?.aborted || (options.deadline !== undefined && Date.now() >= options.deadline)) {
      throw new CareerContractError(504, "AGENT_TIME_BUDGET_EXCEEDED");
    }
    const raw = await withAgentDeadline(() => execute(call.tool, call.input), options);
    const { result, truncated } = boundAgentRead(raw);
    reads.push({ tool: call.tool,
      source: "self_reported",
      result, truncated });
    steps.push({ tool: call.tool, status: "completed" });
  }
  return { reads, steps };
}

export function assertAgentAnswer(text: unknown): string {
  if (typeof text !== "string" || !text.trim()) throw new CareerContractError(502, "AGENT_EMPTY_ANSWER");
  return text.trim().slice(0, 10000);
}

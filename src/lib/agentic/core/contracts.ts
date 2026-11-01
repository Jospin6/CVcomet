/** Shared execution contracts: no domain records or personal data in telemetry. */
export type AgentAccess =
  | Readonly<{ kind: "authenticated"; actorId: string }>
  | Readonly<{ kind: "public_demo" }>;

export type AgentRunIdentity = Readonly<{
  runId: string;
  agentId: string;
  access: AgentAccess;
}>;

export type AgentEventKind =
  | "run.started"
  | "run.completed"
  | "run.paused"
  | "run.failed"
  | "run.cancelled"
  | "step.started"
  | "step.completed"
  | "step.failed";

/** Strict allowlist: do not emit prompts, inputs, tool arguments, CVs or model output. */
export type AgentEvent = Readonly<{
  kind: AgentEventKind;
  runId: string;
  agentId: string;
  at: string;
  step?: string;
  code?: string;
}>;

export type AgentEventListener = (event: AgentEvent) => void;

/** The minimal invoke contract implemented by compiled LangGraph graphs. */
export type AgentInvokeConfig = Readonly<{
  signal?: AbortSignal;
  recursionLimit?: number;
  configurable?: Readonly<{ thread_id: string }>;
}>;

export type InvocableAgentGraph<TInput, TOutput> = {
  invoke: (
    input: TInput,
    config?: AgentInvokeConfig,
  ) => Promise<TOutput>;
};

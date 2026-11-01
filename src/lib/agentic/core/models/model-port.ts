/**
 * Agentic nodes may consume this port, backed later by CVComet's existing
 * src/lib/ai/model.ts and its quota/usage accounting. Do not initialize a new
 * provider or bypass billing from the LangGraph layer.
 */
export type AgentModelPort<TRequest, TResult> = Readonly<{
  generate: (request: TRequest, options: { signal: AbortSignal }) => Promise<TResult>;
}>;

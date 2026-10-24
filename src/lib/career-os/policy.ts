import { CareerContractError, type CareerEffect } from "./contracts.ts";

/** Subject identity is ALWAYS supplied by a trusted server session, never LLM input. */
export type CareerActor = Readonly<{ id: string; role: "USER" | "ADMIN" }>;
export type ToolAuthorization = Readonly<{
  actor: CareerActor | null;
  ownerId: string;
  effect: CareerEffect;
  approved?: boolean;
}>;

/** Admin access never implicitly broadens the agent's scope to another account. */
export function authorizeCareerTool({ actor, ownerId, effect, approved }: ToolAuthorization): void {
  if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
  if (actor.id !== ownerId) throw new CareerContractError(403, "FORBIDDEN");
  if (effect !== "read" && effect !== "draft") {
    // Planned side-effect tools are disabled regardless of the model's claims.
    // A durable, exact-action approval protocol is required in a future phase.
    throw new CareerContractError(403, "ACTION_NOT_ENABLED");
  }
  // A caller-supplied `approved: true` is not an authorization token.
  void approved;
}

/** API-level guard: only the four explicitly implemented READ tools execute. */
export function requireEnabledReadTool(toolId: string, available: readonly string[]): void {
  if (!available.includes(toolId)) throw new CareerContractError(404, "TOOL_NOT_AVAILABLE");
}

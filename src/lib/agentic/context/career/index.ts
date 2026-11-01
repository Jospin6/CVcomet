/** Pure entrypoint. Import prisma-repository.ts explicitly only inside server nodes. */
export { createCareerContextEngine } from "./engine.ts";
export { parseContextRequest, CAREER_CONTEXT_SCOPES } from "./policy.ts";
export type { CareerContextRequest, CareerContextRepository, CareerContextSnapshot, CareerContextKind } from "./contracts.ts";
export { registerCareerContextReadTool } from "./tool.ts";

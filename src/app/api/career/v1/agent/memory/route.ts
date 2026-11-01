import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { MEMORY_AGENTS, MEMORY_KEYS } from "@/lib/agentic/memory/tools/policy.tool";
import { listMemoryPreferences, createMemoryPreference } from "@/lib/agentic/memory/tools/memory.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const input = z.object({ apiVersion: z.literal("v1"), key: z.enum(MEMORY_KEYS),
  value: z.string().trim().min(1).max(120),
  allowedAgents: z.array(z.enum(MEMORY_AGENTS)).min(1).max(MEMORY_AGENTS.length).refine((items: readonly string[]) => new Set(items).size === items.length),
}).strict();

export async function GET() {
  return withCareerHttp("memory.list", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return listMemoryPreferences(actor.id);
  });
}
export async function POST(req: Request) {
  return withCareerHttp("memory.create", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const { apiVersion: _version, ...record } = input.parse(await profileJson(req, 2048));
    void _version;
    return createMemoryPreference(actor.id, record);
  }, 201);
}

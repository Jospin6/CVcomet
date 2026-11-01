import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { MEMORY_AGENTS, MEMORY_KEYS } from "@/lib/agentic/memory/tools/policy.tool";
import { updateMemoryPreference, deleteMemoryPreference } from "@/lib/agentic/memory/tools/memory.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.string().uuid();
const update = z.object({ apiVersion: z.literal("v1"), expectedRevision: z.number().int().min(0),
  key: z.enum(MEMORY_KEYS), value: z.string().trim().min(1).max(120),
  allowedAgents: z.array(z.enum(MEMORY_AGENTS)).min(1).max(MEMORY_AGENTS.length).refine((items: readonly string[]) => new Set(items).size === items.length),
}).strict();
const remove = z.object({ apiVersion: z.literal("v1"), expectedRevision: z.number().int().min(0) }).strict();
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Context) {
  return withCareerHttp("memory.update", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const uid = id.parse((await ctx.params).id);
    const { expectedRevision, apiVersion: _version, ...value } = update.parse(await profileJson(req, 2048));
    void _version;
    return updateMemoryPreference(actor.id, uid, expectedRevision, value);
  });
}
export async function DELETE(req: Request, ctx: Context) {
  return withCareerHttp("memory.delete", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const uid = id.parse((await ctx.params).id);
    const payload = remove.parse(await profileJson(req, 512));
    return deleteMemoryPreference(actor.id, uid, payload.expectedRevision);
  });
}

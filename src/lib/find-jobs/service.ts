import type { UnifiedJob } from "./types";
import { providers } from "./providers";
import prisma from "../../../prisma/prisma";
declare global {
  // eslint-disable-next-line no-var
  var findJobsCache: Map<string, { expires: number; jobs: UnifiedJob[]; warnings: string[]; totalAvailable: number; page: number; pageSize: number }> | undefined;
}
const cache = global.findJobsCache ?? new Map(); if (process.env.NODE_ENV !== "production") global.findJobsCache = cache;
export async function searchJobs(q: string, page: number) {
  const key = `${q.toLowerCase()}:${page}`, hit = cache.get(key); if (hit && hit.expires > Date.now()) return hit;
  const settled = await Promise.allSettled(providers.slice(0, 4).map(provider => provider(q, page))), warnings: string[] = [];
  const live = settled.flatMap((result, index) => { if (result.status === "rejected") { warnings.push(`${providers[index].name}: temporarily unavailable`); return []; } if (result.value.warning) warnings.push(result.value.warning); return result.value.jobs; });
  const term = q.toLowerCase(), where = { active: true, ...(term ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { company: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}) };
  const [stored, totalAvailable] = await Promise.all([prisma.externalJob.findMany({ where, orderBy: { lastSeenAt: "desc" }, skip: (page - 1) * 30, take: 30 }), prisma.externalJob.count({ where })]);
  const persisted: UnifiedJob[] = stored.map(item => ({ id: `${item.provider}:${item.externalId}`, provider: item.provider as UnifiedJob["provider"], externalId: item.externalId, title: item.title, company: item.company, description: item.description, logoUrl: null, location: item.location, remote: null, contractType: item.contractType, seniority: null, salaryMin: null, salaryMax: null, currency: null, publishedAt: item.publishedAt?.toISOString() || null, expiresAt: null, sourceUrl: item.sourceUrl, applyUrl: item.applyUrl, skills: [], eligibleCountries: [], attribution: `Source: ${item.provider === "GREENHOUSE" ? "Greenhouse" : "Lever"}` }));
  const seen = new Set<string>(), jobs = [...persisted, ...live].filter(item => { const fingerprint = `${item.company.toLowerCase()}|${item.title.toLowerCase()}|${item.location?.toLowerCase() || ""}`; if (seen.has(fingerprint)) return false; seen.add(fingerprint); return true; }).slice(0, 30);
  const value = { jobs, warnings, totalAvailable, page, pageSize: 30, expires: Date.now() + 60 * 1000 }; cache.set(key, value); return value;
}

export { rankJobs } from "./ranking";

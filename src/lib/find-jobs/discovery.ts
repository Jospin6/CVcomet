import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { htmlToJobMarkdown } from "./description";

export type BoardCandidate = { provider: "GREENHOUSE" | "LEVER"; region: "GLOBAL" | "EU"; slug: string; source: string };
const validSlug = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
const allowedHosts = ["boards-api.greenhouse.io", "api.lever.co", "api.eu.lever.co", "raw.githubusercontent.com"];

export function extractBoardUrl(value: string): BoardCandidate | null {
  try {
    const url = new URL(value), part = url.pathname.split("/").filter(Boolean)[0];
    if (!part || !validSlug.test(part)) return null;
    if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(url.hostname)) return { provider: "GREENHOUSE", region: "GLOBAL", slug: part.toLowerCase(), source: "catalog_url" };
    if (url.hostname === "jobs.lever.co") return { provider: "LEVER", region: "GLOBAL", slug: part.toLowerCase(), source: "catalog_url" };
    if (url.hostname === "jobs.eu.lever.co") return { provider: "LEVER", region: "EU", slug: part.toLowerCase(), source: "catalog_url" };
    return null;
  } catch { return null; }
}

async function safeJson(urlValue: string) {
  const url = new URL(urlValue);
  if (!allowedHosts.includes(url.hostname)) throw new Error("DOMAIN_NOT_ALLOWED");
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "CVComet/1.0 job-board-discovery" }, redirect: "manual", signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (response.status === 429) throw new Error(`RATE_LIMIT:${response.headers.get("retry-after") || "unknown"}`);
  if (response.status >= 300 && response.status < 400) throw new Error("REDIRECT_REJECTED");
  if (response.status === 404) throw new Error("NOT_FOUND");
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  if (Number(response.headers.get("content-length") || 0) > 25_000_000) throw new Error("RESPONSE_TOO_LARGE");
  const body = await response.text();
  if (body.length > 25_000_000) throw new Error("RESPONSE_TOO_LARGE");
  return JSON.parse(body) as unknown;
}

const parsedDate = (value: unknown) => { const d = new Date(String(value || "")); return Number.isNaN(d.getTime()) ? null : d; };
type Normalized = { externalId: string; title: string; company: string; description: string; location: string | null; contractType: string | null; sourceUrl: string; applyUrl: string; publishedAt: Date | null };

async function readBoard(candidate: BoardCandidate): Promise<Normalized[]> {
  if (candidate.provider === "GREENHOUSE") {
    let raw: unknown;
    try { raw = await safeJson(`https://boards-api.greenhouse.io/v1/boards/${candidate.slug}/jobs?content=true`); }
    catch (error) { if (!(error instanceof Error) || error.message !== "RESPONSE_TOO_LARGE") throw error; raw = await safeJson(`https://boards-api.greenhouse.io/v1/boards/${candidate.slug}/jobs`); }
    const data = z.object({ jobs: z.array(z.record(z.string(), z.unknown())).default([]) }).parse(raw);
    return data.jobs.map(row => { const location = row.location as Record<string, unknown> | undefined; return { externalId: `${candidate.slug}:${String(row.id)}`, title: String(row.title || ""), company: candidate.slug, description: htmlToJobMarkdown(row.content), location: location?.name ? String(location.name) : null, contractType: null, sourceUrl: String(row.absolute_url || ""), applyUrl: String(row.absolute_url || ""), publishedAt: parsedDate(row.first_published || row.created_at) }; }).filter(job => job.title && job.sourceUrl);
  }
  const host = candidate.region === "EU" ? "api.eu.lever.co" : "api.lever.co";
  const data = z.array(z.record(z.string(), z.unknown())).parse(await safeJson(`https://${host}/v0/postings/${candidate.slug}?mode=json`));
  return data.map(row => { const categories = row.categories as Record<string, unknown> | undefined; return { externalId: `${candidate.region}:${candidate.slug}:${String(row.id)}`, title: String(row.text || ""), company: candidate.slug, description: htmlToJobMarkdown(row.description || row.descriptionPlain), location: categories?.location ? String(categories.location) : null, contractType: categories?.commitment ? String(categories.commitment) : null, sourceUrl: String(row.hostedUrl || ""), applyUrl: String(row.applyUrl || row.hostedUrl || ""), publishedAt: parsedDate(row.createdAt) }; }).filter(job => job.title && job.sourceUrl);
}

export async function verifyBoard(candidate: BoardCandidate) {
  const jobs = await readBoard(candidate);
  return { valid: true, activeJobs: jobs.length, jobs };
}

async function candidates() {
  const found: BoardCandidate[] = [];
  try {
    const seed = z.object({ greenhouse: z.array(z.string()).default([]), lever: z.array(z.string()).default([]) }).parse(await safeJson("https://raw.githubusercontent.com/mherzog4/job-boards/main/boards.seed.json"));
    for (const slug of seed.greenhouse) if (validSlug.test(slug)) found.push({ provider: "GREENHOUSE", region: "GLOBAL", slug: slug.toLowerCase(), source: "mherzog4/job-boards MIT seed" });
    for (const slug of seed.lever) if (validSlug.test(slug)) found.push({ provider: "LEVER", region: "GLOBAL", slug: slug.toLowerCase(), source: "mherzog4/job-boards MIT seed" });
  } catch { /* Existing and configured sources remain usable. */ }
  for (const [provider, key] of [["GREENHOUSE", "GREENHOUSE_JOB_BOARDS"], ["LEVER", "LEVER_JOB_SITES"]] as const) for (const slug of (process.env[key] || "").split(",").map(x => x.trim()).filter(Boolean)) if (validSlug.test(slug)) found.push({ provider, region: "GLOBAL", slug: slug.toLowerCase(), source: "environment_seed" });
  const knownUrls = await prisma.jobOpportunity.findMany({ where: { sourceUrl: { not: null } }, select: { sourceUrl: true }, take: 1000 });
  for (const row of knownUrls) { const item = row.sourceUrl && extractBoardUrl(row.sourceUrl); if (item) found.push(item); }
  return [...new Map(found.map(item => [`${item.provider}:${item.region}:${item.slug}`, item])).values()];
}

async function sync(candidate: BoardCandidate) {
  const careerUrl = candidate.provider === "GREENHOUSE" ? `https://boards.greenhouse.io/${candidate.slug}` : `https://jobs.${candidate.region === "EU" ? "eu." : ""}lever.co/${candidate.slug}`;
  const board = await prisma.jobBoard.upsert({ where: { provider_region_slug: { provider: candidate.provider, region: candidate.region, slug: candidate.slug } }, create: { provider: candidate.provider, region: candidate.region, slug: candidate.slug, discoverySource: candidate.source, careerUrl }, update: { discoverySource: candidate.source } });
  try {
    const started = new Date(), jobs = await readBoard(candidate);
    await prisma.externalJob.createMany({ data: jobs.map(item => ({ ...item, boardId: board.id, provider: candidate.provider, active: true, lastSeenAt: started })), skipDuplicates: true });
    for (let index = 0; index < jobs.length; index += 10) await Promise.all(jobs.slice(index, index + 10).map(item => prisma.externalJob.updateMany({ where: { provider: candidate.provider, externalId: item.externalId }, data: { ...item, boardId: board.id, active: true, lastSeenAt: started } })));
    await prisma.$transaction([
      prisma.externalJob.updateMany({ where: { boardId: board.id, lastSeenAt: { lt: started } }, data: { active: false } }),
      prisma.jobBoard.update({ where: { id: board.id }, data: { status: jobs.length ? "ACTIVE" : "EMPTY", activeJobs: jobs.length, failureCount: 0, lastError: null, verifiedAt: started, lastSyncedAt: started, nextCheckAt: new Date(started.getTime() + 86400000) } }),
    ]);
    return { board: candidate, jobs: jobs.length, status: jobs.length ? "ACTIVE" : "EMPTY" };
  } catch (error) {
    const failure = String(error instanceof Error ? error.message : error).slice(0, 200), temporary = !failure.includes("NOT_FOUND");
    await prisma.jobBoard.update({ where: { id: board.id }, data: { status: temporary ? "TEMPORARILY_UNAVAILABLE" : "DISABLED", failureCount: { increment: 1 }, lastError: failure, nextCheckAt: new Date(Date.now() + (temporary ? 6 : 168) * 3600000) } });
    return { board: candidate, jobs: 0, status: temporary ? "TEMPORARILY_UNAVAILABLE" : "DISABLED" };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var jobBoardDiscoveryRunning: boolean | undefined;
}
export async function discoverAndSync(limit = 20) {
  if (global.jobBoardDiscoveryRunning) throw new Error("DISCOVERY_ALREADY_RUNNING");
  global.jobBoardDiscoveryRunning = true;
  try {
    const discovered = await candidates();
    await prisma.jobBoard.createMany({ data: discovered.map(item => ({ provider: item.provider, region: item.region, slug: item.slug, discoverySource: item.source, careerUrl: item.provider === "GREENHOUSE" ? `https://boards.greenhouse.io/${item.slug}` : `https://jobs.${item.region === "EU" ? "eu." : ""}lever.co/${item.slug}` })), skipDuplicates: true });
    const due = await prisma.jobBoard.findMany({ where: { nextCheckAt: { lte: new Date() }, status: { not: "DISABLED" } }, orderBy: [{ nextCheckAt: "asc" }, { discoveredAt: "asc" }], take: limit });
    const queue = due.map(item => ({ provider: item.provider as BoardCandidate["provider"], region: item.region as BoardCandidate["region"], slug: item.slug, source: item.discoverySource })), results = [];
    for (let index = 0; index < queue.length; index += 3) results.push(...await Promise.all(queue.slice(index, index + 3).map(sync)));
    return { discovered: discovered.length, processed: results.length, syncedJobs: results.reduce((sum, item) => sum + item.jobs, 0), results };
  } finally { global.jobBoardDiscoveryRunning = false; }
}

export async function boardMetrics() {
  const [boards, jobs, dates] = await Promise.all([prisma.jobBoard.groupBy({ by: ["provider", "status"], _count: true }), prisma.externalJob.groupBy({ by: ["provider"], where: { active: true }, _count: true }), prisma.jobBoard.aggregate({ _max: { discoveredAt: true, lastSyncedAt: true } })]);
  return { boards, jobs, lastDiscovery: dates._max.discoveredAt, lastSynchronization: dates._max.lastSyncedAt };
}

import type { UnifiedJob } from "./types";
import { providers } from "./providers";
import prisma from "../../../prisma/prisma";

const MAX_STORED_JOBS = 500;

type JobPool = {
  jobs: UnifiedJob[];
  warnings: string[];
  limited: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var findJobsPoolCache: Map<string, { expires: number; value: JobPool }> | undefined;
}

const cache = global.findJobsPoolCache ?? new Map();
if (process.env.NODE_ENV !== "production") global.findJobsPoolCache = cache;

/**
 * Build a bounded catalog before filtering/pagination. This way, country
 * choices, company/role trends and publication-date sorting use all loaded
 * jobs, not just whichever 30 happen to be visible on the current page.
 */
export async function getJobsPool(q: string): Promise<JobPool> {
  const key = q.toLocaleLowerCase().trim();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const settled = await Promise.allSettled(
    providers.slice(0, 4).map((provider) => provider(q, 1)),
  );
  const warnings: string[] = [];
  const live = settled.flatMap((result, index) => {
    if (result.status === "rejected") {
      warnings.push(`${providers[index].name}: temporarily unavailable`);
      return [];
    }
    if (result.value.warning) warnings.push(result.value.warning);
    return result.value.jobs;
  });

  const where = {
    active: true,
    ...(q.trim() ? {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const stored = await prisma.externalJob.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { lastSeenAt: "desc" }],
    take: MAX_STORED_JOBS + 1,
  });

  const persisted: UnifiedJob[] = stored.slice(0, MAX_STORED_JOBS).map((item) => ({
    id: `${item.provider}:${item.externalId}`,
    provider: item.provider as UnifiedJob["provider"],
    externalId: item.externalId,
    title: item.title,
    company: item.company,
    description: item.description,
    logoUrl: null,
    location: item.location,
    remote: null,
    contractType: item.contractType,
    seniority: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    // Historical Greenhouse syncs stored updated_at as publishedAt.
    // Hide that date until the catalog has verified publication metadata.
    publishedAt: item.provider === "GREENHOUSE"
      ? null
      : item.publishedAt?.toISOString() || null,
    expiresAt: null,
    sourceUrl: item.sourceUrl,
    applyUrl: item.applyUrl,
    skills: [],
    eligibleCountries: [],
    attribution: "",
  }));

  // Prefer live provider metadata (including real hiring-company logos)
  // over a synchronized DB record that has no persisted logo field.
  const seen = new Set<string>();
  const jobs = [...live, ...persisted].filter((item) => {
    const fingerprint = [item.company, item.title, item.location || ""]
      .map((part) => part.toLocaleLowerCase().trim())
      .join("|");
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });

  const value: JobPool = {
    jobs,
    warnings,
    limited: stored.length > MAX_STORED_JOBS,
  };
  // Keep the process cache bounded even with many distinct search terms.
  for (const [cachedKey, entry] of cache) {
    if (entry.expires <= Date.now()) cache.delete(cachedKey);
  }
  if (cache.size >= 80) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 60_000, value });
  return value;
}

export { rankJobs } from "./ranking";

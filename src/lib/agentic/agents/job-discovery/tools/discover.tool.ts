import { getJobsPool } from "@/lib/find-jobs/service";
import type { UnifiedJob } from "@/lib/find-jobs/types";
import type { DiscoveryPool } from "./contracts.tool";

/** Validate every displayed original source URL; never synthesize listings. */
export function validExternalJob(job: UnifiedJob): boolean {
  const safeUrl = (input: string) => {
    try {
      const u = new URL(input);
      return u.protocol === "https:" && Boolean(u.hostname) && !u.username && !u.password && input.length <= 2048;
    } catch { return false; }
  };
  return Boolean(job.id && job.title.trim() && job.company.trim() &&
    job.description.trim().length >= 40 && safeUrl(job.sourceUrl) && safeUrl(job.applyUrl));
}

export function trustedJobPool(pool: DiscoveryPool): DiscoveryPool {
  const seen = new Set<string>();
  const jobs = pool.jobs.filter(job => {
    if (!validExternalJob(job)) return false;
    const key = job.sourceUrl.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { jobs: jobs.slice(0, 1000), warnings: pool.warnings.filter(x => typeof x === "string").slice(0, 10) };
}

export async function retrieveRealJobs(signal: AbortSignal): Promise<DiscoveryPool> {
  if (signal.aborted) throw new Error("JOB_DISCOVERY_CANCELLED");
  const pool = await getJobsPool("");
  if (signal.aborted) throw new Error("JOB_DISCOVERY_CANCELLED");
  return pool;
}

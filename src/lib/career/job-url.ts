import { JobScrapeError } from "./job-scrape-error";

export function isLinkedInJobHost(hostname: string) {
  return /^(?:(?:www|m|[a-z]{2})\.)?linkedin\.com$/i.test(hostname.replace(/\.$/, ""));
}

// Search/collection URLs identify the selected posting with currentJobId.
// Keep only that identity; tracking parameters and search results are not a job.
export function normalizeJobUrl(value: string): string {
  const source = value.trim();
  let url: URL;
  try { url = new URL(source); } catch { return source; }
  if (!isLinkedInJobHost(url.hostname) || !/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return source;
  if (!/^\/jobs(?:\/|$)/.test(url.pathname)) return source;
  const direct = /^\/jobs\/view\/(?:[^/]*-)?([1-9]\d{0,19})\/?$/.exec(url.pathname)?.[1];
  const selected = url.searchParams.get("currentJobId");
  const id = direct || (selected && /^[1-9]\d{0,19}$/.test(selected) ? selected : "");
  if (!id) throw new JobScrapeError(400, "LINKEDIN_JOB_REQUIRED", "Select a specific LinkedIn job and copy its link. A search URL needs currentJobId.");
  return `https://www.linkedin.com/jobs/view/${id}/`;
}

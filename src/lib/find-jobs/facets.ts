import type { UnifiedJob } from "./types";

type CatalogJob = Pick<
  UnifiedJob,
  "title" | "company" | "location" | "publishedAt"
> & {
  logoUrl?: string | null;
  eligibleCountries?: string[];
  match?: { score: number | null };
};

export type CountryFacet = {
  code: string;
  label: string;
  count: number;
};

export type CompanyFacet = {
  name: string;
  logoUrl: string | null;
  count: number;
};

export type PositionFacet = {
  title: string;
  count: number;
};

const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = new Map<string, string>();

// This map only recognizes country names/codes. It does not populate the
// dropdown: options are produced exclusively from the actual job records.
for (let a = 65; a <= 90; a += 1) {
  for (let b = 65; b <= 90; b += 1) {
    const code = String.fromCharCode(a, b);
    const label = englishNames.of(code);
    if (label && label !== code && !["EU", "UN", "EZ", "QO", "FX", "DD", "SU", "YU", "TP", "ZR", "BU", "AN", "CS"].includes(code)) {
      countries.set(code, label);
    }
  }
}

const alias = new Map<string, string>([
  ["USA", "US"],
  ["U.S.A.", "US"],
  ["U.S.", "US"],
  ["UNITED STATES OF AMERICA", "US"],
  ["UK", "GB"],
  ["U.K.", "GB"],
  ["GREAT BRITAIN", "GB"],
  ["SOUTH KOREA", "KR"],
  ["NORTH KOREA", "KP"],
  ["DR CONGO", "CD"],
  ["DRC", "CD"],
  ["DEMOCRATIC REPUBLIC OF THE CONGO", "CD"],
]);

const searchNames = [
  ...[...countries].map(([code, name]) => ({ name: name.toUpperCase(), code })),
  ...[...alias].map(([name, code]) => ({ name, code })),
].sort((a, b) => b.name.length - a.name.length);

const nonCountries = /\b(worldwide|global|anywhere|remote only|european union)\b/i;

function countryCodesInText(value: string): string[] {
  const text = value.trim();
  if (!text || nonCountries.test(text)) return [];

  const found = new Set<string>();
  const upper = text.toUpperCase();

  for (const item of searchNames) {
    const start = upper.indexOf(item.name);
    if (start === -1) continue;
    const before = upper[start - 1] || " ";
    const after = upper[start + item.name.length] || " ";
    if (/[^A-Z]/.test(before) && /[^A-Z]/.test(after)) {
      found.add(item.code);
    }
  }

  // Country codes are only recognized as standalone tokens, never guessed
  // from a city name or a source domain.
  const tokens = upper.split(/[,;|/()\s\-]+/).filter(Boolean);
  for (const token of tokens) {
    const code = alias.get(token) || token;
    if (code.length === 2 && countries.has(code)) found.add(code);
  }

  return [...found];
}

export function countryCodesForJob(job: Pick<CatalogJob, "location" | "eligibleCountries">): string[] {
  const restrictions = job.eligibleCountries || [];
  const explicit = restrictions.flatMap(countryCodesInText);
  if (explicit.length > 0) return [...new Set(explicit)];
  return countryCodesInText(job.location || "");
}

export function jobCountryFacets(jobs: CatalogJob[]): CountryFacet[] {
  const totals = new Map<string, number>();
  for (const job of jobs) {
    for (const code of countryCodesForJob(job)) {
      totals.set(code, (totals.get(code) || 0) + 1);
    }
  }
  return [...totals].map(([code, count]) => ({
    code,
    label: countries.get(code) || code,
    count,
  })).sort((a, b) => a.label.localeCompare(b.label, "en"));
}

export function jobCompanyFacets(jobs: CatalogJob[], limit = 8): CompanyFacet[] {
  const groups = new Map<string, CompanyFacet & { score: number }>();
  for (const job of jobs) {
    const name = job.company.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const previous = groups.get(key);
    const score = job.match?.score || 0;
    if (previous) {
      previous.count += 1;
      previous.score = Math.max(previous.score, score);
      if (!previous.logoUrl && job.logoUrl) previous.logoUrl = job.logoUrl;
    } else {
      groups.set(key, { name, logoUrl: job.logoUrl || null, count: 1, score });
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, logoUrl, count }) => ({ name, logoUrl, count }));
}

function normalizedRole(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^(?:sr\.?|jr\.?|senior|junior|lead|principal|staff|entry.level|mid.level)\s+/i, "")
    .replace(/\s*[-–—|]\s*(?:remote|hybrid|on.site|[a-z]{2,3})$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function jobPositionFacets(jobs: CatalogJob[], limit = 8): PositionFacet[] {
  const groups = new Map<string, PositionFacet>();
  for (const job of jobs) {
    const title = normalizedRole(job.title);
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    const previous = groups.get(key);
    if (previous) previous.count += 1;
    else groups.set(key, { title, count: 1 });
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export type JobDateSort = "newest" | "oldest";

export function sortJobsByPublication<T extends Pick<CatalogJob, "publishedAt">>(
  jobs: T[],
  order: JobDateSort,
): T[] {
  const time = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };

  return [...jobs].sort((a, b) => {
    const first = time(a.publishedAt);
    const second = time(b.publishedAt);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return order === "newest" ? second - first : first - second;
  });
}

"use client";

import { getCentralCopy, translateCentral } from "@/lib/i18n/central-copy";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { JobsForYou } from "@/components/jobs/jobs-for-you";
import { Button } from "@/components/ui/button";
import {
  FindJob,
  JobDetailView,
  CompanyLogo,
  JobResultRow,
  PrepareAction,
} from "@/components/jobs/find-jobs-view";
import {
  jobCountryFacets,
  sortJobsByPublication,
  countryCodesForJob,
  type CompanyFacet,
  type CountryFacet,
  type PositionFacet,
  type JobDateSort,
} from "@/lib/find-jobs/facets";

type Result = {
  jobs: FindJob[];
  countries: CountryFacet[];
  companies: CompanyFacet[];
  positions: PositionFacet[];
  limited: boolean;
  warnings: string[];
  totalAvailable: number;
  page: number;
  pageSize: number;
};

type SavedJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  sourceUrl: string;
  sourceName: string | null;
  requiredSkills: unknown;
  analysis?: unknown;
};

type Tab = "recommended" | "all" | "saved";

const initialResult: Result = {
  jobs: [],
  countries: [],
  companies: [],
  positions: [],
  limited: false,
  warnings: [],
  totalAvailable: 0,
  page: 1,
  pageSize: 30,
};

function toJob(item: SavedJob): FindJob {
  const metadata: Record<string, unknown> =
    item.analysis && typeof item.analysis === "object" &&
    !Array.isArray(item.analysis)
      ? item.analysis as Record<string, unknown>
      : {};
  return {
    id: `saved:${item.id}`,
    externalId: item.id,
    provider: item.sourceName || "SAVED",
    logoUrl: typeof metadata.logoUrl === "string"
      ? metadata.logoUrl
      : null,
    eligibleCountries: Array.isArray(metadata.eligibleCountries)
      ? metadata.eligibleCountries.filter(
          (country): country is string => typeof country === "string",
        )
      : [],
    title: item.title,
    company: item.company || "",
    description: item.description,
    location: item.location,
    remote: typeof metadata.remote === "boolean" ? metadata.remote : null,
    contractType: typeof metadata.contractType === "string"
      ? metadata.contractType
      : null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    publishedAt: typeof metadata.publishedAt === "string"
      ? metadata.publishedAt
      : null,
    sourceUrl: item.sourceUrl,
    applyUrl: item.sourceUrl,
    skills: Array.isArray(item.requiredSkills)
      ? item.requiredSkills.filter(
          (skill): skill is string => typeof skill === "string",
        )
      : [],
    attribution: item.sourceName || "Original source",
  };
}
function getLabels(french: boolean) { return getCentralCopy("findJobs")[french ? "fr" : "en"]; }

export default function FindJobs() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { i18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const c = getLabels(french);
  const resultsRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [country, setCountry] = useState("");
  const [dateSort, setDateSort] = useState<JobDateSort>("newest");
  const [workMode, setWorkMode] = useState("all");
  const [contract, setContract] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result>(initialResult);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [selected, setSelected] = useState<FindJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [pendingPrepare, setPendingPrepare] = useState<{ job: FindJob; action: PrepareAction } | null>(null);
  const [availableResumes, setAvailableResumes] = useState<{ id: string; title: string }[]>([]);
  const [chosenResume, setChosenResume] = useState("");

  // Keep saved status aligned with server data, including jobs saved previously.
  useEffect(() => {
    let active = true;
    void fetch("/api/find-jobs/saved", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("SAVED_NOT_AVAILABLE");
        return response.json();
      })
      .then((jobs: SavedJob[]) => {
        if (active) setSavedJobs(jobs);
      })
      .catch(() => {
        // The normal search remains usable if saved jobs cannot be read.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (tab === "saved" || tab === "recommended") {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      q: term,
      recommended: "false",
      page: String(page),
      sort: dateSort,
      workMode,
      contract,
      ...(country ? { country } : {}),
    });

    void fetch(`/api/find-jobs?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("JOBS_NOT_AVAILABLE");
        return response.json();
      })
      .then((result: Result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(c.loadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // Message language is visual only; no need to refetch on language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, term, page, country, dateSort, workMode, contract]);

  const savedMap = useMemo(
    () => new Map(savedJobs.map((item) => [item.sourceUrl, item.id])),
    [savedJobs],
  );

  const jobs = useMemo(
    () => tab === "saved" ? savedJobs.map(toJob) : data.jobs,
    [tab, savedJobs, data.jobs],
  );

  // Server-side sorting and country filtering run before pagination.
  // Saved jobs are a separate local collection and may lack metadata.
  const filtered = useMemo(() => {
    if (tab !== "saved") return jobs;
    const needle = term.toLocaleLowerCase().trim();
    const matching = jobs.filter((job) => {
      const textMatches = !needle ||
        `${job.title} ${job.company} ${job.description}`
          .toLocaleLowerCase().includes(needle);
      const countryMatches = !country ||
        countryCodesForJob(job).includes(country);
      const modeMatches = workMode === "all" ||
        (workMode === "remote" ? job.remote === true : job.remote === false);
      const typeMatches = contract === "all" ||
        (job.contractType || "").toLocaleLowerCase().includes(contract);
      return textMatches && countryMatches && modeMatches && typeMatches;
    });
    return sortJobsByPublication(matching, dateSort);
  }, [jobs, tab, term, country, workMode, contract, dateSort]);

  const visibleJobs = filtered;

  const countries = tab === "saved"
    ? jobCountryFacets(jobs)
    : data.countries;

  const totalPages = Math.max(
    1,
    Math.ceil(data.totalAvailable / (data.pageSize || 30)),
  );

  const chooseTab = (next: Tab) => {
    setSelected(null);
    setTab(next);
    setPage(1);
    setCountry("");
    setError("");
  };

  const searchFor = (value: string) => {
    setQ(value);
    setTerm(value.trim());
    setPage(1);
    setSelected(null);
    setTab("all");
    setCountry("");
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const resetFilters = () => {
    setCountry("");
    setDateSort("newest");
    setPage(1);
    setWorkMode("all");
    setContract("all");
  };

  const toggleSave = async (job: FindJob) => {
    setSaving(job.sourceUrl);
    setError("");
    const savedId = savedMap.get(job.sourceUrl);

    try {
      if (savedId) {
        const response = await fetch(
          `/api/find-jobs/saved?id=${encodeURIComponent(savedId)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("DELETE_FAILED");
        setSavedJobs((current) => current.filter((item) => item.id !== savedId));
      } else {
        const response = await fetch("/api/find-jobs/saved", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            externalId: job.externalId,
            provider: job.provider,
            title: job.title.slice(0, 300),
            company: job.company.slice(0, 300),
            location: job.location?.slice(0, 300) || null,
            description: job.description.slice(0, 30000),
            sourceUrl: job.sourceUrl,
            skills: job.skills.slice(0, 100),
            logoUrl: job.logoUrl || null,
            publishedAt: job.publishedAt,
            eligibleCountries: (job.eligibleCountries || []).slice(0, 100),
            remote: job.remote,
            contractType: job.contractType,
          }),
        });
        if (!response.ok) throw new Error("SAVE_FAILED");
        const item: SavedJob = await response.json();
        setSavedJobs((current) => [
          item,
          ...current.filter((existing) => existing.sourceUrl !== item.sourceUrl),
        ]);
      }
    } catch {
      setError(c.saveError);
    } finally {
      setSaving(null);
    }
  };

  const prepare = async (job: FindJob, action: PrepareAction, cvId?: string) => {
    if (preparing) return;
    if (!cvId) {
      try {
        const response = await fetch("/api/cvs?mine=1", { cache: "no-store" });
        if (!response.ok) throw Error("RESUMES_UNAVAILABLE");
        setAvailableResumes(await response.json());
        setChosenResume("");
        setPendingPrepare({ job, action });
      } catch { setError(c.trackingError); }
      return;
    }
    setPreparing(true);
    setError("");

    try {
      // Attach the source job to the application so CV tailoring,
      // cover letters and interview preparation can reuse its description.
      let jobId = savedMap.get(job.sourceUrl);

      if (!jobId) {
        const savedResponse = await fetch("/api/find-jobs/saved", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            externalId: job.externalId,
            provider: job.provider,
            title: job.title.slice(0, 300),
            company: job.company.slice(0, 300),
            location: job.location?.slice(0, 300) || null,
            description: job.description.slice(0, 30000),
            sourceUrl: job.sourceUrl,
            skills: job.skills.slice(0, 100),
            logoUrl: job.logoUrl || null,
            publishedAt: job.publishedAt,
            eligibleCountries: (job.eligibleCountries || []).slice(0, 100),
            remote: job.remote,
            contractType: job.contractType,
          }),
        });
        if (!savedResponse.ok) throw new Error("JOB_SAVE_FAILED");
        const item: SavedJob = await savedResponse.json();
        jobId = item.id;
        setSavedJobs((current) => [
          item,
          ...current.filter((saved) => saved.sourceUrl !== item.sourceUrl),
        ]);
      }

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId,
          cvId,
          company: job.company || "Unknown company",
          jobTitle: job.title,
          location: job.location || undefined,
          jobUrl: job.sourceUrl,
          source: job.provider,
          status: "SAVED",
          reopenExisting: true,
        }),
      });
      if (!response.ok) throw new Error("APPLICATION_FAILED");

      const application: { id?: string } = await response.json();
      if (!application.id) throw new Error("APPLICATION_ID_MISSING");
      const id = encodeURIComponent(application.id);

      setPendingPrepare(null);
      if (action === "interview") {
        router.push(`/dashboard/interviews?applicationId=${id}`);
      } else if (action === "letter") {
        router.push(`/dashboard/cover-letters?applicationId=${id}`);
      } else if (action === "resume") {
        router.push(`/dashboard/applications/${id}?tab=analysis`);
      } else {
        router.push(`/dashboard/applications/${id}?tab=documents`);
      }
    } catch {
      setError(c.trackingError);
      setPreparing(false);
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0];

  if (selected) {
    return (
      <div>
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <JobDetailView
          key={selected.id}
          job={selected}
          french={french}
          saved={savedMap.has(selected.sourceUrl)}
          saving={saving === selected.sourceUrl}
          preparing={preparing}
          onBack={() => { setSelected(null); setError(""); setPendingPrepare(null); }}
          onSave={(job) => void toggleSave(job)}
          onPrepare={(job, action) => void prepare(job, action)}
        />
        {pendingPrepare && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text001")}>
          <div className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-5 shadow-xl">
            <h2 className="text-sm font-semibold">{translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text002")}</h2>
            {availableResumes.length ? <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={chosenResume} onChange={event => setChosenResume(event.target.value)}>
              <option value="">{translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text003")}</option>
              {availableResumes.map(cv => <option key={cv.id} value={cv.id}>{cv.title || "Resume"}</option>)}
            </select> : <p className="text-xs text-muted-foreground">{translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text004")}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setPendingPrepare(null)}>{translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text005")}</Button>
              <Button size="sm" disabled={!chosenResume || preparing} onClick={() => void prepare(pendingPrepare.job, pendingPrepare.action, chosenResume)}>
                {translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text006")}
              </Button>
            </div>
          </div>
        </div>}
      </div>
    );
  }

  if (tab === "recommended") {
    return (
      <main className="mx-auto max-w-6xl space-y-8 pb-12">
        <div className="flex justify-center pt-1">
          <div className="inline-flex rounded-full border bg-card p-1">
            <button
              type="button"
              aria-pressed="true"
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-medium text-background sm:text-sm"
            >
              <Sparkles className="size-4" /> {c.forYou}
            </button>
            <button
              type="button"
              aria-pressed="false"
              onClick={() => chooseTab("all")}
              className="inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-xs font-medium text-foreground hover:bg-muted sm:text-sm"
            >
              <Search className="size-4" /> {c.all}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
        <JobsForYou
          french={french}
          savedUrls={new Set(savedJobs.map((job) => job.sourceUrl))}
          savingUrl={saving}
          onOpen={setSelected}
          onSave={(job) => void toggleSave(job)}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 pb-12">
      {/* Switch between personalized jobs and broad job discovery. */}
      <div className="flex justify-center pt-1">
        <div className="inline-flex rounded-full border bg-card p-1">
          <button
            type="button"
            onClick={() => chooseTab("recommended")}
            aria-pressed={false}
            className={
              "inline-flex min-h-9 items-center gap-2 rounded-full px-4 " +
              "text-xs font-medium transition-colors sm:text-sm " +
              "text-foreground hover:bg-muted"
            }
          >
            <Sparkles className="size-4" />
            {c.forYou}
          </button>
          <button
            type="button"
            onClick={() => chooseTab("all")}
            aria-pressed={tab === "all"}
            className={
              "inline-flex min-h-9 items-center gap-2 rounded-full px-4 " +
              "text-xs font-medium transition-colors sm:text-sm " +
              (tab === "all"
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-muted")
            }
          >
            <Search className="size-4" />
            {c.all}
          </button>
        </div>
      </div>

      <section className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {c.title}{firstName ? `, ${firstName}` : ""}.
        </h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            searchFor(q);
          }}
          className={
            "flex items-center gap-3 rounded-2xl border bg-card " +
            "p-3 shadow-sm sm:p-4"
          }
        >
          <Search className="ml-1 size-5 shrink-0 text-muted-foreground" />
          <input
            aria-label={c.placeholder}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={c.placeholder}
            className={
              "min-w-0 flex-1 bg-transparent px-1 py-2 text-sm " +
              "text-foreground outline-none placeholder:text-muted-foreground " +
              "sm:text-base"
            }
          />
          {q && (
            <button
              type="button"
              onClick={() => { setQ(""); searchFor(""); }}
              aria-label={translateCentral(french ? "fr" : "en", "uiText.app_dashboard_find_jobs_page.text007")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
          <Button type="submit" className="h-10 rounded-xl px-5 sm:px-8">
            {c.search}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
              aria-label={c.country}
              className={
                "h-10 max-w-52 appearance-none rounded-xl border bg-card " +
                "pl-3 pr-8 text-sm outline-none focus:border-primary"
              }
            >
              <option value="">{c.country}</option>
              {countries.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-3.5 size-3.5"
            />
          </div>

          <div className="relative">
            <select
              value={contract}
              onChange={(event) => {
                setContract(event.target.value);
                setPage(1);
              }}
              aria-label={c.jobType}
              className={
                "h-10 max-w-44 appearance-none rounded-xl border bg-card " +
                "pl-3 pr-8 text-sm outline-none focus:border-primary"
              }
            >
              <option value="all">{c.jobType}</option>
              <option value="full">{c.fullTime}</option>
              <option value="part">{c.partTime}</option>
              <option value="contract">{c.contract}</option>
              <option value="intern">{c.internship}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 size-3.5" />
          </div>

          <div className="relative">
            <select
              value={workMode}
              onChange={(event) => {
                setWorkMode(event.target.value);
                setPage(1);
              }}
              aria-label={c.workplace}
              className={
                "h-10 max-w-44 appearance-none rounded-xl border bg-card " +
                "pl-3 pr-8 text-sm outline-none focus:border-primary"
              }
            >
              <option value="all">{c.workplace}</option>
              <option value="remote">{c.remote}</option>
              <option value="onsite">{c.onsite}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 size-3.5" />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={
              "ml-auto inline-flex h-10 items-center gap-2 rounded-xl " +
              "border bg-card px-3 text-sm hover:bg-muted/40"
            }
          >
            {c.filters}
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        {showFilters && (
          <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:items-end">
            <label className="grid gap-1.5 text-xs font-medium">
              {c.sort}
              <select
                value={dateSort}
                onChange={(event) => {
                  setDateSort(event.target.value as JobDateSort);
                  setPage(1);
                }}
                className="h-10 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="newest">{c.newest}</option>
                <option value="oldest">{c.oldest}</option>
              </select>
            </label>
            <div className="flex items-center gap-2 sm:col-span-2 sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetFilters}
              >
                {c.reset}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowFilters(false)}
              >
                <Filter className="size-4" />
                {c.apply}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* All suggestions come from real analyzed offers, not hardcoded lists. */}
      {tab !== "saved" && data.companies.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">{c.companies}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.companies.map((company) => (
              <button
                key={company.name}
                type="button"
                onClick={() => searchFor(company.name)}
                className={
                  "flex min-h-24 min-w-28 shrink-0 flex-col items-center " +
                  "justify-center gap-2 rounded-2xl border bg-card p-3 " +
                  "text-sm transition-colors hover:border-primary/30"
                }
              >
                <CompanyLogo
                  name={company.name}
                  logoUrl={company.logoUrl}
                />
                <span className="max-w-28 truncate">{company.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab !== "saved" && data.positions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">{c.trending}</h2>
          <div className="flex flex-wrap gap-2">
            {data.positions.map((role) => (
              <button
                key={role.title}
                type="button"
                onClick={() => searchFor(role.title)}
                className={
                  "inline-flex items-center gap-2 rounded-xl border bg-card " +
                  "px-3 py-2 text-xs font-medium transition-colors " +
                  "hover:border-primary/30 hover:bg-muted/20 sm:text-sm"
                }
              >
                <BriefcaseBusiness className="size-4 text-primary" />
                {role.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Search results: compact horizontal rows, not image-led cards. */}
      <section ref={resultsRef} id="job-results" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{c.results}</h2>

          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="sr-only" htmlFor="job-date-sort">
              {c.sort}
            </label>
            <select
              id="job-date-sort"
              value={dateSort}
              onChange={(event) => {
                setDateSort(event.target.value as JobDateSort);
                setPage(1);
              }}
              className="h-9 rounded-xl border bg-card px-2 text-xs"
            >
              <option value="newest">{c.newest}</option>
              <option value="oldest">{c.oldest}</option>
            </select>
            <button
              type="button"
              onClick={() => chooseTab(tab === "saved" ? "all" : "saved")}
            className={
              "inline-flex items-center gap-2 rounded-xl border bg-card " +
              "px-3 py-2 text-xs font-medium hover:bg-muted/40"
            }
          >
            <Heart className="size-4" />
            {tab === "saved" ? c.all : c.saved}
            {savedJobs.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px]">
                {savedJobs.length}
              </span>
            )}
          </button>
          </div>
        </div>

        {data.warnings.length > 0 && tab !== "saved" && (
          <p role="status" className="text-xs text-muted-foreground">
            {c.sourcesWarning}
          </p>
        )}
        {data.limited && tab !== "saved" && (
          <p role="status" className="text-xs text-muted-foreground">
            {c.limited}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p role="status" className="flex items-center gap-2 py-7 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {c.loading}
          </p>
        ) : visibleJobs.length > 0 ? (
          <div className="space-y-3" role="list" aria-label={c.results}>
            {visibleJobs.map((job) => (
              <div role="listitem" key={job.id}>
                <JobResultRow
                  job={job}
                  french={french}
                  saved={savedMap.has(job.sourceUrl)}
                  saving={saving === job.sourceUrl}
                  onOpen={(chosen) => { setSelected(chosen); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onSave={(chosen) => void toggleSave(chosen)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-7 text-center">
            <BriefcaseBusiness className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{c.empty}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.emptyHelp}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => { resetFilters(); searchFor(""); }}
            >
              {c.reset}
            </Button>
          </div>
        )}

        {!loading && tab !== "saved" && totalPages > 1 && (
          <nav className="flex items-center justify-center gap-3 pt-3" aria-label="Job pages">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => { setPage((old) => Math.max(1, old - 1)); resultsRef.current?.scrollIntoView(); }}
            >
              <ChevronLeft className="size-4" />
              {c.previous}
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => { setPage((old) => Math.min(totalPages, old + 1)); resultsRef.current?.scrollIntoView(); }}
            >
              {c.next}
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        )}
      </section>
    </main>
  );
}


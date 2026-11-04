import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  ProfileError,
  profileErrorResponse,
  profileJson,
} from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { getJobsPool } from "@/lib/find-jobs/service";
import {
  defaultMatchingPreferences,
  matchingPreferencesSchema,
  resumeEvidence,
} from "@/lib/find-jobs/for-you";
import type { MatchingPreferences } from "@/lib/find-jobs/for-you";
import type { JobDiscoveryResult } from "@/lib/agentic/agents/job-discovery/agent/state";
import { runJobDiscoveryAgent } from "@/lib/agentic/agents/job-discovery/agent/job-discovery.agent";
import { candidateFromResume } from "@/lib/agentic/agents/job-discovery/tools/context.tool";
import { strictDiscoveryFilter } from "@/lib/agentic/agents/job-discovery/tools/filter.tool";
import { shortlistRelevantJobs, DISCOVERY_RESULTS_LIMIT } from "@/lib/agentic/agents/job-discovery/tools/rank.tool";
import { defaultJobPreferences, jobPreferencesSchema } from "@/lib/career-profile/schema";
import { residenceCountries } from "@/lib/career-profile/countries";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lets operators confirm that the current API deployment is running this fix.
// No user, database or credential information is included in this marker.
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-CVComet-JobsForYou-Version": "preferences-reconciled-v2",
};

const PREFERENCES_NOT_PERSISTED = "PREFERENCES_NOT_PERSISTED";

const inputSchema = z.object({
  preferences: matchingPreferencesSchema,
  save: z.boolean().default(true),
  language: z.enum(["fr", "en"]).default("en"),
}).strict();

/**
 * A generated Prisma client can be older than an already-applied Neon schema.
 * Prefer the typed delegate when present, but use parameterized SQL for this
 * one known table if the delegate is absent or its generated mapping is stale.
 * Never interpret a missing delegate as evidence of a missing migration.
 */
type PreferenceStore = {
  findUnique: (args: {
    where: { userId: string };
  }) => Promise<{ filters: unknown } | null>;
  upsert: (args: {
    where: { userId: string };
    create: { userId: string; filters: MatchingPreferences };
    update: { filters: MatchingPreferences };
  }) => Promise<unknown>;
};

function getPreferenceStore(): PreferenceStore | null {
  const client = prisma as unknown as {
    jobRecommendationPreference?: PreferenceStore;
  };
  return client.jobRecommendationPreference ?? null;
}

/** Profile settings initialize a search only when no Jobs-for-You settings exist.
 * Currency conversions are never assumed: only yearly USD is passed along.
 * Industry is stored in the user's career profile, not treated as a literal
 * job-title search (which would exclude relevant listings).
 */
async function defaultsFromCareerProfile(
  userId: string,
): Promise<MatchingPreferences> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      jobPreferences: true,
      experienceLevel: true,
      targetCountry: true,
      preferredWorkMode: true,
    },
  });
  const profile = jobPreferencesSchema.catch(defaultJobPreferences)
    .parse(row?.jobPreferences);

  // Career Direction is the canonical source of these preferences.
  const experience = row?.experienceLevel || "";
  const seniority = experience === "EXECUTIVE" ? "executive"
    : experience === "MANAGER" || experience === "SENIOR" ? "senior"
    : experience === "PROFESSIONAL" ? "mid"
    : experience === "ENTRY_LEVEL" || experience === "STUDENT" ? "entry"
    : profile.seniority === "entry" || profile.seniority === "junior"
      ? "entry"
    : profile.seniority === "lead" ? "senior" : profile.seniority;
  const seniorities: MatchingPreferences["seniorities"] =
    seniority === "entry" || seniority === "mid" ||
    seniority === "senior" || seniority === "executive"
      ? [seniority] : [];

  const contracts: MatchingPreferences["contracts"] =
    profile.employmentTypes.map((type) =>
      type === "freelance" ? "contract" : type,
    );

  const residence = profile.residenceCountry;
  const desired = (row?.targetCountry || "").trim().toLocaleLowerCase();
  const english = residenceCountries("en");
  const french = residenceCountries("fr");
  const country = english.find((candidate) =>
    candidate.code.toLocaleLowerCase() === desired ||
    candidate.name.toLocaleLowerCase() === desired ||
    french.some((translation) =>
      translation.code === candidate.code &&
      translation.name.toLocaleLowerCase() === desired,
    ),
  )?.code || residence;

  const mode = row?.preferredWorkMode;
  const workplaces: MatchingPreferences["workplaces"] =
    mode === "REMOTE" ? ["remote"]
    : mode === "HYBRID" ? ["hybrid"]
    : mode === "ONSITE" ? ["onsite"] : [];

  return {
    ...defaultMatchingPreferences,
    seniorities,
    workplaces,
    contracts,
    countries: country ? [country] : [],
    minimumAnnualUsd: profile.salaryRate === "yearly" &&
      profile.minimumSalary !== null && profile.minimumSalary <= 2_000_000
      ? profile.minimumSalary : null,
  };
}

/** Only safe database error codes go to logs; never log queries or filters. */
function preferenceErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const failure = error as { code?: unknown; meta?: { code?: unknown } };
  if (typeof failure.code !== "string") return "UNKNOWN";
  if (failure.code === "P2010" && typeof failure.meta?.code === "string") {
    return `P2010/${failure.meta.code}`;
  }
  return failure.code;
}

/** Prisma reports missing relations/columns differently for model and raw SQL. */
function isPreferenceSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { code?: unknown; meta?: { code?: unknown } };
  return failure.code === "P2021" || failure.code === "P2022" ||
    (failure.code === "P2010" &&
      (["42P01", "42703", "42P10"].includes(String(failure.meta?.code))));
}

/** SQL parameters are bound by Prisma; the table/column identifiers are static. */
async function readSavedPreference(userId: string): Promise<{ filters: unknown } | null> {
  const store = getPreferenceStore();
  if (store) {
    try {
      return await store.findUnique({ where: { userId } });
    } catch (error) {
      // The generated model can be stale even if the table exists in Neon.
      if (!isPreferenceSchemaError(error)) throw error;
    }
  }
  const rows = await prisma.$queryRaw<Array<{ filters: unknown }>>`
    SELECT "filters"
    FROM public."JobRecommendationPreference"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function savePreference(
  userId: string, filters: MatchingPreferences,
): Promise<void> {
  const store = getPreferenceStore();
  if (store) {
    try {
      await store.upsert({
        where: { userId },
        create: { userId, filters },
        update: { filters },
      });
      return;
    } catch (error) {
      if (!isPreferenceSchemaError(error)) throw error;
    }
  }
  // The SQL path works without a regenerated JobRecommendationPreference model.
  // Keep updatedAt in sync with the @updatedAt behavior of Prisma's delegate.
  await prisma.$executeRaw`
    INSERT INTO public."JobRecommendationPreference"
      ("userId", "filters", "updatedAt")
    VALUES (${userId}, ${JSON.stringify(filters)}::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET
      "filters" = EXCLUDED."filters",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

// In-process optimization only. Never cache profiles or job text in LangGraph.
const cache = new Map<string, { expiresAt: number; result: JobDiscoveryResult }>();

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    // A stale generated Prisma client must not make the entire page unusable.
    let profileDefaults = defaultMatchingPreferences;
    try {
      profileDefaults = await defaultsFromCareerProfile(user.id);
    } catch (error) {
      if (!isPreferenceSchemaError(error)) throw error;
    }
    try {
      const saved = await readSavedPreference(user.id);
      const parsed = matchingPreferencesSchema.safeParse(saved?.filters);
      return NextResponse.json({
        preferences: parsed.success ? parsed.data : profileDefaults,
      }, { headers: responseHeaders });
    } catch (error) {
      if (!isPreferenceSchemaError(error)) throw error;
      // The on-disk migration history can be up to date while the live
      // database schema has drifted (or the web app targets another branch).
      // Continue with defaults; never claim that `migrate deploy` was omitted.
      console.warn("Jobs for You preferences unavailable", {
        operation: "read",
        code: preferenceErrorCode(error),
      });
      return NextResponse.json({
        preferences: profileDefaults,
        warningCode: PREFERENCES_NOT_PERSISTED,
      }, { headers: responseHeaders });
    }
  } catch (error) {
    return profileErrorResponse(error);
  }
}

/** All fetching, filtering, ranking, delegation and assembly run inside the
 * stage-11 graph. This HTTP boundary owns identity, CV ownership, quota path
 * and isolated user-preference persistence. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const input = inputSchema.parse(await profileJson(req));
    const preferences = input.preferences;
    if (!preferences.cvId) throw new ProfileError(400, "SELECT_RESUME_FIRST");

    const cv = await prisma.cv.findFirst({
      where: { id: preferences.cvId, conversation: { userId: user.id } },
    });
    if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");

    let resume: ReturnType<typeof normalizeEditorResume>;
    try { resume = normalizeEditorResume(cv as unknown as Record<string, unknown>); }
    catch { throw new ProfileError(422, "RESUME_INVALID_CONTENT"); }
    if (resumeEvidence(resume).trim().length < 30) {
      throw new ProfileError(422, "RESUME_CONTENT_TOO_SHORT");
    }

    // Store only the current actor's selection; optional preference storage
    // must not prevent genuine job discovery.
    let preferenceWarning: string | null = null;
    if (input.save) {
      try {
        await savePreference(user.id, preferences);
      } catch (error) {
        if (!isPreferenceSchemaError(error)) throw error;
        // The search must still work even if optional preference persistence
        // cannot be used. Diagnose storage drift instead of blaming migrations.
        console.warn("Jobs for You preferences unavailable", {
          operation: "write",
          code: preferenceErrorCode(error),
        });
        preferenceWarning = PREFERENCES_NOT_PERSISTED;
      }
    }

    // The real provider data is fetched first; cache invalidates on edited
    // job text, not just a coincidentally unchanged description length.
    let pool = await getJobsPool("");
    // A general feed often omits relevant postings. Search the actual role
    // from the selected CV (or the user-entered role) when the initial feed
    // yields too few CV-relevant offers inside the chosen preferences.
    const candidate = candidateFromResume(resume, preferences);
    const eligible = strictDiscoveryFilter(pool.jobs, preferences).filtered;
    const initialRelevant = shortlistRelevantJobs(eligible, candidate);
    const resumeRole = resume.experiences.find(item => item.title.trim())?.title ||
      (/^(?:my resume|cv|resume|curriculum vitae)$/i.test(resume.title.trim()) ? "" : resume.title);
    const roleQuery = (resumeRole || preferences.title)
      .replace(/\s+/g, " ").trim().slice(0, 80);
    if (initialRelevant.length < DISCOVERY_RESULTS_LIMIT &&
        roleQuery.length >= 3 && !/^(?:my resume|cv|resume|curriculum vitae)$/i.test(roleQuery)) {
      try {
        const targeted = await getJobsPool(roleQuery);
        const seen = new Set<string>();
        pool = {
          jobs: [...targeted.jobs, ...pool.jobs].filter(job => {
            const key = job.sourceUrl.trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
          warnings: [...new Set([...targeted.warnings, ...pool.warnings])],
          limited: targeted.limited || pool.limited,
        };
      } catch {
        // Do not make the primary discovery fail when a supplemental source
        // temporarily fails. Never fabricate an offer or its source URL.
      }
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({
      version: 12, actor: user.id, cvId: cv.id, revision: cv.revision,
      resume, preferences, language: input.language,
      // Stable ordering avoids charging again when providers return the same
      // jobs in a different order on the next request.
      listings: pool.jobs.map(job => [job.id, job.sourceUrl, job.publishedAt,
        createHash("sha256").update(job.description).digest("hex")])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    })).digest("hex");

    const previous = cache.get(fingerprint);
    // A complete response can be served directly. A partial response only
    // supplies previously verified matches; explicit retries evaluate the rest.
    if (previous && previous.expiresAt > Date.now() &&
        previous.result.verifiedCount === previous.result.deepMatchCount &&
        !previous.result.warningCode) {
      return NextResponse.json({
        ...previous.result,
        warningCode: previous.result.warningCode || preferenceWarning,
        cached: true,
      }, { headers: responseHeaders });
    }

    const result = await runJobDiscoveryAgent({
      actorId: user.id,
      input: { resume, preferences, language: input.language },
      signal: req.signal,
      deps: {
        discover: async () => pool,
        // Fingerprint includes authenticated user, CV revision, preferences,
        // full normalized resume, and each source job description hash.
        // Never accept cached scores or job IDs from the HTTP request body.
        previousVerifiedMatches: new Map(
          previous && previous.expiresAt > Date.now()
            ? previous.result.jobs
              .filter(job => Number.isInteger(job.match.score) && job.match.score !== null)
              .map(job => [job.id, job.match] as const)
            : [],
        ),
      },
    });

    // Cache even partial results briefly so a user-initiated retry only
    // processes failed offers. Never serve incomplete results as a final hit.
    // In-process cache is an optimization, not durable across server instances.
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= Date.now()) cache.delete(key);
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    const complete = result.deepMatchCount === result.verifiedCount && !result.warningCode;
    cache.set(fingerprint, {
      expiresAt: Date.now() + (complete ? 10 : 3) * 60_000,
      result,
    });

    return NextResponse.json({
      ...result,
      warningCode: result.warningCode || preferenceWarning,
    }, { headers: responseHeaders });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

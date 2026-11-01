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
import { defaultJobPreferences, jobPreferencesSchema } from "@/lib/career-profile/schema";
import { residenceCountries } from "@/lib/career-profile/countries";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  preferences: matchingPreferencesSchema,
  save: z.boolean().default(true),
  language: z.enum(["fr", "en"]).default("en"),
}).strict();

/**
 * Narrow interface for the preferences delegate. A stale generated Prisma client
 * might not have this delegate yet; GET and POST degrade gracefully until
 * `prisma generate` is run after applying the schema/migration.
 *
 * This is deliberately typed rather than `any`, and still only accepts the
 * authenticated user's ID in the routes below.
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

/** Only missing preference tables are optional; all other DB failures surface. */
function missingPreferenceTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
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
      if (!missingPreferenceTable(error)) throw error;
    }
    const preferenceStore = getPreferenceStore();
    if (!preferenceStore) {
      return NextResponse.json({
        preferences: profileDefaults,
        warningCode: "PRISMA_MIGRATION_REQUIRED",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    try {
      const saved = await preferenceStore.findUnique({
        where: { userId: user.id },
      });
      const parsed = matchingPreferencesSchema.safeParse(saved?.filters);
      return NextResponse.json({
        preferences: parsed.success ? parsed.data : profileDefaults,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (!missingPreferenceTable(error)) throw error;
      return NextResponse.json({
        preferences: profileDefaults,
        warningCode: "PRISMA_MIGRATION_REQUIRED",
      }, { headers: { "Cache-Control": "no-store" } });
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

    // Store only the current actor's selection; missing optional migration does
    // not make genuine job listings inaccessible.
    let preferenceWarning: string | null = null;
    if (input.save) {
      const store = getPreferenceStore();
      if (!store) preferenceWarning = "PRISMA_MIGRATION_REQUIRED";
      else try {
        await store.upsert({
          where: { userId: user.id },
          update: { filters: preferences },
          create: { userId: user.id, filters: preferences },
        });
      } catch (error) {
        if (!missingPreferenceTable(error)) throw error;
        preferenceWarning = "PRISMA_MIGRATION_REQUIRED";
      }
    }

    // The real provider data is fetched first; cache invalidates on edited
    // job text, not just a coincidentally unchanged description length.
    const pool = await getJobsPool("");
    const fingerprint = createHash("sha256").update(JSON.stringify({
      version: 11, actor: user.id, cvId: cv.id, revision: cv.revision,
      resume, preferences, language: input.language,
      listings: pool.jobs.map(job => [job.id, job.sourceUrl, job.publishedAt,
        createHash("sha256").update(job.description).digest("hex")]),
    })).digest("hex");

    const previous = cache.get(fingerprint);
    if (previous && previous.expiresAt > Date.now()) {
      return NextResponse.json({
        ...previous.result,
        warningCode: previous.result.warningCode || preferenceWarning,
        cached: true,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const result = await runJobDiscoveryAgent({
      actorId: user.id,
      input: { resume, preferences, language: input.language },
      signal: req.signal,
      deps: { discover: async () => pool },
    });

    // Only successful verified deep matches are cached; partial outages remain
    // retryable without showing old results as fresh verified scores.
    if (result.deepMatchCount > 0 &&
        result.verifiedCount === result.deepMatchCount && !result.warningCode) {
      for (const [key, entry] of cache) {
        if (entry.expiresAt <= Date.now()) cache.delete(key);
      }
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(fingerprint, { expiresAt: Date.now() + 10 * 60_000, result });
    }

    return NextResponse.json({
      ...result,
      warningCode: result.warningCode || preferenceWarning,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

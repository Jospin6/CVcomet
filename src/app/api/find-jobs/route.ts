import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import {
  getCareerProfile,
  careerProfileContext,
} from "@/lib/career-profile/service";
import { getJobsPool, rankJobs } from "@/lib/find-jobs/service";
import {
  countryCodesForJob,
  jobCompanyFacets,
  jobCountryFacets,
  jobPositionFacets,
  sortJobsByPublication,
} from "@/lib/find-jobs/facets";
import {
  profileErrorResponse,
  ProfileError,
} from "@/lib/career-profile/http";

const query = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(500).default(1),
  recommended: z.enum(["true", "false"]).default("false"),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  workMode: z.enum(["all", "remote", "onsite"]).default("all"),
  contract: z.enum(["all", "full", "part", "contract", "intern"]).default("all"),
});

const PAGE_SIZE = 30;

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");

    const input = query.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    const pool = await getJobsPool(input.q);

    const catalog = input.recommended === "true"
      ? rankJobs(
          pool.jobs,
          careerProfileContext(await getCareerProfile(user.id)),
        ).filter((job) => job.match.relevant)
      : pool.jobs;

    // Facets reflect actual jobs in this search, before country filtering.
    // They do not contain static company names, roles or country lists.
    const companies = jobCompanyFacets(catalog);
    const positions = jobPositionFacets(catalog);
    const countries = jobCountryFacets(catalog);
    const selectedCountry = input.country;
    const filtered = catalog.filter((job) => {
      const countryMatches = !selectedCountry ||
        countryCodesForJob(job).includes(selectedCountry);
      const modeMatches = input.workMode === "all" ||
        (input.workMode === "remote"
          ? job.remote === true
          : job.remote === false);
      const typeMatches = input.contract === "all" ||
        (job.contractType || "")
          .toLocaleLowerCase()
          .includes(input.contract);
      return countryMatches && modeMatches && typeMatches;
    });
    const ordered = sortJobsByPublication(filtered, input.sort);
    const offset = (input.page - 1) * PAGE_SIZE;

    return NextResponse.json({
      jobs: ordered.slice(offset, offset + PAGE_SIZE),
      totalAvailable: ordered.length,
      page: input.page,
      pageSize: PAGE_SIZE,
      countries,
      companies,
      positions,
      limited: pool.limited,
      warnings: pool.warnings,
      personalized: input.recommended === "true",
    }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

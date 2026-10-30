import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  countryCodesForJob,
  jobCountryFacets,
  jobCompanyFacets,
  jobPositionFacets,
  sortJobsByPublication,
} from "../src/lib/find-jobs/facets.ts";

const job = (overrides = {}) => ({
  title: "Software Engineer",
  company: "Acme",
  location: "Berlin, Germany",
  logoUrl: null,
  eligibleCountries: [],
  publishedAt: "2026-10-28T00:00:00Z",
  ...overrides,
});

test("company suggestions come from hiring companies, never a baked-in brand list", () => {
  const jobs = [
    job({ company: "Example Labs", logoUrl: "https://example.org/logo.png" }),
    job({ company: "Example Labs" }),
    job({ company: "Other Employer", title: "Data Analyst" }),
  ];
  assert.deepEqual(jobCompanyFacets(jobs), [
    { name: "Example Labs", logoUrl: "https://example.org/logo.png", count: 2 },
    { name: "Other Employer", logoUrl: null, count: 1 },
  ]);
  assert.equal(jobCompanyFacets([]).length, 0);
});

test("trending positions are grouped from real job titles", () => {
  const roles = jobPositionFacets([
    job({ title: "Senior Software Engineer" }),
    job({ title: "Software Engineer" }),
    job({ title: "Data Analyst" }),
  ]);
  assert.deepEqual(roles, [
    { title: "Software Engineer", count: 2 },
    { title: "Data Analyst", count: 1 },
  ]);
});

test("countries only appear if a real offer specifies the country", () => {
  const offers = [
    job({ location: "Berlin, Germany" }),
    job({ location: "Remote - US" }),
    job({ location: "Worldwide" }),
    job({ location: "Remote", eligibleCountries: ["France", "Canada"] }),
  ];
  const countries = jobCountryFacets(offers);
  assert.deepEqual(countries.map(item => item.code), ["CA", "FR", "DE", "US"]);
  assert.equal(countries.some(item => item.label === "Worldwide"), false);
  assert.deepEqual(countryCodesForJob(job({ location: null, eligibleCountries: [] })), []);
});

test("date sorting is global and keeps undated jobs at the end", () => {
  const jobs = [
    job({ company: "A", publishedAt: null }),
    job({ company: "B", publishedAt: "2026-01-01T00:00:00Z" }),
    job({ company: "C", publishedAt: "2026-10-01T00:00:00Z" }),
  ];
  assert.deepEqual(sortJobsByPublication(jobs, "newest").map(x => x.company), ["C", "B", "A"]);
  assert.deepEqual(sortJobsByPublication(jobs, "oldest").map(x => x.company), ["B", "C", "A"]);
});

test("UI does not present job-board logos or source attribution", () => {
  const component = fs.readFileSync(new URL("../src/components/jobs/find-jobs-view.tsx", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../src/app/dashboard/find-jobs/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /sourceArtwork|job-sources\/|job\.attribution/);
  assert.doesNotMatch(page, /const popularCompanies|const trendingRoles|\.warnings\.join/);
  assert.match(component, /BriefcaseBusiness[\s\S]*text-primary/);
  assert.match(page, /data\.companies\.map/);
  assert.match(page, /data\.positions\.map/);
});

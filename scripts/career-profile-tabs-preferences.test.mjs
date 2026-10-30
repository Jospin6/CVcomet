import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const read = (path) => readFileSync(
  new URL(`../${path}`, import.meta.url), "utf8",
);
const page = read("src/components/career-profile/career-profile-page.tsx");
const fields = read("src/components/career-profile/profile-fields.tsx");
const direction = read("src/components/career-profile/career-direction-fields.tsx");
const schema = read("src/lib/career-profile/schema.ts");
const service = read("src/lib/career-profile/service.ts");
const jobs = read("src/app/api/find-jobs/for-you/route.ts");

// UI: one Career Direction, not two competing preference forms.
test("five profile tabs, no duplicate Job Preferences tab", () => {
  for (const key of ["overview", "experience", "education", "skills", "links"]) {
    assert.match(page, new RegExp(`id: "${key}"`));
  }
  assert.doesNotMatch(page, /id: "preferences"/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tabpanel"/);
  assert.match(fields, /<CareerDirectionFields/);
  assert.doesNotMatch(page, /<JobPreferencesFields/);
});

test("Career Direction reuses job preference choices without free-text industry or country", () => {
  assert.match(direction, /function IndustrySelect/);
  assert.match(direction, /function CountryPicker/);
  assert.match(direction, /residenceCountries\("en"\)/);
  assert.match(direction, /mode="name"/);
  assert.match(direction, /mode="code"/);
  assert.match(direction, /profile\.experiences\.map/);
  assert.match(direction, /list="career-direction-positions"/);
  assert.match(direction, /employmentTypes/);
  assert.match(direction, /minimumSalary/);
  assert.match(direction, /salaryRate/);
  assert.match(direction, /careerGoal/);
  assert.match(direction, /experienceLevel/);
  assert.match(direction, /preferredWorkMode/);
});

test("Career Direction updates one canonical source while retaining old values", () => {
  assert.match(schema, /export function harmonizeCareerDirection/);
  assert.match(schema, /targetIndustry: industry/);
  assert.match(schema, /seniorityToExperience/);
  assert.match(schema, /experienceToSeniority/);
  assert.match(service, /harmonizeCareerDirection\(profile\)/);
  assert.match(service, /harmonizeCareerDirection\(\{/);
  assert.match(service, /profileRevision: revision/);
});

test("onboarding uses selects for industry and target country too", () => {
  assert.match(fields, /<IndustrySelect/);
  assert.match(fields, /<CountryPicker/);
  assert.match(fields, /mode="name"/);
  assert.match(page, /<TargetFields profile=\{draft\}/);
});

test("Jobs for You reads the canonical direction and keeps CV matching separate", () => {
  assert.match(jobs, /defaultsFromCareerProfile/);
  assert.match(jobs, /targetCountry: true/);
  assert.match(jobs, /preferredWorkMode: true/);
  assert.match(jobs, /experienceLevel: true/);
  assert.match(jobs, /profile\.employmentTypes/);
  assert.match(jobs, /minimumSalary <= 2_000_000/);
  assert.match(jobs, /if \(!preferences\.cvId\)/);
});

test("compact fields still auto-grow and imported CV confirmation is retained", () => {
  assert.match(fields, /element\.scrollHeight/);
  assert.match(fields, /resize-none/);
  assert.match(page, /imported && !confirmed/);
  assert.match(page, /onClick=\{\(\) => fileInput\.current\?\.click\(\)\}/);
});

test("changed TypeScript/TSX files parse without errors", () => {
  const require = createRequire(import.meta.url);
  let ts;
  try { ts = require("typescript"); }
  catch { ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript"); }
  for (const file of [
    "src/components/career-profile/career-profile-page.tsx",
    "src/components/career-profile/profile-fields.tsx",
    "src/components/career-profile/career-direction-fields.tsx",
    "src/lib/career-profile/schema.ts",
    "src/lib/career-profile/service.ts",
    "src/app/api/find-jobs/for-you/route.ts",
  ]) {
    const source = ts.createSourceFile(
      file, read(file), ts.ScriptTarget.Latest, true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    assert.equal(source.parseDiagnostics.length, 0, file);
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = (() => { try { return require("typescript"); } catch {
  return require(path.join(require("node:child_process").execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "typescript"));
} })();
const root = path.resolve(import.meta.dirname, "..");
const pathFor = (file) => path.join(root, file);
const source = fs.readFileSync(pathFor("src/lib/find-jobs/for-you.ts"), "utf8");
const file = ts.createSourceFile("for-you.ts", source, ts.ScriptTarget.Latest, true);
const get = (name) => {
  const fn = file.statements.find((item) =>
    ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(fn, `function ${name} exists`);
  return fn.getText(file);
};
const prelude = file.statements.filter((item) =>
  ts.isVariableStatement(item) && item.declarationList.declarations.some((d) =>
    d.name.getText(file) === "lower")).map((item) => item.getText(file)).join("\n");
const js = ts.transpileModule(
  [prelude, get("matchesPreferences"), get("verifiedMatchScore")].join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const sandbox = { exports: {}, countryCodesForJob: (job) => job.codes || [] };
vm.runInNewContext(js.replace(/^export /gm, ""), sandbox);
const { matchesPreferences, verifiedMatchScore } = sandbox.exports;

const resume = "Software Developer at Acme. Typescript, PostgreSQL, React, AWS.";
const job = "We require Typescript, and React. PostgreSQL is a plus.";

test("score is derived from verifiable resume and advert quotes", () => {
  const computed = verifiedMatchScore(resume, job, [
    { criterion: "Typescript", jobQuote: "We require Typescript", evidence: "Typescript", priority: "REQUIRED", status: "MET" },
    { criterion: "React", jobQuote: "and React", evidence: "React", priority: "REQUIRED", status: "MET" },
    { criterion: "PostgreSQL", jobQuote: "PostgreSQL is a plus", evidence: "PostgreSQL", priority: "PREFERRED", status: "MET" },
  ]);
  assert.equal(computed.score, 100);
});

test("invented resume evidence cannot yield a positive match", () => {
  const computed = verifiedMatchScore(resume, job, [
    { criterion: "Typescript", jobQuote: "We require Typescript", evidence: "Kubernetes", priority: "REQUIRED", status: "MET" },
    { criterion: "React", jobQuote: "and React", evidence: "React", priority: "REQUIRED", status: "MET" },
  ]);
  assert.equal(computed.score, null); // one criterion remains verified
});

test("invented job requirement is excluded", () => {
  const computed = verifiedMatchScore(resume, job, [
    { criterion: "Typescript", jobQuote: "we require quantum computing", evidence: "Typescript", priority: "REQUIRED", status: "MET" },
    { criterion: "React", jobQuote: "and React", evidence: "React", priority: "REQUIRED", status: "MET" },
  ]);
  assert.equal(computed.score, null);
});

const prefs = {
  title: "", countries: ["US"], postedWithin: "week",
  contracts: [], seniorities: [], workplaces: [],
  minimumAnnualUsd: null, visaSponsorship: false,
};
const offer = {
  title: "Developer", description: "React", codes: ["US"],
  eligibleCountries: [], contractType: "Full-time", seniority: "Mid",
  publishedAt: new Date(Date.now() - 86400000).toISOString(),
  location: "US", remote: false,
};

test("job preference filters honor actual countries and publication age", () => {
  assert.equal(matchesPreferences(offer, prefs), true);
  assert.equal(matchesPreferences({ ...offer, codes: ["CA"] }, prefs), false);
  assert.equal(matchesPreferences({ ...offer, publishedAt: null }, prefs), false);
  assert.equal(matchesPreferences({ ...offer, publishedAt: "2022-01-01" }, prefs), false);
});

test("visa preference fails closed when sponsorship is not explicit", () => {
  assert.equal(matchesPreferences(offer, { ...prefs, visaSponsorship: true }), false);
});

test("server owns CV lookup and quota; client never supplies resume facts", () => {
  const route = fs.readFileSync(pathFor("src/app/api/find-jobs/for-you/route.ts"), "utf8");
  assert.match(route, /conversation:\s*\{\s*userId:\s*user\.id/);
  assert.match(route, /reserveProfileAI\(user\.id/);
  assert.match(route, /normalizeEditorResume/);
  assert.match(route, /generateObject/);
  assert.doesNotMatch(route, /sourceName\s*:\s*['"]Kickresume/);
});

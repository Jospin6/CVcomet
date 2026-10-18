/* Exercise the real handlers without live AI, provider charges or database writes. */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loader = require("./source-loader.cjs");
const root = path.resolve(__dirname, "..");
const load = loader({});
const { normalizeLinkedInUrl } = load("src/lib/linkedin.ts");
const { extractionSchema } = load("src/lib/career-profile/extraction.ts");
const profileHttp = load("src/lib/career-profile/http.ts");
const keys = ["LINKEDIN_IMPORT_API_URL", "LINKEDIN_IMPORT_API_KEY", "SCRAPINGDOG_API_KEY"];
let environment, originalFetch;
beforeEach(() => {
  environment = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => delete process.env[key]);
  originalFetch = global.fetch;
});
afterEach(() => {
  for (const key of keys) { if (environment[key] === undefined) delete process.env[key]; else process.env[key] = environment[key]; }
  global.fetch = originalFetch;
});

const owner = { id: "11111111-1111-4111-8111-111111111111", email: "owner@example.test" };
const sourceText = "Camille Example\nFrontend Developer\nExperience\nExample Studio, 2022\nBuilt accessible React applications.\nEducation\nExample University\nSkills: React, TypeScript";
const facts = () => ({ name: "Camille Example", headline: "Frontend Developer", summary: "Built accessible applications.", skills: "React, TypeScript", linkedin: "linkedin.com/in/camille-example", experiences: [{ title: "", company: "Example Studio", start: "2022", end: "", description: "Built accessible React applications.\nWrote tests." }], education: [{ degree: "", school: "Example University" }], languages: "French, English" });
const jsonRequest = body => new Request("http://localhost/api/resume-documents/linkedin", { method: "POST", headers: { "Content-Type": "application/json", "Accept-Language": "fr" }, body: JSON.stringify(body) });
const textRequest = () => jsonRequest({ source: "text", text: sourceText });
function pdfRequest(bytes = "%PDF-1.4\nfixture", name = "Profile.pdf", type = "application/pdf") {
  const form = new FormData(); form.append("profile", new File([bytes], name, { type }));
  return new Request("http://localhost/api/resume-documents/linkedin", { method: "POST", body: form });
}
function fixture(options = {}) {
  const events = [], writes = [], prompts = [];
  const mocks = {
    "@/lib/career-profile/http": profileHttp,
    "@/lib/auth": { getSessionUser: async () => options.anonymous ? null : owner },
    "@/lib/ai/model": { getAIModel: async () => { events.push("model"); if (options.modelError) throw options.modelError; return { provider: "fixture" }; } },
    "@/lib/career-profile/ai": { factualRules: "Use ONLY explicit source facts.", reserveProfileAI: async id => { assert.equal(id, owner.id); events.push("reserve"); if (options.quotaError) throw options.quotaError; } },
    "@/lib/pdf-text": { extractPDFText: async bytes => { events.push("pdf"); assert.equal(bytes.subarray(0, 5).toString(), "%PDF-"); return options.pdfText ?? sourceText; } },
    ai: { generateObject: async args => { events.push("generate"); prompts.push(args); if (options.aiError) throw options.aiError; return { object: options.facts ?? facts() }; } },
    [path.join(root, "prisma/prisma.ts")]: { cv: { create: async ({ data }) => { events.push("persist"); if (options.saveError) throw options.saveError; writes.push(data); return { id: "imported-resume" }; } } },
  };
  const route = loader(mocks)("src/app/api/resume-documents/linkedin/route.ts");
  return { route, events, writes, prompts };
}

test("personal profile URLs normalize international hosts, Unicode and tracking parameters", () => {
  assert.equal(normalizeLinkedInUrl(" linkedin.com/in/camille-example?trk=test#about "), "https://www.linkedin.com/in/camille-example/");
  assert.equal(normalizeLinkedInUrl("https://fr.linkedin.com/in/élise-example/"), "https://www.linkedin.com/in/%C3%A9lise-example/");
  assert.equal(normalizeLinkedInUrl("https://www.linkedin.com/in/Camille_Example-123/"), "https://www.linkedin.com/in/Camille_Example-123/");
});

test("arbitrary hosts, credentials, ports, company links and encoded path escapes are rejected", () => {
  for (const url of ["https://localhost/in/a", "http://www.linkedin.com/in/a", "https://linkedin.com.evil.test/in/a", "https://linkedin.com@evil.test/in/a", "https://user:secret@linkedin.com/in/a", "https://www.linkedin.com:8080/in/a", "https://www.linkedin.com/company/example", "https://www.linkedin.com/in/a/detail", "https://www.linkedin.com/in/a%2Fb", "https://www.linkedin.com/in/%00", "javascript:alert(1)", "file:///in/a", "https://www.linkedin.com/in/..", "https://www.linkedin.com/in/%ZZ"]) assert.equal(normalizeLinkedInUrl(url), null, url);
});

test("anonymous requests are rejected before input parsing, AI, provider or database access", async () => {
  const f = fixture({ anonymous: true });
  assert.equal((await f.route.GET()).status, 401);
  assert.equal((await f.route.POST(new Request("http://localhost", { method: "POST" }))).status, 401);
  assert.deepEqual(f.events, []);
});

test("capability discovery exposes only a boolean and never provider configuration or keys", async () => {
  const f = fixture();
  const response = await f.route.GET();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { urlImportAvailable: false });
  process.env.SCRAPINGDOG_API_KEY = "test-server-secret";
  assert.deepEqual(await (await f.route.GET()).json(), { urlImportAvailable: true });
  assert.deepEqual(f.events, []);
});

test("text import creates an owned editable CV, preserves incomplete facts and opens no profile writes", async () => {
  const f = fixture();
  const response = await f.route.POST(textRequest());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { id: "imported-resume" });
  assert.deepEqual(f.events, ["model", "reserve", "generate", "persist"]);
  const cv = f.writes[0];
  assert.equal(cv.conversation.create.userId, owner.id);
  assert.equal(cv.contact.email, owner.email);
  assert.equal(cv.contact.linkedin, "https://linkedin.com/in/camille-example");
  assert.equal(cv.experiences[0].title, ""); assert.equal(cv.educations[0].degree, "");
  assert.deepEqual(cv.experiences[0].description, ["Built accessible React applications.", "Wrote tests."]);
  assert.equal(cv.skills[0].hardskills, "React, TypeScript");
  assert.deepEqual(cv.languages, [{ language: "French", level: "" }, { language: "English", level: "" }]);
  assert.ok(f.prompts[0].system.includes("untrusted source data"));
  assert.ok(f.prompts[0].system.includes("Do not infer"));
  assert.equal(JSON.parse(f.prompts[0].prompt).sourceText, sourceText);
});

test("invalid input, extra ownership fields and unavailable URL import consume no quota", async () => {
  for (const body of [{ source: "text", text: "too short" }, { source: "text", text: "x".repeat(120001) }, { source: "text", text: sourceText, userId: "foreign" }, { source: "text", text: sourceText, profile: {} }, { source: "url", url: "https://evil.test/in/a" }, { source: "url", url: "https://linkedin.com/in/camille-example/" }]) {
    const f = fixture(); const response = await f.route.POST(jsonRequest(body));
    assert.ok([400, 503].includes(response.status));
    assert.deepEqual(f.events, []); assert.deepEqual(f.writes, []);
  }
});

test("multipart import reads a validated PDF locally before creating the editable CV", async () => {
  const f = fixture(); const response = await f.route.POST(pdfRequest());
  assert.equal(response.status, 201);
  assert.deepEqual(f.events, ["pdf", "model", "reserve", "generate", "persist"]);
  assert.equal(JSON.parse(f.prompts[0].prompt).source, "pdf");
  assert.equal(JSON.parse(f.prompts[0].prompt).sourceText, sourceText);
});

test("forged PDFs, oversized bodies and PDFs without text do not invoke AI or persist a CV", async () => {
  for (const request of [pdfRequest("not pdf"), pdfRequest("%PDF-1.4", "Profile.html"), pdfRequest("%PDF-1.4", "Profile.pdf", "text/html"), pdfRequest(new Uint8Array(8 * 1024 * 1024 + 1)), new Request("http://localhost", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": String(9 * 1024 * 1024) }, body: "x" })]) {
    const f = fixture(); assert.ok([400, 413, 415].includes((await f.route.POST(request)).status));
    assert.deepEqual(f.events, []);
  }
  const f = fixture({ pdfText: "" }); const response = await f.route.POST(pdfRequest());
  assert.equal(response.status, 422); assert.equal((await response.json()).error, "PDF_TEXT_REQUIRED");
  assert.deepEqual(f.events, ["pdf"]);
});

test("missing AI configuration and exhausted quotas fail before a paid profile request", async () => {
  const { ProfileError } = profileHttp;
  process.env.LINKEDIN_IMPORT_API_URL = "https://provider.example/profile";
  let requests = 0; global.fetch = async () => { requests++; throw Error("must not fetch"); };
  const first = fixture({ modelError: new ProfileError(503, "AI_UNAVAILABLE") });
  assert.equal((await first.route.POST(jsonRequest({ source: "url", url: "https://linkedin.com/in/camille-example" }))).status, 503);
  assert.deepEqual(first.events, ["model"]);
  const second = fixture({ quotaError: new ProfileError(429, "AI_LIMIT") });
  assert.equal((await second.route.POST(jsonRequest({ source: "url", url: "https://linkedin.com/in/camille-example" }))).status, 429);
  assert.deepEqual(second.events, ["model", "reserve"]); assert.equal(requests, 0);
});

test("custom URL provider receives canonical URL and server token after quota reservation", async () => {
  process.env.LINKEDIN_IMPORT_API_URL = "https://provider.example/profile";
  process.env.LINKEDIN_IMPORT_API_KEY = "test-server-secret";
  const f = fixture();
  global.fetch = async (url, init) => {
    assert.equal(url.toString(), "https://provider.example/profile");
    assert.equal(init.method, "POST"); assert.equal(init.headers.Authorization, "Bearer test-server-secret");
    assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body), { url: "https://www.linkedin.com/in/camille-example/" });
    assert.deepEqual(f.events, ["model", "reserve"]);
    return Response.json({ profile: { name: "Camille Example", headline: "Developer", internalSecret: "must-not-reach-ai" } });
  };
  const response = await f.route.POST(jsonRequest({ source: "url", url: "https://fr.linkedin.com/in/camille-example?trk=tracking" }));
  assert.equal(response.status, 201); assert.equal(f.writes[0].contact.linkedin, "https://www.linkedin.com/in/camille-example/");
  assert.ok(!f.prompts[0].prompt.includes("must-not-reach-ai"));
  assert.ok(!JSON.stringify(await response.json()).includes("test-server-secret"));
});

test("Scrapingdog adapter fetches a fixed endpoint and profile id without forwarding user query parameters", async () => {
  process.env.SCRAPINGDOG_API_KEY = "test-server-secret";
  const f = fixture();
  global.fetch = async (url, init) => {
    assert.equal(url.origin + url.pathname, "https://api.scrapingdog.com/profile");
    assert.deepEqual(Object.fromEntries(url.searchParams), { api_key: "test-server-secret", type: "profile", id: "camille-example" });
    assert.equal(init.method, "GET"); return Response.json([{ fullName: "Camille Example", experience: [] }]);
  };
  assert.equal((await f.route.POST(jsonRequest({ source: "url", url: "linkedin.com/in/camille-example?api_key=attacker" }))).status, 201);
});

test("provider failures, invalid JSON, empty profiles and oversized responses create no CV", async () => {
  process.env.LINKEDIN_IMPORT_API_URL = "https://provider.example/profile";
  for (const [reply, status, code] of [
    [() => new Response("private-provider-secret", { status: 401 }), 502, "LINKEDIN_UNAVAILABLE"],
    [() => new Response("", { status: 404 }), 422, "LINKEDIN_NOT_FOUND"],
    [() => new Response("", { status: 429 }), 429, "LINKEDIN_RATE_LIMIT"],
    [() => new Response("not json"), 502, "LINKEDIN_UNAVAILABLE"],
    [() => Response.json({ success: false, error: "private-provider-secret" }), 422, "LINKEDIN_NOT_FOUND"],
    [() => Response.json({ profile: {} }), 422, "LINKEDIN_NOT_FOUND"],
    [() => new Response("x", { headers: { "Content-Length": String(1024 * 1024 + 1) } }), 502, "LINKEDIN_UNAVAILABLE"],
    [() => { throw new DOMException("private-provider-secret", "TimeoutError"); }, 504, "LINKEDIN_TIMEOUT"],
  ]) {
    const f = fixture(); global.fetch = async () => reply();
    const response = await f.route.POST(jsonRequest({ source: "url", url: "linkedin.com/in/camille-example" }));
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: code });
    assert.deepEqual(f.events, ["model", "reserve"]); assert.equal(f.writes.length, 0);
  }
});

test("empty extractions and a contact URL alone never count as a successful resume", async () => {
  for (const extracted of [{}, { linkedin: "https://linkedin.com/in/camille-example" }]) {
    const f = fixture({ facts: extracted }); const response = await f.route.POST(textRequest());
    assert.equal(response.status, 422); assert.equal((await response.json()).error, "NO_RESUME_DATA");
    assert.equal(f.writes.length, 0);
  }
});

test("failed AI calls and failed persistence never return a successful import", async () => {
  const first = fixture({ aiError: new DOMException("timeout", "TimeoutError") });
  assert.equal((await first.route.POST(textRequest())).status, 504); assert.equal(first.writes.length, 0);
  const second = fixture({ saveError: Error("database unavailable") });
  assert.equal((await second.route.POST(textRequest())).status, 500); assert.equal(second.writes.length, 0);
});

test("conversion respects editor limits without discarding long summaries or experience lines", () => {
  const { linkedInFactsToResume } = loader({})("src/lib/linkedin-import.ts");
  const extracted = extractionSchema.parse({ ...facts(), headline: "x".repeat(300), summary: "a".repeat(8000), experiences: [{ company: "Example", description: Array.from({ length: 40 }, (_, i) => `Line ${i}`).join("\n") }] });
  const resume = linkedInFactsToResume(extracted, owner.email, "fr");
  assert.equal(resume.title.length, 160); assert.equal(resume.summary.join("").length, 8000);
  assert.equal(resume.experiences[0].description.length, 30);
  assert.ok(resume.experiences[0].description.at(-1).includes("Line 39"));
});

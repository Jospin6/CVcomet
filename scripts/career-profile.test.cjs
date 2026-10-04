/* Domain and HTTP tests: real schemas, route handlers and services; injected DB/AI.
   No network, production database writes or billable requests. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function loader(mocks = {}) {
  const cache = new Map();
  function load(name, parent = path.join(root, "entry.ts")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith(".") && !name.startsWith("@/") && !path.isAbsolute(name)) return require(name);
    let file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(parent), name);
    if (!path.extname(file)) file = [file + ".ts", file + ".tsx", file + ".js"].find(fs.existsSync);
    if (!file) throw Error("Cannot load " + name);
    if (Object.hasOwn(mocks, file)) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new vm.Script("(function(require,module,exports,__filename,__dirname){" + source + "\n})", { filename: file }).runInThisContext()((dep) => load(dep, file), module, module.exports, file, path.dirname(file));
    return module.exports;
  }
  return name => load(path.join(root, name));
}
const schema = loader()("src/lib/career-profile/schema.ts");
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const expId = "33333333-3333-4333-8333-333333333333";
const session = { id: owner, email: "person@example.test", role: "USER" };
const experience = { id: expId, title: "Developer", company: "Example", location: "", start: "2020", end: "", description: "Built a dashboard." };
const profile = () => ({ ...schema.emptyProfile(session.email), name: "Sam", careerGoal: "FIRST_JOB", experienceLevel: "STUDENT", targetJobTitle: "Developer", targetIndustry: "Software", targetCountry: "France", preferredWorkMode: "REMOTE", resumeSource: "SCRATCH" });
function row(p = profile()) {
  const { experiences, education, projects, certifications, ...scalars } = p;
  return { ...scalars, Experience: experiences, Education: education, Project: projects, certifications, profileRevision: 0, onboardingCompletedAt: null };
}
function request(body, url = "http://localhost/api/career-profile", method = "PUT") {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function fakeDB(initial = row()) {
  let data = structuredClone(initial);
  const calls = [];
  const delegate = (key) => ({
    deleteMany: async ({ where }) => { calls.push(["delete", key, where]); data[key] = data[key].filter(x => where.id.notIn.includes(x.id)); },
    create: async ({ data: item }) => { calls.push(["create", key, item]); data[key].push({ ...item, id: other }); },
    update: async ({ where, data: item }) => { calls.push(["update", key, where]); Object.assign(data[key].find(x => x.id === where.id), item); },
  });
  const db = {
    user: {
      findUnique: async () => structuredClone(data),
      findUniqueOrThrow: async () => structuredClone(data),
      updateMany: async ({ where, data: fields }) => {
        calls.push(["userUpdate", where]);
        if (where.id !== owner || where.profileRevision !== data.profileRevision) return { count: 0 };
        const { profileRevision, ...rest } = fields;
        Object.assign(data, rest); data.profileRevision += profileRevision.increment; return { count: 1 };
      },
    },
    experience: delegate("Experience"), education: delegate("Education"), project: delegate("Project"), certification: delegate("certifications"),
    $transaction: async fn => {
      const before = structuredClone(data);
      try { return await fn(db); } catch (error) { data = before; throw error; }
    },
  };
  return { db, calls, current: () => data };
}
const dbKey = path.join(root, "prisma/prisma.ts");

test("validation rejects unknown fields, foreign ownership fields and unsafe links", () => {
  assert.equal(schema.profileDataSchema.safeParse({ ...profile(), role: "ADMIN" }).success, false);
  assert.equal(schema.profileDataSchema.safeParse({ ...profile(), userId: other }).success, false);
  for (const link of ["javascript:alert(1)", "file:///tmp/a", "ftp://example.com"]) assert.equal(schema.profileDataSchema.safeParse({ ...profile(), github: link }).success, false);
  assert.equal(schema.profileDataSchema.safeParse({ ...profile(), github: "https://example.com/me" }).success, true);
  assert.equal(schema.profileDataSchema.safeParse({ ...profile(), headline: "x".repeat(301) }).success, false);
  assert.equal(schema.profileDataSchema.safeParse({ ...profile(), experiences: Array(51).fill(experience) }).success, false);
});
test("onboarding requires all direction fields and explicit confirmation; partial normal profiles remain valid", () => {
  const body = { profile: profile(), revision: 0, completeOnboarding: true, confirmed: true };
  assert.equal(schema.saveProfileSchema.safeParse(body).success, true);
  for (const key of ["name", "careerGoal", "experienceLevel", "targetJobTitle", "targetIndustry", "targetCountry", "preferredWorkMode", "resumeSource"]) assert.equal(schema.saveProfileSchema.safeParse({ ...body, profile: { ...profile(), [key]: "" } }).success, false, key);
  assert.equal(schema.saveProfileSchema.safeParse({ ...body, confirmed: false }).success, false);
  assert.equal(schema.saveProfileSchema.safeParse({ ...body, confirmed: undefined }).success, false);
  assert.equal(schema.saveProfileSchema.safeParse({ ...body, completeOnboarding: false, profile: schema.emptyProfile(session.email) }).success, true);
});
test("completeness is factual and students can reach 100% without work experience or awards", () => {
  assert.equal(schema.profileCompleteness(schema.emptyProfile()).percentage, 0);
  const complete = { ...profile(), headline: "Student", summary: "Studying software.", skills: "Java", languages: "French", education: [{ degree: "Computer science" }] };
  assert.equal(schema.profileCompleteness(complete).percentage, 100);
  assert.equal(schema.profileCompleteness({ ...complete, skills: "  " }).completed, 6);
});
test("import merge preserves account email, populated text and IDs and deduplicates entries", () => {
  const current = { ...profile(), experiences: [experience] };
  const extracted = { name: "Another name", email: "other@example.test", headline: "Developer", experiences: [{ ...experience, id: undefined }] };
  const merged = schema.mergeExtractedProfile(current, extracted);
  assert.equal(merged.name, current.name); assert.equal(merged.email, current.email);
  assert.equal(merged.headline, "Developer"); assert.equal(merged.experiences.length, 1);
  assert.equal(merged.experiences[0].id, expId);
  assert.equal(current.headline, "");
});
test("aggregate DTO preserves partial dates and exposes only professional context", async () => {
  const fixture = fakeDB(row({ ...profile(), experiences: [experience] }));
  const service = loader({ [dbKey]: fixture.db })("src/lib/career-profile/service.ts");
  const result = await service.getCareerProfile(owner);
  assert.equal(result.experiences[0].start, "2020");
  const context = service.careerProfileContext({ ...result, password: "secret", subscriptionId: "billing", role: "ADMIN" });
  for (const forbidden of ["password", "subscriptionId", "role", "revision", "onboardingCompletedAt"]) assert.equal(forbidden in context, false);
  assert.equal("id" in context.experiences[0], false);
});
test("foreign and duplicate child IDs are rejected before any write", async () => {
  for (const experiences of [[{ ...experience, id: other }], [experience, experience]]) {
    const fixture = fakeDB(row({ ...profile(), experiences: [experience] }));
    const service = loader({ [dbKey]: fixture.db })("src/lib/career-profile/service.ts");
    await assert.rejects(service.saveCareerProfile(owner, { ...profile(), experiences }, 0, true), error => [403, 400].includes(error.status));
    assert.equal(fixture.calls.length, 0);
  }
});
test("save preserves relation IDs, scopes every write to owner and timestamps onboarding once", async () => {
  const fixture = fakeDB(row({ ...profile(), experiences: [experience] }));
  const service = loader({ [dbKey]: fixture.db })("src/lib/career-profile/service.ts");
  const result = await service.saveCareerProfile(owner, { ...profile(), experiences: [{ ...experience, description: "Revised." }] }, 0, true);
  assert.equal(result.revision, 1); assert.equal(result.experiences[0].id, expId);
  assert.equal(result.experiences[0].description, "Revised.");
  assert.ok(result.onboardingCompletedAt);
  for (const call of fixture.calls.filter(x => x[0] === "update" || x[0] === "delete")) assert.equal(call[2].userId, owner);
  const second = await service.saveCareerProfile(owner, { ...profile(), experiences: [experience] }, 1, true);
  assert.equal(second.onboardingCompletedAt, result.onboardingCompletedAt);
});
test("stale revisions cannot erase a newer profile", async () => {
  const fixture = fakeDB({ ...row(), profileRevision: 2 });
  const service = loader({ [dbKey]: fixture.db })("src/lib/career-profile/service.ts");
  await assert.rejects(service.saveCareerProfile(owner, profile(), 1, true), error => error.status === 409);
  assert.equal(fixture.current().profileRevision, 2);
  assert.equal(fixture.calls.filter(x => x[0] === "delete").length, 0);
});
test("relation write failure rolls back the profile and its revision", async () => {
  const fixture = fakeDB(row());
  fixture.db.experience.create = async () => { throw Error("write failed"); };
  const service = loader({ [dbKey]: fixture.db })("src/lib/career-profile/service.ts");
  await assert.rejects(service.saveCareerProfile(owner, { ...profile(), name: "Changed", experiences: [{ ...experience, id: undefined }] }, 0, true));
  assert.equal(fixture.current().profileRevision, 0); assert.equal(fixture.current().name, "Sam");
});

test("profile HTTP operations deny anonymous users before processing input", async () => {
  const route = loader({ "@/lib/auth": { getSessionUser: async () => null }, [dbKey]: {} })("src/app/api/career-profile/route.ts");
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.PUT(request({}))).status, 401);
});
test("profile HTTP validation handles malformed JSON, mass assignment and absent consent", async () => {
  const route = loader({ "@/lib/auth": { getSessionUser: async () => session }, [dbKey]: {} })("src/app/api/career-profile/route.ts");
  assert.equal((await route.PUT(new Request("http://localhost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await route.PUT(request({ profile: { ...profile(), isSubscribed: true }, revision: 0, completeOnboarding: false, confirmed: true }))).status, 400);
  assert.equal((await route.PUT(request({ profile: profile(), revision: 0, completeOnboarding: false }))).status, 400);
});
test("bounded request body rejects a streamed oversized request without Content-Length", async () => {
  const { boundedBody } = loader()("src/lib/career-profile/http.ts");
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(12)); controller.close(); } });
  await assert.rejects(boundedBody(new Request("http://localhost", { method: "POST", body: stream, duplex: "half" }), 10), error => error.status === 413);
});
test("profile API writes only the authenticated account and returns no-store aggregate", async () => {
  const fixture = fakeDB();
  const route = loader({ "@/lib/auth": { getSessionUser: async () => session }, [dbKey]: fixture.db })("src/app/api/career-profile/route.ts");
  const read = await route.GET(); assert.equal(read.status, 200); assert.match(read.headers.get("cache-control"), /no-store/);
  const response = await route.PUT(request({ profile: profile(), revision: 0, completeOnboarding: true, confirmed: true }));
  assert.equal(response.status, 200); assert.equal((await response.json()).revision, 1);
  assert.equal(fixture.calls[0][1].id, owner);
});

function aiMocks(extra = {}) {
  return { "@/lib/auth": { getSessionUser: async () => session },
    "@/lib/gemini": { getCareerModel: () => "existing-provider" },
    "@/helpers/constants": { dayLimit: 20 },
    [dbKey]: { user: { findUnique: async () => ({ isSubscribed: true }) } }, ...extra };
}
test("daily quota reservation is atomic across concurrent requests", async () => {
  let count = 0, last = null;
  const db = { user: {
    findUnique: async () => ({ isSubscribed: false }),
    updateMany: async ({ where }) => {
      if (where.OR) { if (last) return { count: 0 }; last = new Date(); count = 1; return { count: 1 }; }
      if (count >= where.generationCount.lt) return { count: 0 };
      count++; return { count: 1 };
    },
  } };
  const ai = loader(aiMocks({ [dbKey]: db }))("src/lib/career-profile/ai.ts");
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => ai.reserveProfileAI(owner)));
  assert.equal(results.filter(x => x.status === "fulfilled").length, 20); assert.equal(count, 20);
  assert.ok(results.filter(x => x.status === "rejected").every(x => x.reason.status === 429));
});
test("rewrites reject invented numerical achievements and use only supplied text", async () => {
  let seen;
  const ai = loader(aiMocks({ ai: { generateObject: async args => { seen = args; return { object: { suggestion: "Improved performance by 80%." } }; } } }))("src/lib/career-profile/ai.ts");
  await assert.rejects(ai.improveText("Improved performance.", "experience", "en"), error => error.status === 422);
  assert.match(seen.system, /Never invent/);
  assert.deepEqual(JSON.parse(seen.prompt), { task: "Improve professional experience", language: "en", sourceText: "Improved performance." });
});
test("improvement checks saved experience ownership before calling AI", async () => {
  let calls = 0;
  const route = loader(aiMocks({ [dbKey]: { experience: { findFirst: async () => null } }, ai: { generateObject: async () => { calls++; } } }))("src/app/api/career-profile/improve/route.ts");
  const response = await route.POST(request({ field: "experience", text: "Existing text", experienceId: other, language: "en" }));
  assert.equal(response.status, 403); assert.equal(calls, 0);
});
test("improvement stays a proposal and never updates the profile", async () => {
  const route = loader(aiMocks({ ai: { generateObject: async () => ({ object: { suggestion: "Developed a dashboard." } }) } }))("src/app/api/career-profile/improve/route.ts");
  const response = await route.POST(request({ field: "experience", text: "Built a dashboard.", language: "en" }));
  assert.equal(response.status, 200); assert.equal((await response.json()).suggestion, "Developed a dashboard.");
});
test("resume upload validates authentication, bytes, type and size before AI", async () => {
  let calls = 0;
  const route = loader(aiMocks({ ai: { generateObject: async () => { calls++; } } }))("src/app/api/career-profile/import/route.ts");
  const upload = file => { const form = new FormData(); form.set("resume", file); return new Request("http://localhost", { method: "POST", body: form }); };
  assert.equal((await route.POST(upload(new File(["fake"], "cv.pdf", { type: "application/pdf" })))).status, 415);
  assert.equal((await route.POST(upload(new File(["a"], "cv.exe", { type: "text/plain" })))).status, 415);
  assert.equal((await route.POST(upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" })))).status, 413);
  assert.equal(calls, 0);
  const denied = loader(aiMocks({ "@/lib/auth": { getSessionUser: async () => null } }))("src/app/api/career-profile/import/route.ts");
  assert.equal((await denied.POST(upload(new File(["text"], "cv.txt", { type: "text/plain" })))).status, 401);
});
test("resume extraction reuses existing AI and returns a draft without persistence", async () => {
  let seen;
  const ai = loader(aiMocks())("src/lib/career-profile/ai.ts");
  const extracted = ai.extractionSchema.parse({ ...Object.fromEntries(Object.entries(profile()).filter(([key]) => key in ai.extractionSchema.shape)), name: "Sam", headline: "" });
  const route = loader(aiMocks({ ai: { generateObject: async args => { seen = args; return { object: extracted }; } } }))("src/app/api/career-profile/import/route.ts");
  const form = new FormData(); form.set("resume", new File(["Sam"], "cv.txt", { type: "text/plain" }));
  const response = await route.POST(new Request("http://localhost", { method: "POST", body: form }));
  assert.equal(response.status, 200); assert.equal((await response.json()).extracted.name, "Sam");
  assert.equal(seen.model, "existing-provider"); assert.match(seen.system, /Never invent/);
});
test("missing provider configuration and model failure are recoverable", async () => {
  let ExpectedError;
  const load = loader(aiMocks({ "@/lib/gemini": { getCareerModel: () => { throw new ExpectedError(503, "AI_UNAVAILABLE"); } } }));
  ExpectedError = load("src/lib/career-profile/http.ts").ProfileError;
  const response = await load("src/app/api/career-profile/improve/route.ts").POST(request({ field: "headline", text: "Developer", language: "en" }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AI_UNAVAILABLE" });
  const failed = loader(aiMocks({ ai: { generateObject: async () => { throw Error("provider down"); } } }))("src/app/api/career-profile/improve/route.ts");
  assert.equal((await failed.POST(request({ field: "headline", text: "Developer", language: "en" }))).status, 502);
});
test("legacy collection endpoints deny cross-account requests and validate server input", async () => {
  for (const kind of ["experiences", "educations", "projects", "certifications"]) {
    const route = loader({ "@/lib/auth": { getSessionUser: async () => session }, [dbKey]: {} })("src/app/api/" + kind + "/route.ts");
    assert.equal((await route.GET(new Request("http://localhost/api/" + kind + "?userId=" + other))).status, 403);
    assert.equal((await route.POST(request({ userId: other }))).status, 400);
  }
});
test("migration adds fields only, without touching existing models or data", () => {
  const sql = fs.readFileSync(path.join(root, "prisma/migrations/20261004120000_career_profile/migration.sql"), "utf8");
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE|RENAME)\b/i);
  assert.equal((sql.match(/ADD COLUMN/g) || []).length, 12);
  assert.match(sql, /"profileRevision" INTEGER NOT NULL DEFAULT 0/);
});

test("generation accepts existing language names but discards client-supplied facts", () => {
  const parsed = schema.generationInputSchema.parse({ description: "Job", conversationId: owner, language: "French", user: { skills: "Invented skill", role: "ADMIN" } });
  assert.deepEqual(parsed, { description: "Job", conversationId: owner, language: "fr" });
});
test("CV and letter generation use only the owned central profile and reject cross-account conversations", async () => {
  for (const routeName of ["src/app/api/generate-cv/route.tsx", "src/app/api/generate-cover-letter/route.ts"]) {
    let seen, usedProfileId, forbidden = false;
    const db = { conversation: { findUnique: async () => ({ userId: forbidden ? other : owner, content: "Original job" }) },
      message: { create: async () => ({}), findMany: async () => [] } };
    const route = loader({
      "@/lib/auth": { getSessionUser: async () => session, canAccessUser: (user, id) => user.id === id },
      "@/lib/gemini": { getCareerModel: () => "existing-provider" },
      "@/lib/career-profile/ai": { reserveProfileAI: async () => {}, factualRules: "Never invent facts." },
      "@/lib/career-profile/service": {
        getCareerProfile: async id => { usedProfileId = id; return { headline: "Confirmed headline", skills: "Java" }; },
        careerProfileContext: value => value,
      },
      ai: { streamObject: async args => { seen = args; return { toTextStreamResponse: () => new Response("ok") }; } },
      [dbKey]: db,
    })(routeName);
    const response = await route.POST(request({ description: "Job", conversationId: owner, language: "English", user: { skills: "Invented skill" } }));
    assert.equal(response.status, 200); assert.equal(usedProfileId, owner);
    assert.match(JSON.stringify(seen.messages), /Confirmed headline/);
    assert.doesNotMatch(JSON.stringify(seen.messages), /Invented skill/);
    forbidden = true;
    assert.equal((await route.POST(request({ description: "Job", conversationId: other, language: "en" }))).status, 403);
  }
});
test("profile assistance denies anonymous requests and blocks server mass assignment", async () => {
  const denied = loader(aiMocks({ "@/lib/auth": { getSessionUser: async () => null } }))("src/app/api/career-profile/improve/route.ts");
  assert.equal((await denied.POST(request({}))).status, 401);
  const route = loader(aiMocks())("src/app/api/career-profile/improve/route.ts");
  assert.equal((await route.POST(request({ field: "headline", text: "Developer", language: "en", userId: other }))).status, 400);
});
test("authenticated sessions reload current account and role instead of trusting stale JWT claims", async () => {
  let exists = true;
  const load = loader({
    "next/headers": { cookies: async () => ({ get: () => ({ value: "signed-token" }) }) },
    jose: { jwtVerify: async () => ({ payload: { id: owner, email: "old@example.test", role: "ADMIN" } }) },
    "@/lib/utils": { getJwtSecret: () => new Uint8Array([1]) },
    [dbKey]: { user: { findUnique: async () => exists ? session : null } },
  });
  const auth = load("src/lib/auth.ts");
  assert.deepEqual(await auth.getSessionUser(), session);
  exists = false; assert.equal(await auth.getSessionUser(), null);
});

test("duplicate entries within one extraction are collapsed before review", () => {
  const draft = schema.mergeExtractedProfile(profile(), { experiences: [experience, experience] });
  assert.equal(draft.experiences.length, 1);
});
test("valid PDF is sent as a file part through the same provider", async () => {
  let seen;
  const ai = loader(aiMocks())("src/lib/career-profile/ai.ts");
  const extracted = ai.extractionSchema.parse(Object.fromEntries(Object.entries(profile()).filter(([key]) => key in ai.extractionSchema.shape)));
  const route = loader(aiMocks({ ai: { generateObject: async args => { seen = args; return { object: extracted }; } } }))("src/app/api/career-profile/import/route.ts");
  const form = new FormData(); form.set("resume", new File(["%PDF-1.4\nfixture"], "cv.pdf", { type: "application/pdf" }));
  const response = await route.POST(new Request("http://localhost", { method: "POST", body: form }));
  assert.equal(response.status, 200); assert.equal(seen.messages[0].content[1].type, "file");
  assert.equal(seen.messages[0].content[1].mimeType, "application/pdf");
  assert.equal(seen.messages[0].content[1].data.subarray(0, 5).toString(), "%PDF-");
});

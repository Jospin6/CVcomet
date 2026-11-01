const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadSource = require("./source-loader.cjs");
const load = loadSource({});
const { analyzeResume, storedAtsReport } = load("src/lib/career/ats.ts");
const { resumeContentSchema, resumeUnits, isSidebarSection } = load("src/lib/resume-editor.ts");
const { parseAtsDate, containsAtsTerm, atsClaimedSkills } = load("src/lib/career/ats-text.ts");
const { inspectAtsPdf } = load("src/lib/career/ats-pdf.ts");
const { validateAtsReview } = loadSource({ "@/lib/career-profile/ai": { factualRules: "Use only candidate facts." } })("src/lib/career/ats-review.ts");
const owner = "11111111-1111-4111-8111-111111111111", cvId = "22222222-2222-4222-8222-222222222222";
function draft() { return resumeContentSchema.parse({
  title: "Frontend developer", contact: { name: "Alex Morgan", email: "alex@example.test" },
  summary: ["Builds accessible web interfaces for internal service teams."], skills: [{ hardskills: "React, TypeScript, CSS, HTML", tools: "Git, PostgreSQL" }],
  experiences: [{ title: "Frontend developer", company: "Northwind Studio", start: "2022", end: "Present", description: ["Built a React and TypeScript service dashboard with CSS, HTML, Git and PostgreSQL; the keyboard navigation enabled support agents to complete order reviews independently."] }], design: { layout: "classic" },
}); }
function weak() { return resumeContentSchema.parse({
  title: "AI Engineer", contact: { name: "Alex Morgan", email: "alex@example.test" },
  skills: [{ hardskills: "Reactjs, Nextjs, Python, FastAPI, Tailwind CSS" }],
  experiences: [{ title: "Data analyst", company: "Example Labs", start: "2025-04-28", end: "2025-05-11", description: ["lead team"] }],
  educations: [{ degree: "Computer science", school: "Example University", start: "2022-02-02", end: "2024-11-14", description: ["basics of ai and coing"] }],
  projects: [{ title: "data scraper", description: "an application to scraper data from internet" }],
}); }
function review(cv, rating = 4) {
  const work = cv.experiences[0] ? { field: "experiences.0.description", quote: cv.experiences[0].description.join("\n") } : null;
  const descriptions = [...cv.experiences.map((entry, index) => ({ field: `experiences.${index}.description`, quote: entry.description.join("\n") })), ...cv.projects.map((entry, index) => ({ field: `projects.${index}.description`, quote: entry.description }))].filter(item => item.quote);
  const contributions = descriptions.map(item => ({ field: item.field, actionQuote: item.quote.includes("Built a React") ? "Built a React and TypeScript service dashboard" : item.quote, methodQuote: item.quote.includes("Built a React") ? "React and TypeScript service dashboard with CSS, HTML, Git and PostgreSQL" : "", outcomeQuote: item.quote.includes("Built a React") ? "enabled support agents to complete order reviews independently" : "", outcomeType: item.quote.includes("Built a React") ? "OBSERVED" : "NOT_STATED" }));
  return { contributions, skillEvidence: atsClaimedSkills(cv).map(skill => { const source = contributions.find(item => containsAtsTerm(item.methodQuote, skill.term)); return { skill: skill.term, status: source ? "DEMONSTRATED" : "UNSUPPORTED", evidence: source ? [{ field: source.field, quote: source.methodQuote }] : [] }; }), criteria: [
    { id: "specificity", rating: work ? rating : 0, reason: "Assessed personal actions, methods and outcomes in the supplied work.", evidence: work ? [work] : [] },
    { id: "positioning", rating: work ? rating : 0, reason: "Compared the headline with the practical evidence actually supplied.", evidence: work ? [{ field: "title", quote: cv.title }, work] : [] },
    { id: "writing", rating: work ? rating : 0, reason: "Reviewed the actual wording of the supplied descriptions.", evidence: work ? [work] : [] },
  ], issues: [] };
}
const assessed = cv => validateAtsReview(review(cv), cv);

test("no universal ATS percentage or complete content score is invented when review/PDF/job data are absent", () => {
  const result = analyzeResume(draft());
  assert.equal(result.overallScore, null);
  assert.equal(result.content.score, null);
  assert.equal(result.content.assessedWeight, 30);
  assert.equal(result.technical.score, null);
  assert.equal(result.jobMatch.score, null);
  assert.equal(result.jobMatch.status, "NOT_PROVIDED");
  assert.ok(result.content.checks.filter(check => check.status === "NOT_ASSESSED").every(check => check.earned === null));
  assert.equal(result.content.checks.find(check => check.id === "demonstrated-skills").earned, null);
});

test("a terse AI headline/web skills/two-word experience cannot receive 77 even from an overly generous model", () => {
  const cv = weak(), semantic = assessed(cv);
  const result = analyzeResume(cv, [], "en", { semantic });
  assert.ok(result.content.score < 60);
  assert.ok(result.issues.some(issue => issue.field === "experiences.0.description" && issue.evidence.some(source => source.quote === "lead team")));
  assert.ok(result.issues.some(issue => issue.title === "Support your skills with examples"));
  assert.equal(result.content.checks.find(check => check.id === "demonstrated-skills").earned, 0);
  const richer = draft(), better = analyzeResume(richer, [], "en", { semantic: assessed(richer) });
  assert.ok(better.content.score > result.content.score + 20);
});

test("skills evidence is normalized and repetition, employer prestige, numbers and keyword stuffing earn no bonus", () => {
  const cv = draft(), baseline = analyzeResume(cv, [], "en", { semantic: assessed(cv) });
  cv.skills[0].hardskills += ", React.js, react, REACT";
  cv.experiences[0].company = "A famous company";
  cv.contact.phone = "+33 123456789";
  cv.design.documentName = "Docker Kubernetes Machine learning";
  const result = analyzeResume(cv, Array(10).fill("React"), "en", { semantic: assessed(cv) });
  assert.equal(result.content.score, baseline.content.score);
  assert.deepEqual(result.keywords.matched, ["React"]);
  assert.equal(containsAtsTerm("JavaScript C++ C# .NET", "Java"), false);
  for (const term of ["C++", "C#", ".NET"]) assert.equal(containsAtsTerm("JavaScript C++ C# .NET", term), true);
  assert.equal(containsAtsTerm("React.js Next.js Fast API", "Reactjs"), true);
  assert.equal(result.issues.some(issue => /add.*number|quantif/i.test(issue.title)), false, "Qualitative outcomes must not require invented metrics");
});

test("hidden sections, metadata and source objects cannot rescue missing document evidence", () => {
  const cv = draft(); cv.design.hiddenSections = ["summary", "skills", "experiences"];
  const before = JSON.stringify(cv), result = analyzeResume(cv, ["React", "Frontend developer"], "fr");
  assert.equal(JSON.stringify(cv), before);
  assert.deepEqual(result.keywords.missing, ["React"]);
  assert.ok(result.issues.some(issue => issue.field === "summary.0"));
  assert.ok(result.issues.some(issue => issue.field === "skills.0.hardskills"));
  assert.ok(result.issues.some(issue => issue.severity === "critical"));
});

test("chronology validates real dates and partial dates without penalizing short roles or career gaps", () => {
  assert.ok(parseAtsDate("2024-02-29")); assert.equal(parseAtsDate("2023-02-29"), null);
  assert.equal(parseAtsDate("2024-13"), null);
  for (const date of ["2020", "2020-01", "01/2020", "15/01/2020", "Jan 2020", "février 2020"]) assert.ok(parseAtsDate(date), date);
  const cv = weak(), before = analyzeResume(cv);
  cv.experiences[0].start = "2026-05-11"; cv.experiences[0].end = "2025-04-28";
  const invalid = analyzeResume(cv, [], "en", { now: new Date("2026-10-18") });
  assert.ok(invalid.issues.some(issue => issue.field?.startsWith("experiences.0.") && issue.severity === "critical"));
  assert.ok(before.content.checks.find(check => check.id === "chronology").earned > invalid.content.checks.find(check => check.id === "chronology").earned);
});

test("semantic quotes must be exact and from visible fields; invented rewrite numbers are discarded", () => {
  const cv = draft(), fabricated = review(cv);
  fabricated.criteria[0].evidence[0].quote = "Saved a million dollars.";
  assert.throws(() => validateAtsReview(fabricated, cv), /AI_UNSUPPORTED_EVIDENCE/);
  const duplicate = review(cv); duplicate.criteria[1].id = "writing";
  assert.throws(() => validateAtsReview(duplicate, cv), /AI_INVALID_RESPONSE/);
  const proposal = review(cv);
  proposal.issues.push({ field: "experiences.0.description", severity: "warning", title: "Clarify the outcome", reason: "The source does not supply a measured outcome.", suggestion: "Describe the observed qualitative result without inventing a metric.", quote: cv.experiences[0].description[0], proposedText: "Improved productivity by 90%." });
  const checked = validateAtsReview(proposal, cv);
  assert.equal(checked.issues[0].proposedText, undefined);
  cv.design.hiddenSections = ["experiences"];
  assert.throws(() => validateAtsReview(review(cv), cv), /AI_UNSUPPORTED_EVIDENCE/);
});

test("short but specific qualitative achievements are accepted without a word-count or numeric-results requirement", () => {
  const cv = draft(); cv.experiences[0].description = ["Built React dashboards; colleagues completed daily reviews independently."];
  const candidate = review(cv);
  candidate.contributions[0] = { field: "experiences.0.description", actionQuote: "Built React dashboards", methodQuote: "React", outcomeQuote: "colleagues completed daily reviews independently", outcomeType: "OBSERVED" };
  const verified = validateAtsReview(candidate, cv);
  assert.equal(verified.criteria.find(item => item.id === "specificity").rating, 4);
  const report = analyzeResume(cv, [], "en", { semantic: verified });
  assert.equal(report.issues.some(issue => issue.title === "Make your contribution specific"), false);
});

test("a project-only portfolio is assessed without requiring an employer or unavailable project dates", () => {
  const cv = draft(), description = cv.experiences[0].description[0];
  cv.experiences = []; cv.educations = [];
  cv.projects = [{ title: "Service dashboard", description, technologies: "React, TypeScript", link: "" }];
  const candidate = review(cv), source = { field: "projects.0.description", quote: description };
  for (const criterion of candidate.criteria) {
    criterion.rating = 4;
    criterion.evidence = criterion.id === "positioning" ? [{ field: "title", quote: cv.title }, source] : [source];
  }
  const result = analyzeResume(cv, [], "en", { semantic: validateAtsReview(candidate, cv) });
  assert.equal(result.content.checks.find(check => check.id === "chronology").earned, 10);
  assert.equal(result.content.score, 100);
  assert.equal(result.issues.some(issue => /dates|employer/i.test(issue.title)), false);
});

test("the real AI SDK sends a strict complete review schema and validates evidence before scoring", async t => {
  const factory = loadSource({ [path.resolve(__dirname, "../prisma/prisma.ts")]: {} })("src/lib/ai/model.ts");
  const model = factory.createAIModel({ provider: "OPENAI", model: "gpt-4o-mini", apiKey: "fake-key", enabled: true }, { structuredOutputs: true });
  const cv = draft(); let calls = 0;
  const assertRequired = node => {
    if (node.type === "object") {
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
      for (const child of Object.values(node.properties)) assertRequired(child);
    }
    if (node.items) assertRequired(node.items);
  };
  t.mock.method(global, "fetch", async (url, options) => {
    calls++; const request = JSON.parse(options.body);
    assert.equal(new URL(url).hostname, "api.openai.com");
    assert.equal(request.response_format.type, "json_schema");
    assert.equal(request.response_format.json_schema.strict, true);
    assertRequired(request.response_format.json_schema.schema);
    assert.match(request.messages[0].content, /untrusted data/);
    return Response.json({ id: "test", object: "chat.completion", created: 1, model: "gpt-4o-mini", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(review(cv)) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  });
  const reviewer = loadSource({ "@/lib/career-profile/ai": { factualRules: "Use only supplied facts." } })("src/lib/career/ats-review.ts");
  const result = await reviewer.reviewAtsContent(cv, "en", model);
  assert.equal(calls, 1); assert.equal(result.status, "COMPLETE");
  assert.ok(analyzeResume(cv, [], "en", { semantic: result }).content.score > 75);
});

test("semantic skill evidence accepts practical equivalents and rejects skills-list citations", () => {
  const cv = draft(); cv.title = "Responsable des achats";
  cv.skills = [{ hardskills: "Négociation", tools: "", softskills: "" }];
  cv.experiences[0].description = ["Renégocié les contrats via une comparaison des offres ; coûts réduits."];
  const candidate = review(cv);
  candidate.contributions[0] = { field: "experiences.0.description", actionQuote: "Renégocié les contrats", methodQuote: "comparaison des offres", outcomeQuote: "coûts réduits", outcomeType: "OBSERVED" };
  candidate.skillEvidence[0] = { skill: "Négociation", status: "DEMONSTRATED", evidence: [{ field: "experiences.0.description", quote: "Renégocié les contrats via une comparaison des offres" }] };
  assert.equal(containsAtsTerm(cv.experiences[0].description[0], "Négociation"), false);
  const result = analyzeResume(cv, [], "fr", { semantic: validateAtsReview(candidate, cv, "fr") });
  assert.equal(result.content.checks.find(check => check.id === "demonstrated-skills").earned, 20);
  candidate.skillEvidence[0].evidence = [{ field: "skills.0.hardskills", quote: "Négociation" }];
  assert.throws(() => validateAtsReview(candidate, cv), /AI_UNSUPPORTED_EVIDENCE/);
});

test("invalid contextual evidence gets one bounded correction and repeated failures remain errors", async () => {
  const cv = draft(); let calls = 0, signal;
  const invalid = review(cv); invalid.criteria[0].evidence[0].quote = "An invented result.";
  const reviewer = loadSource({
    ai: { generateObject: async options => {
      calls++; if (!signal) signal = options.abortSignal;
      assert.equal(options.abortSignal, signal);
      if (calls > 1) assert.ok(JSON.parse(options.prompt).correction);
      return { object: calls === 1 ? invalid : review(cv) };
    } },
    "@/lib/career-profile/ai": { factualRules: "Use only supplied facts." },
  })("src/lib/career/ats-review.ts");
  assert.equal((await reviewer.reviewAtsContent(cv, "en", {})).status, "COMPLETE");
  assert.equal(calls, 2);
  let failures = 0;
  const failing = loadSource({
    ai: { generateObject: async () => { failures++; return { object: invalid }; } },
    "@/lib/career-profile/ai": { factualRules: "Use only supplied facts." },
  })("src/lib/career/ats-review.ts");
  await assert.rejects(failing.reviewAtsContent(cv, "en", {}), /AI_UNSUPPORTED_EVIDENCE/);
  assert.equal(failures, 2);
});

test("job alignment requires practical evidence and preserves uncertainty instead of inflating a score", () => {
  const { assessAtsJobMatch } = load("src/lib/career/ats-job-match.ts");
  const cv = draft(); cv.skills[0].hardskills += ", Docker";
  const baseline = { requirements: [
    { title: "React", category: "TECHNICAL", priority: "REQUIRED", terms: ["React"], evidence: "React is required.", ambiguity: "", status: "DEMONSTRATED", evidenceSources: [] },
    { title: "Docker", category: "TECHNICAL", priority: "REQUIRED", terms: ["Docker"], evidence: "Docker is required.", ambiguity: "", status: "DEMONSTRATED", evidenceSources: [] },
  ] };
  const result = assessAtsJobMatch(cv, baseline);
  assert.deepEqual(result.requirements.map(item => item.status), ["DEMONSTRATED", "VERIFY"]);
  assert.equal(result.score, null); assert.deepEqual(result.range, { min: 50, max: 100 });
  assert.equal(result.coverage, 50);
  cv.design.hiddenSections = ["experiences"];
  const hidden = assessAtsJobMatch(cv, baseline);
  assert.equal(hidden.score, null);
  assert.ok(hidden.requirements.every(item => item.status === "VERIFY"));
});

async function exported(cv) {
  const React = require("react"), { renderToBuffer } = await import("@react-pdf/renderer");
  const { ResumePDF } = load("src/components/resumes/resume-pdf.tsx");
  const units = resumeUnits(cv, false), pages = [{ main: units.filter(unit => !isSidebarSection(unit.section, cv.design)), side: units.filter(unit => isSidebarSection(unit.section, cv.design)) }];
  return renderToBuffer(React.createElement(ResumePDF, { resume: cv, pages, copy: load("src/lib/resume-editor-copy.ts").resumeEditorCopy.en }));
}
function tinyPdf(lines) {
  const content = lines.map(({ text, x = 40, y = 750, size = 10 }) => `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${text.replace(/[\\()]/g, "\\$&")}) Tj ET`).join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  return Buffer.from(pdf + `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

test("the real PDF export preserves visible fields and emits recognizable section titles", async () => {
  const cv = draft(), bytes = await exported(cv), result = await inspectAtsPdf(bytes, cv);
  assert.equal(result.status, "VERIFIED"); assert.equal(result.recovery, 100);
  assert.ok(result.bytes > 0); assert.ok(result.extractedCharacters > 100);
  assert.equal(result.spacedHeadings.length, 0);
  assert.match(result.text, /EXPERIENCE/); assert.match(result.text, /SKILLS/);
  assert.equal(result.issues.some(issue => issue.id === "pdf-columns"), false);
});

test("actual file text, spaced headings, missing fields and image-only PDFs affect technical checks", async () => {
  const cv = draft();
  const broken = await inspectAtsPdf(tinyPdf([{ text: "Alex Morgan" }, { text: "S K I L L S", y: 700 }, { text: "Unrelated content which omits the candidate email and all achievements.", y: 650 }]), cv);
  assert.ok(broken.spacedHeadings.includes("S K I L L S"));
  assert.ok(broken.issues.some(issue => issue.field === "contact.email"));
  assert.ok(broken.score < 50);
  const scan = await inspectAtsPdf(tinyPdf([]), cv);
  assert.equal(scan.extractedCharacters, 0); assert.ok(scan.score <= 15);
  assert.ok(scan.issues.some(issue => issue.id === "pdf-no-text"));
  await assert.rejects(inspectAtsPdf(Buffer.from("not a PDF"), cv), error => error.code === "INVALID_FILE");
});

test("PDF column risk is measured from the exported file rather than guessed from template metadata", async () => {
  const cv = draft(); cv.design.layout = "modern";
  cv.certifications = [{ title: "Accessibility certificate", issuer: "Training institute", date: "2021", description: "Accessible navigation and inclusive interface training." }];
  cv.languages = [{ language: "English", level: "Professional" }];
  const result = await inspectAtsPdf(await exported(cv), cv);
  assert.ok(result.issues.some(issue => issue.id === "pdf-columns"));
  const report = analyzeResume(cv);
  assert.equal(report.technical.status, "NOT_PROVIDED");
  assert.equal(report.issues.some(issue => issue.category === "PARSING"), false);
});

test("AI failures preserve completed checks and cannot produce a complete content score", async () => {
  const { assessAtsResume } = loadSource({
    "@/lib/ai/model": { getAIModel: async () => { throw Object.assign(new Error("AI_UNAVAILABLE"), { status: 503, code: "AI_UNAVAILABLE" }); } },
    "@/lib/career-profile/ai": { reserveProfileAI: async () => { throw Error("Must not reserve quota without a model"); }, factualRules: "Facts only" },
  })("src/lib/career/ats-service.ts");
  const result = await assessAtsResume({ userId: owner, resume: weak() });
  assert.equal(result.review.status, "UNAVAILABLE");
  assert.equal(result.content.score, null); assert.equal(result.overallScore, null);
  assert.ok(result.issues.length);
});

function fixture({ authorized = true, wait, jobs = [] } = {}) {
  const saved = [], inputs = [], cv = { ...draft(), id: cvId, title: "Saved headline" }; let calls = 0;
  const route = loadSource({
    [path.resolve(__dirname, "../prisma/prisma.ts")]: {
      cv: { findFirst: async ({ where }) => where.id === cvId && where.conversation.userId === owner ? cv : null },
      jobOpportunity: { findFirst: async ({ where }) => jobs.find(job => job.id === where.id && job.userId === where.userId) ?? null },
      atsAnalysis: { create: async ({ data }) => { const row = { id: "analysis-" + saved.length, createdAt: new Date(), ...data }; saved.push(row); return row; }, findMany: async ({ where }) => saved.filter(row => row.userId === where.userId && (!where.cvId || row.cvId === where.cvId)) },
    },
    "@/lib/career/auth-user": { requireUser: async () => { if (!authorized) throw Object.assign(new Error("Unauthorized"), { status: 401 }); return { id: owner }; } },
    "@/lib/agentic/agents/ats/agent/ats.agent": { runAtsAgent: async ({ actorId, input }) => { const { resume, keywords, language, document, jobDescription } = input; inputs.push(input); calls++; if (wait) await wait; return analyzeResume(resume, keywords, language, { document, semantic: assessed(resume), ...(jobDescription ? { jobMatch: { status: "COMPLETE", score: 50, requirements: [] } } : {}) }); } },
  })("src/app/api/ats/route.ts");
  const post = body => route.POST(new Request("http://localhost/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { post, route, saved, cv, inputs, calls: () => calls };
}

test("saved jobs are resolved by ownership and the assessment records its exact target; job changes invalidate caching", async () => {
  const jobId = "33333333-3333-4333-8333-333333333333";
  const job = { id: jobId, userId: owner, title: "Chief AI Officer", company: "Meta", description: "Lead the AI team and develop responsible AI strategy. " .repeat(3), analysis: { saved: "source" }, updatedAt: new Date("2026-10-18T12:00:00Z") };
  const other = { ...job, id: "44444444-4444-4444-8444-444444444444", userId: "another-user" };
  const app = fixture({ jobs: [job, other] });
  const first = await app.post({ cvId, draft: draft(), jobId });
  assert.equal(first.status, 200);
  const report = await first.json();
  assert.equal(report.targetJob.id, jobId); assert.equal(report.targetJob.title, job.title); assert.equal(report.targetJob.company, "Meta");
  assert.equal(app.inputs[0].jobDescription, job.description); assert.deepEqual(app.inputs[0].jobAnalysis, job.analysis);
  assert.equal(storedAtsReport(app.saved[0].issues).targetJob.id, jobId);
  assert.equal((await app.post({ cvId, draft: draft(), jobId })).status, 200); assert.equal(app.calls(), 1);
  job.description += " Experience with production model monitoring is required."; job.updatedAt = new Date("2026-10-18T13:00:00Z");
  assert.equal((await app.post({ cvId, draft: draft(), jobId })).status, 200); assert.equal(app.calls(), 2);
  assert.equal((await app.post({ cvId, jobId: other.id, pdf: "invalid-base64" })).status, 404);
  assert.equal((await app.post({ cvId, jobId: owner })).status, 404);
  assert.equal((await app.post({ cvId, jobId, jobDescription: job.description })).status, 400);
  assert.equal(app.calls(), 2);
});

test("ATS reuses validated saved requirements but re-extracts them if the saved citations no longer match", async () => {
  const jobModule = load("src/lib/career/job-match.ts"), { jobAnalysisSchema } = load("src/lib/career/job-schema.ts");
  const cv = draft(), jobDescription = "Frontend developer. React is required. Docker is preferred. " .repeat(3);
  const analysis = jobAnalysisSchema.parse({ title: "Frontend developer", requirements: [{ id: "react", title: "React", category: "TECHNICAL", priority: "REQUIRED", description: "", evidence: "React is required.", ambiguity: "", terms: ["React"] }] });
  let extractions = 0, reservations = 0;
  const service = loadSource({
    "@/lib/ai/model": { getAIModel: async () => ({}) },
    "@/lib/career-profile/ai": { reserveProfileAI: async () => { reservations++; } },
    "./ats-review": { reviewAtsContent: async () => assessed(cv) },
    "./job-match": { ...jobModule, analyzeJobDescription: async () => { extractions++; return analysis; } },
  })("src/lib/career/ats-service.ts");
  const first = await service.assessAtsResume({ userId: owner, resume: cv, jobDescription, jobAnalysis: analysis });
  assert.equal(extractions, 0); assert.equal(reservations, 1);
  assert.equal(first.jobMatch.status, "COMPLETE"); assert.equal(first.jobMatch.score, 100);
  const invalid = structuredClone(analysis); invalid.requirements[0].evidence = "An invented requirement.";
  const second = await service.assessAtsResume({ userId: owner, resume: cv, jobDescription, jobAnalysis: invalid });
  assert.equal(extractions, 1); assert.equal(reservations, 2); assert.equal(second.jobMatch.status, "COMPLETE");
  const unavailable = loadSource({
    "@/lib/ai/model": { getAIModel: async () => { throw Error("Unavailable"); } },
    "@/lib/career-profile/ai": { reserveProfileAI: async () => { throw Error("Must not reserve without a provider"); } },
  })("src/lib/career/ats-service.ts");
  const partial = await unavailable.assessAtsResume({ userId: owner, resume: cv, jobDescription, jobAnalysis: analysis });
  assert.equal(partial.review.status, "UNAVAILABLE"); assert.equal(partial.content.score, null);
  assert.equal(partial.jobMatch.score, 100, "Validated saved requirements can be compared even when content review is unavailable");
});

test("job titles are recognizable and company labels are not duplicated", () => {
  const { savedJobTitle, savedJobLabel, savedJobInput } = load("src/lib/career/job-opportunities.ts");
  assert.equal(savedJobLabel({ title: "Chief AI Officer", company: "Meta" }, "en"), "Chief AI Officer at Meta");
  assert.equal(savedJobLabel({ title: "Chief AI Officer", company: "Meta" }, "fr"), "Chief AI Officer chez Meta");
  assert.equal(savedJobLabel({ title: "Chief AI Officer at Meta", company: "Meta" }, "en"), "Chief AI Officer at Meta");
  assert.equal(savedJobLabel({ title: "Metaverse Engineer", company: "Meta" }, "en"), "Metaverse Engineer at Meta");
  assert.equal(savedJobTitle({ title: " ", description: "\nChief AI Officer\nThe role involves…" }), "Chief AI Officer");
  assert.throws(() => savedJobInput.parse({ title: " ", description: "x".repeat(100) }));
});

test("the saved-job catalog scopes searches and pagination to the owner and only exposes metadata", async () => {
  const queries = [], jobs = Array.from({ length: 31 }, (_, index) => ({ id: String(index + 1).padStart(8, "0") + "-3333-4333-8333-333333333333", title: `AI role ${index}`, company: "Meta", createdAt: new Date(), updatedAt: new Date() }));
  const route = loadSource({
    [path.resolve(__dirname, "../prisma/prisma.ts")]: { jobOpportunity: { findMany: async input => { queries.push(input); return jobs; } } },
    "@/lib/career/auth-user": { requireUser: async () => ({ id: owner }) },
  })("src/app/api/job-opportunities/route.ts");
  const response = await route.GET(new Request("http://localhost/api/job-opportunities?q=Meta&cursor=" + cvId));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const page = await response.json(); assert.equal(page.items.length, 30); assert.equal(page.nextCursor, jobs[29].id);
  assert.equal(queries[0].where.userId, owner); assert.equal(queries[0].where.OR[1].company.contains, "Meta");
  assert.equal(queries[0].cursor.id, cvId); assert.equal(queries[0].skip, 1);
  for (const privateField of ["userId", "description", "originalText", "analysis"]) assert.equal(queries[0].select[privateField], undefined);
  assert.equal((await route.GET(new Request("http://localhost/api/job-opportunities?q=" + "x".repeat(201)))).status, 400);
  assert.equal((await route.GET(new Request("http://localhost/api/job-opportunities?userId=foreign"))).status, 400);
  assert.equal(queries.length, 1);
});

test("saving a titled job uses the authenticated owner, rejects invalid inputs, and reuses identical saves", async () => {
  const rows = [];
  const route = loadSource({
    [path.resolve(__dirname, "../prisma/prisma.ts")]: { jobOpportunity: {
      findFirst: async ({ where }) => rows.find(row => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
      create: async ({ data }) => { const row = { ...data, id: cvId }; rows.push(row); return row; },
    } },
    "@/lib/career/auth-user": { requireUser: async () => ({ id: owner }) },
  })("src/app/api/job-opportunities/route.ts");
  const post = body => route.POST(new Request("http://localhost/api/job-opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const body = { title: " Chief AI Officer ", company: " Meta ", description: "Develop the AI strategy and lead a team delivering responsible machine learning systems. " .repeat(2) };
  assert.equal((await post(body)).status, 201); assert.equal((await post(body)).status, 200);
  assert.equal(rows.length, 1); assert.equal(rows[0].title, "Chief AI Officer"); assert.equal(rows[0].company, "Meta"); assert.equal(rows[0].userId, owner);
  for (const invalid of [{ ...body, title: " " }, { ...body, description: "short" }, { ...body, userId: "foreign" }, { ...body, title: "x".repeat(181) }]) assert.equal((await post(invalid)).status, 400);
  assert.equal(rows.length, 1);
  const anonymous = loadSource({ "@/lib/career/auth-user": { requireUser: async () => { throw Object.assign(new Error("Unauthorized"), { status: 401 }); } } })("src/app/api/job-opportunities/route.ts");
  assert.equal((await anonymous.GET(new Request("http://localhost"))).status, 401);
  assert.equal((await anonymous.POST(new Request("http://localhost", { method: "POST", body: "invalid" }))).status, 401);
});

test("the endpoint checks the current draft, persists a versioned report and caches completed identical analyses", async () => {
  const app = fixture(), current = draft(); current.summary = [];
  const response = await app.post({ cvId, draft: current, language: "fr" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.version, 2); assert.equal(result.overallScore, null);
  assert.ok(result.issues.some(issue => issue.field === "summary.0"));
  assert.equal(app.cv.title, "Saved headline");
  assert.equal(storedAtsReport(app.saved[0].issues).version, 2);
  assert.equal((await app.post({ cvId, draft: current, language: "fr" })).status, 200);
  assert.equal(app.calls(), 1); assert.equal(app.saved.length, 1);
  assert.equal((await (await app.route.GET()).json())[0].version, 2);
});

test("legacy 77-percent records are explicitly excluded from current analysis responses", async () => {
  const app = fixture(); app.saved.push({ id: "legacy", userId: owner, cvId, overallScore: 77, issues: [], strengths: [] });
  const result = await (await app.route.GET()).json();
  assert.equal(result[0].legacy, true); assert.equal(result[0].overallScore, null);
});

test("parallel identical requests share one assessment and one persistence operation", async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const app = fixture({ wait }), body = { cvId, draft: draft() };
  const first = app.post(body), second = app.post(body);
  await new Promise(resolve => setTimeout(resolve, 30)); release();
  const results = await Promise.all([first, second]);
  assert.equal(app.calls(), 1); assert.equal(app.saved.length, 1);
  assert.equal((await results[0].json()).id, (await results[1].json()).id);
});

test("authentication, ownership and bounded inputs are validated before parsing PDFs or invoking AI", async () => {
  const app = fixture();
  assert.equal((await app.post({ cvId: owner, draft: draft(), pdf: "not-base64" })).status, 404);
  assert.equal((await fixture({ authorized: false }).post({ cvId })).status, 401);
  for (const body of [
    { cvId, draft: { ...draft(), contact: { name: 123 } } }, { cvId, keywords: Array(61).fill("React") },
    { cvId, pdf: "not-base64" }, { cvId, jobDescription: "too short" }, { cvId, userId: owner },
  ]) assert.equal((await app.post(body)).status, 400);
  assert.equal(app.calls(), 0); assert.equal(app.saved.length, 0);
});

const originalJobText = "Chief AI Officer at Meta\nLead a team building responsible AI products. Define model governance, monitor production models and develop the company AI strategy.";
function sourceFixture({ content = originalJobText, jobs = [], adapted = null, generated = true, owned = true } = {}) {
  const queries = [], cv = { id: cvId, conversation: { id: owner, content } };
  const db = {
    cv: { findFirst: async input => { queries.push(["cv", input]); return owned && input.where.id === cvId && input.where.conversation.userId === owner ? cv : null; } },
    jobMatch: { findFirst: async input => { queries.push(["match", input]); return adapted; } },
    message: { findMany: async input => { queries.push(["messages", input]); return generated ? [{ content: JSON.stringify({ title: "AI Engineer", skills: [], experiences: [] }) }] : [{ content: "An unrelated conversation response." }]; } },
    jobOpportunity: {
      findFirst: async input => { queries.push(["jobs", input]); return jobs.find(job => job.userId === input.where.userId && input.where.OR.some(filter => Object.entries(filter).every(([key, value]) => job[key] === value))) ?? null; },
      create: async ({ data }) => { const job = { ...data, id: "33333333-3333-4333-8333-333333333333", company: null, location: null, createdAt: new Date(), updatedAt: new Date() }; jobs.push(job); return job; },
    },
  };
  const module = loadSource({ [path.resolve(__dirname, "../prisma/prisma.ts")]: db })("src/lib/career/resume-source-job.ts");
  return { ...module, jobs, queries, db };
}

test("an older generated resume recovers its actual initial posting and registers it once for default selection", async () => {
  const app = sourceFixture();
  const result = await app.resumeSourceJob(owner, cvId);
  assert.equal(result.origin, "GENERATION"); assert.equal(result.job.title, "Chief AI Officer at Meta");
  assert.equal(result.job.description, originalJobText); assert.equal(result.job.originalText, originalJobText);
  assert.equal(app.jobs.length, 1);
  assert.equal((await app.resumeSourceJob(owner, cvId)).job.id, result.job.id); assert.equal(app.jobs.length, 1);
  assert.equal(app.queries.find(([kind]) => kind === "match")[1].where.tailoredCvId, cvId);
  const concurrent = sourceFixture();
  const [first, second] = await Promise.all([concurrent.resumeSourceJob(owner, cvId), concurrent.resumeSourceJob(owner, cvId)]);
  assert.equal(first.job.id, second.job.id); assert.equal(concurrent.jobs.length, 1);
});

test("default selection follows the initial posting rather than a recent comparison or another user's saved job", async () => {
  const origin = { id: owner, userId: owner, title: "Original job", originalText: originalJobText, description: originalJobText };
  const app = sourceFixture({ jobs: [{ ...origin, id: "foreign", userId: "foreign" }, { ...origin, id: "recent", description: "Another posting", originalText: "Another posting" }, origin] });
  assert.equal((await app.resumeSourceJob(owner, cvId)).job.id, origin.id);
  assert.equal(app.jobs.length, 3);
  const adaptedJob = { ...origin, id: "adaptation" };
  const tailored = sourceFixture({ adapted: { job: adaptedJob } });
  const result = await tailored.resumeSourceJob(owner, cvId);
  assert.equal(result.origin, "ADAPTATION"); assert.equal(result.job.id, "adaptation");
  assert.equal(tailored.queries.some(([kind]) => kind === "jobs"), false);
});

test("a resume without a verified generation source gets no default posting; foreign resumes are rejected first", async () => {
  for (const content of ["Resume started from scratch.", "Resume from confirmed career profile.", "Resume imported from LinkedIn (url). Source: https://www.linkedin.com/in/" + "a".repeat(120)]) {
    const app = sourceFixture({ content });
    assert.equal((await app.resumeSourceJob(owner, cvId)).job, null); assert.equal(app.jobs.length, 0);
  }
  const unrelated = sourceFixture({ generated: false });
  assert.equal((await unrelated.resumeSourceJob(owner, cvId)).job, null); assert.equal(unrelated.jobs.length, 0);
  const foreign = sourceFixture({ owned: false });
  await assert.rejects(foreign.resumeSourceJob(owner, cvId), /RESUME_NOT_FOUND/);
  assert.equal(foreign.queries.length, 1);
});

test("the source-context endpoint initializes only the owned CV and returns job metadata", async () => {
  const app = sourceFixture();
  const route = loadSource({
    "@/lib/career/auth-user": { requireUser: async () => ({ id: owner }) },
    "@/lib/career/resume-source-job": { resumeSourceJob: app.resumeSourceJob },
  })("src/app/api/cvs/[id]/ats-context/route.ts");
  const response = await route.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: cvId }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json(); assert.equal(data.job.title, "Chief AI Officer at Meta");
  assert.equal(data.job.description, undefined); assert.equal(data.job.userId, undefined);
  const anonymous = loadSource({ "@/lib/career/auth-user": { requireUser: async () => { throw Object.assign(new Error("Unauthorized"), { status: 401 }); } } })("src/app/api/cvs/[id]/ats-context/route.ts");
  assert.equal((await anonymous.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: cvId }) })).status, 401);
});

test("CV generation saves the initial job posting and never substitutes later editing instructions", async () => {
  const app = sourceFixture(), created = [];
  app.db.conversation = { findUnique: async () => ({ userId: owner, content: originalJobText }) };
  app.db.message.create = async () => ({}); app.db.message.findMany = async () => [];
  app.db.cv.create = async ({ data }) => { created.push(data); return { id: cvId, ...data }; };
  const cv = draft(), output = { cvs: { title: cv.title, summary: cv.summary.join(" "), skills: cv.skills, experiences: cv.experiences, educations: [], certifications: [], projects: [], languages: [] } };
  const route = loadSource({
    [path.resolve(__dirname, "../prisma/prisma.ts")]: app.db,
    "@/lib/auth": { getSessionUser: async () => ({ id: owner }), canAccessUser: (user, userId) => user.id === userId },
    "@/lib/ai/model": { getAIModel: async () => ({}) },
    "@/lib/career-profile/service": { getCareerProfile: async () => ({}), careerProfileContext: profile => profile },
    "@/lib/career-profile/ai": { factualRules: "Only supplied facts.", reserveProfileAI: async () => {} },
    ai: { streamObject: async options => { await options.onFinish({ object: output }); return { toTextStreamResponse: () => new Response("ok") }; } },
  })("src/app/api/generate-cv/route.tsx");
  const response = await route.POST(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: owner, language: "en", description: "Please shorten the summary." }) }));
  assert.equal(response.status, 200); assert.equal(created.length, 1);
  assert.equal(app.jobs.length, 1); assert.equal(app.jobs[0].description, originalJobText);
  assert.doesNotMatch(app.jobs[0].description, /shorten the summary/);
});

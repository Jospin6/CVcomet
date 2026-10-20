// Run against a local development server. All APIs are isolated fixtures.
// A temporary preview route renders the actual editor and is removed afterwards.
const fs = require("node:fs"), path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const load = require("./source-loader.cjs")({});
const { analyzeResume } = load("src/lib/career/ats.ts");
const { inspectAtsPdf } = load("src/lib/career/ats-pdf.ts");
const { atsWorkEvidence, atsClaimedSkills } = load("src/lib/career/ats-text.ts");
const { resumeContentSchema } = load("src/lib/resume-editor.ts");
const { jobAnalysisSchema } = load("src/lib/career/job-schema.ts");
const { matchJob } = load("src/lib/career/job-match.ts");
const { assessAtsJobMatch } = load("src/lib/career/ats-job-match.ts");
const { emptyProfile } = load("src/lib/career-profile/schema.ts");
const base = process.argv[2] || "http://127.0.0.1:3000";
const sourceOnly = process.argv.includes("--source-only");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const id = randomUUID(), userId = randomUUID();
const routeRoot = path.resolve("src/app", "ats-preview-" + randomUUID());
const preview = path.join(routeRoot, "[id]", "page.tsx");
const url = base + "/" + path.basename(routeRoot) + "/" + id;
const output = path.resolve("docs/resume-editor/ats");
let browser, failNext = false, failSaveNext = false, failJobsNext = false, holdNext = false, holdSourceNext = false, unavailableNext = false, release, releaseSource;
const errors = [], requests = [], checks = [];
const jobs = [
  { id: randomUUID(), title: "Chief AI Officer", company: "Meta", description: "Chief AI Officer at Meta. Python is required. Lead a team building responsible AI products and defining model governance for production systems.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: randomUUID(), title: "Frontend Developer", company: "Northwind", description: "Frontend Developer at Northwind. React is required. Build accessible web interfaces and work with support teams to improve customer-facing tools.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];
let cv = { id, revision: 0, ...resumeContentSchema.parse({
  contact: { name: "Camille Exemple", email: "camille@example.test" },
  summary: ["Création d’interfaces accessibles avec React."],
  experiences: [{ title: "Développeuse", company: "Example Studio", end: "En cours", description: ["Création d’interfaces web accessibles."] }],
  certifications: [{ title: "Accessibilité web", issuer: "Organisme de formation", date: "2021", description: "Pratique des interfaces accessibles et de la navigation clavier." }],
  languages: [{ language: "Français", level: "Courant" }],
  design: { hiddenSections: ["summary"] },
}) };
const user = { id: userId, name: "Camille Exemple", email: "camille@example.test", emailVerified: true, role: "USER", isSubscribed: false };
async function focused(page, field) { await page.waitForFunction(value => document.activeElement?.dataset.field === value, field); }
async function edit(page, field, value) { await page.locator(`[data-resume-page] [data-field="${field}"]`).first().fill(value); }
async function fresh(page) { await page.locator('.studio-ats-panel[aria-busy="false"]').waitFor(); await page.locator(".studio-ats-freshness:not(.is-stale)").waitFor(); }
async function refresh(page) { await page.locator(".studio-ats-panel > button").click(); await fresh(page); }
function semantic(resume) {
  const work = atsWorkEvidence(resume);
  const description = work[0];
  return { status: "COMPLETE", skillEvidence: atsClaimedSkills(resume).map(skill => ({ skill: skill.term, status: "UNSUPPORTED", evidence: [] })), contributions: work.map(item => ({ field: item.field, actionQuote: item.quote, methodQuote: "", outcomeQuote: "", outcomeType: "NOT_STATED" })), criteria: [
    { id: "specificity", rating: 1, reason: "La description indique une tâche mais ne précise pas la méthode ni le résultat.", evidence: description ? [description] : [] },
    { id: "positioning", rating: 1, reason: "Le titre doit être appuyé par des contributions plus précises.", evidence: description ? [{ field: "title", quote: resume.title }, description] : [] },
    { id: "writing", rating: 2, reason: "Les phrases restent succinctes et peuvent être précisées.", evidence: description ? [description] : [] },
  ], issues: description?.quote === "Création d’interfaces web accessibles." ? [{ id: "semantic-rewrite", category: "CONTENT", severity: "warning", title: "Clarifiez cette formulation", reason: "Cette formulation peut être rendue plus précise sans ajouter de faits.", suggestion: "Relisez la proposition avant de l’insérer dans votre document.", field: description.field, evidence: [description], proposedText: "Développement d’interfaces web accessibles." }] : [] };
}
async function main() {
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  fs.writeFileSync(preview, '"use client";\nimport { useEffect, useState } from "react";\nimport { ResumeEditor } from "@/components/resumes/resume-editor";\nexport default function Preview() { const [revision, setRevision] = useState(0); useEffect(() => { const reset = () => setRevision(value => value + 1); window.addEventListener("ats-test-remount", reset); return () => window.removeEventListener("ats-test-remount", reset); }, []); return <ResumeEditor key={revision} />; }\n');
  fs.mkdirSync(output, { recursive: true });
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: "fr-FR" });
  await context.addCookies([{ name: "i18next", value: "fr", url: base }]);
  await context.addInitScript(() => { localStorage.setItem("i18nextLng", "fr"); localStorage.setItem("theme", "light"); });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/api/**", async route => {
    const endpoint = new URL(route.request().url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (endpoint === "/api/auth/get-session") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return json({ user, session: { id: "fixture", userId, token: "fixture", expiresAt: "2099-01-01T00:00:00.000Z" } });
    }
    if (endpoint === "/api/me" || endpoint === `/api/users/${userId}`) return json(user);
    if (endpoint === `/api/cvs/${id}`) {
      if (route.request().method() === "PATCH") cv = { ...cv, ...route.request().postDataJSON(), revision: cv.revision + 1 };
      return json(cv);
    }
    if (endpoint === `/api/cvs/${id}/ats-context`) {
      if (holdSourceNext) { holdSourceNext = false; await new Promise(resolve => { releaseSource = resolve; }); }
      return json({ job: jobs[0], origin: "GENERATION" });
    }
    if (endpoint === "/api/job-opportunities") {
      if (route.request().method() === "POST") {
        if (failSaveNext) { failSaveNext = false; return json({ error: "TEST_FAILURE" }, 503); }
        const job = { ...route.request().postDataJSON(), id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        jobs.push(job); return json(job, 201);
      }
      if (failJobsNext) { failJobsNext = false; return json({ error: "TEST_FAILURE" }, 503); }
      const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() || "";
      return json({ items: jobs.filter(job => `${job.title} ${job.company}`.toLowerCase().includes(query)), nextCursor: null });
    }
    if (endpoint === "/api/ats") {
      const body = route.request().postDataJSON(); requests.push(body);
      if (failNext) { failNext = false; return json({ error: "TEST_FAILURE" }, 503); }
      if (holdNext) { holdNext = false; await new Promise(resolve => { release = resolve; }); }
      const document = await inspectAtsPdf(Buffer.from(body.pdf, "base64"), body.draft, body.language);
      const review = unavailableNext ? undefined : semantic(body.draft); unavailableNext = false;
      const targetJob = jobs.find(job => job.id === body.jobId);
      const term = targetJob?.description.includes("Python is required.") ? "Python" : "React";
      const jobAnalysis = targetJob ? jobAnalysisSchema.parse({ title: targetJob.title, requirements: [{ id: "skill", title: term, category: "TECHNICAL", priority: "REQUIRED", evidence: `${term} is required.`, terms: [term] }] }) : null;
      const jobMatch = targetJob ? assessAtsJobMatch(body.draft, matchJob(emptyProfile(), jobAnalysis, body.draft)) : undefined;
      const report = analyzeResume(body.draft, body.keywords, body.language, { document, semantic: review, jobMatch });
      if (targetJob) report.targetJob = { id: targetJob.id, title: targetJob.title, company: targetJob.company, updatedAt: targetJob.updatedAt };
      return json({ id: randomUUID(), ...report });
    }
    return json([]);
  });
  await context.route("https://www.googletagmanager.com/**", route => route.abort());
  console.log("Opening the actual editor with isolated APIs and real PDF inspection.");
  // Wait for Next's route watcher before navigating to a newly created route.
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      await response.body?.cancel();
      if (response.ok) break;
    } catch (error) { if (attempt === 7) throw error; }
    if (attempt === 7) throw Error("Temporary preview route did not become available");
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    if (response?.ok()) break;
    if (attempt === 7) throw Error("Temporary preview navigation did not become available");
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await page.locator('[data-resume-page] [data-field="title"]').first().waitFor({ timeout: 120000 });
  await edit(page, "title", "Développeuse frontend");
  const open = () => page.locator('.studio-header-actions button[aria-controls="studio-panel-ats"]').click();
  await open();
  await page.getByRole("option", { name: "Chief AI Officer chez Meta", exact: true }).waitFor({ state: "attached" });
  await page.getByText("L’offre utilisée pour créer ce CV est présélectionnée. Vous pouvez en choisir une autre.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("combobox", { name: "Offre enregistrée", exact: true }).inputValue(), jobs[0].id);
  assert.equal(requests.length, 0, "Opening the checker allows choosing a job before any paid analysis");
  await refresh(page);
  assert.equal(requests[0].jobId, jobs[0].id, "The generation source is the initial assessment target");
  await page.screenshot({ path: path.join(output, "source-default.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Offre enregistrée", exact: true }).selectOption(jobs[1].id);
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await open();
  assert.equal(await page.getByRole("combobox", { name: "Offre enregistrée", exact: true }).inputValue(), jobs[1].id, "Reopening the checker preserves an explicit change");
  checks.push("The job used to generate the resume is preselected; an explicit change remains selected when reopening the checker.");
  for (const choice of [jobs[1].id, ""]) {
    holdSourceNext = true; releaseSource = undefined;
    // Remount only the actual editor, preserving the isolated authenticated
    // app shell instead of introducing a second authentication scenario.
    await page.evaluate(() => window.dispatchEvent(new Event("ats-test-remount")));
    await page.locator('[data-resume-page] [data-field="title"]').first().waitFor();
    await open();
    await page.getByRole("option", { name: "Frontend Developer chez Northwind", exact: true }).waitFor({ state: "attached" });
    await page.getByText("Recherche de l’offre à l’origine de ce CV…", { exact: true }).waitFor();
    const choiceInput = page.getByRole("combobox", { name: "Offre enregistrée", exact: true });
    await choiceInput.selectOption(jobs[1].id);
    if (!choice) await choiceInput.selectOption("");
    assert.equal(typeof releaseSource, "function"); releaseSource();
    await page.getByText("Recherche de l’offre à l’origine de ce CV…", { exact: true }).waitFor({ state: "detached" });
    assert.equal(await choiceInput.inputValue(), choice, "A late origin response never overwrites an explicit choice, including general assessment");
  }
  checks.push("A delayed generation-source lookup preserves both an explicit alternative job and an explicit general assessment.");
  if (sourceOnly) {
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "source-verification.json"), JSON.stringify({ checks, runtimeErrors: errors, api: "Isolated fixtures using the actual editor; no database or AI requests." }, null, 2) + "\n");
    console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2));
    return;
  }
  await page.getByRole("combobox", { name: "Offre enregistrée", exact: true }).selectOption("");
  await refresh(page);
  assert.equal(requests[0].cvId, id);
  assert.equal(requests[0].draft.title, "Développeuse frontend");
  assert.equal(requests[0].language, "fr");
  assert.equal(page.url(), url);
  await page.locator('[data-ats-score="technical"]').waitFor();
  assert.ok(requests[0].pdf.startsWith("JVBER"), "The actual PDF bytes are included");
  assert.ok(await page.locator('[data-ats-score="job"]').innerText().then(value => value.includes("Offre requise")));
  assert.equal(await page.locator('[role="meter"]').count(), 0, "No universal ATS percentage is shown");
  checks.push("French ATS button analyzes the current draft inside the actual editor.");

  const searchJobs = page.getByRole("searchbox", { name: "Rechercher une offre", exact: true });
  const selectJob = page.getByRole("combobox", { name: "Offre enregistrée", exact: true });
  await page.getByRole("option", { name: "Chief AI Officer chez Meta", exact: true }).waitFor({ state: "attached" });
  await searchJobs.fill("Meta");
  await page.getByRole("option", { name: "Frontend Developer chez Northwind", exact: true }).waitFor({ state: "detached" });
  const count = requests.length;
  await selectJob.selectOption(jobs[0].id);
  await page.locator(".studio-ats-freshness.is-stale").waitFor();
  assert.equal(requests.length, count, "Changing the target does not silently start a paid analysis");
  await refresh(page);
  assert.equal(requests.at(-1).jobId, jobs[0].id); assert.equal(requests.at(-1).jobDescription, undefined);
  assert.equal(requests.at(-1).pdf, requests[0].pdf, "Choosing an offer reuses the same PDF bytes");
  assert.ok((await page.locator(".studio-ats-target").innerText()).includes("Chief AI Officer chez Meta"));
  assert.ok((await page.locator('[data-ats-score="job"]').innerText()).includes("/100"));
  await searchJobs.fill("");
  await page.getByRole("option", { name: "Frontend Developer chez Northwind", exact: true }).waitFor({ state: "attached" });
  await selectJob.selectOption(jobs[1].id); await refresh(page);
  assert.equal(requests.at(-1).jobId, jobs[1].id);
  failJobsNext = true; await searchJobs.fill("Meta");
  await page.getByText("Impossible de charger vos offres.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await page.getByText("Impossible de charger vos offres.", { exact: true }).waitFor({ state: "detached" });
  assert.equal(await selectJob.inputValue(), jobs[1].id, "Searching preserves the selected offer");
  await searchJobs.fill("An unknown employer");
  await page.getByText("Aucune offre ne correspond à cette recherche.", { exact: true }).waitFor();
  await searchJobs.fill("");
  checks.push("Saved offers are searchable by role/company, selecting one marks the result stale, the exact target is sent by ID, and list failures can be retried.");

  await page.locator(".studio-ats-new-job summary").click();
  const saveJob = page.getByRole("button", { name: "Enregistrer et sélectionner", exact: true });
  assert.ok(await saveJob.isDisabled());
  await page.getByRole("textbox", { name: "Intitulé de l’offre", exact: true }).fill("AI Engineer");
  await page.getByRole("textbox", { name: "Entreprise (facultatif)", exact: true }).fill("Example AI");
  await page.getByRole("textbox", { name: "Texte complet de l’offre", exact: true }).fill(jobs[0].description);
  failSaveNext = true; await saveJob.click();
  await page.getByText("L’enregistrement a échoué. Votre saisie est conservée ; réessayez.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Intitulé de l’offre", exact: true }).inputValue(), "AI Engineer");
  await saveJob.click();
  await page.getByText("Offre enregistrée et sélectionnée. Lancez le diagnostic pour la comparer à ce CV.", { exact: true }).waitFor();
  assert.equal(await selectJob.inputValue(), jobs.at(-1).id);
  await refresh(page); assert.equal(requests.at(-1).jobId, jobs.at(-1).id);
  await selectJob.selectOption(""); await refresh(page);
  assert.ok((await page.locator('[data-ats-score="job"]').innerText()).includes("Offre requise"));
  checks.push("A new job requires a recognizable title, survives a failed save, is saved and selected for reuse, and general assessment remains available without a job.");

  await page.locator(".studio-ats-issue").filter({ hasText: "Présentez votre profil" }).getByRole("button").click();
  await focused(page, "summary.0");
  assert.ok(await page.locator('[data-resume-page] [data-field="summary.0"]').first().textContent());
  await page.locator(".studio-ats-freshness.is-stale").waitFor();
  await refresh(page);
  assert.equal(await page.locator(".studio-ats-issue").filter({ hasText: "Présentez votre profil" }).count(), 0);
  await page.locator(".studio-ats-issue").filter({ hasText: "Détaillez vos compétences" }).getByRole("button").click();
  await focused(page, "skills.0.hardskills");
  await edit(page, "skills.0.hardskills", "React, TypeScript, CSS, HTML, Git, SQL");
  await refresh(page);
  assert.equal(await page.locator(".studio-ats-issue").filter({ hasText: "Détaillez vos compétences" }).count(), 0);
  checks.push("Recommendations reveal hidden content, create empty sections and focus editable fields; refreshing removes resolved issues.");

  await page.getByRole("button", { name: "Relire la reformulation", exact: true }).click();
  await page.getByRole("textbox", { name: "Proposition IA" }).waitFor();
  assert.equal(await page.locator('[data-resume-page] [data-field="experiences.0.description"]').first().innerText(), "Création d’interfaces web accessibles.");
  await page.getByRole("button", { name: "Insérer dans mon CV", exact: true }).click();
  assert.equal(await page.locator('[data-resume-page] [data-field="experiences.0.description"]').first().innerText(), "Développement d’interfaces web accessibles.");
  await open(); await refresh(page);
  unavailableNext = true; await refresh(page);
  assert.ok((await page.locator('[data-ats-score="content"]').innerText()).includes("—"));
  assert.ok(!(await page.locator('[data-ats-score="technical"]').innerText()).includes("—"));
  await refresh(page);
  checks.push("Rewrites require explicit acceptance, and failed contextual review leaves the content score unknown while retaining PDF diagnostics.");

  await page.locator(".studio-ats-keywords summary").click();
  await page.locator(".studio-ats-keywords textarea").fill("Docker"); await refresh(page);
  assert.ok(await page.locator(".studio-ats-issue").filter({ hasText: "Docker" }).count());
  await page.locator(".studio-ats-keywords textarea").fill("x".repeat(101));
  assert.ok(await page.locator(".studio-ats-panel > button").isDisabled());
  await page.locator(".studio-ats-keywords textarea").fill("");
  failNext = true; await page.locator(".studio-ats-panel > button").click();
  await page.locator(".studio-ats-panel [role=alert]").waitFor();
  await refresh(page);
  assert.equal(await page.locator(".studio-ats-panel [role=alert]").count(), 0);
  await page.locator(".studio-ats-keywords summary").click();
  checks.push("Optional keywords, limits and retry after a failed analysis work without losing the draft.");

  holdNext = true;
  const pending = page.waitForRequest(request => new URL(request.url()).pathname === "/api/ats");
  await page.locator(".studio-ats-panel > button").click(); await pending;
  await edit(page, "title", "Développeuse frontend senior");
  release();
  await page.locator('.studio-ats-panel[aria-busy="false"]').waitFor();
  await page.locator(".studio-ats-freshness.is-stale").waitFor();
  await refresh(page);
  checks.push("Edits made while an analysis is running mark its eventual result as outdated.");
  await page.locator(".studio-ats-issue").filter({ hasText: "Envisagez une seule colonne" }).getByRole("button").click();
  await page.waitForFunction(() => document.activeElement?.classList.contains("studio-template"));
  await page.locator(".studio-template").nth(1).click();
  await open(); await refresh(page);
  assert.equal(await page.locator(".studio-ats-issue").filter({ hasText: "Envisagez une seule colonne" }).count(), 0);
  await page.evaluate(() => { document.querySelector(".studio-panel").scrollTop = 0; window.scrollTo(0, 0); });
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  checks.push("Layout recommendations focus the design settings and reflect the selected layout.");

  await page.setViewportSize({ width: 375, height: 900 });
  await open();
  await page.locator(".studio-inspector.is-open").waitFor();
  await page.evaluate(() => { document.querySelector(".studio-panel").scrollTop = 0; window.scrollTo(0, 0); });
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.locator(".studio-ats-issue").filter({ hasText: "Vérifiez les dates de cette entrée" }).getByRole("button").click();
  await focused(page, "experiences.0.start");
  assert.equal(await page.locator(".studio-inspector.is-open").count(), 0);
  await edit(page, "experiences.0.start", "2022");
  await open(); await refresh(page);
  assert.equal(await page.locator(".studio-ats-issue").filter({ hasText: "Vérifiez les dates de cette entrée" }).count(), 0);
  checks.push("At 375px the ATS panel fits the screen, closes on correction and returns focus to the document.");
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ checks, runtimeErrors: errors, api: "Isolated fixtures using the real analyzer; no database or AI requests." }, null, 2) + "\n");
  console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2));
}

main().catch(async error => {
  console.error(error); process.exitCode = 1;
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    console.error((await page.locator("main").innerText().catch(() => "")).slice(0, 1200));
  }
}).finally(async () => {
  release?.();
  releaseSource?.();
  await browser?.close();
  assert.ok(routeRoot.startsWith(path.resolve("src/app") + path.sep) && path.basename(routeRoot).startsWith("ats-preview-"));
  if (fs.existsSync(preview)) fs.unlinkSync(preview);
  if (fs.existsSync(path.dirname(preview))) fs.rmdirSync(path.dirname(preview));
  if (fs.existsSync(routeRoot)) fs.rmdirSync(routeRoot);
  const typesBase = path.resolve(".next-dev/types/app");
  const generatedRoot = path.join(typesBase, path.basename(routeRoot));
  assert.ok(generatedRoot.startsWith(typesBase + path.sep));
  const generatedPage = path.join(generatedRoot, "[id]", "page.ts");
  if (fs.existsSync(generatedPage)) fs.unlinkSync(generatedPage);
  if (fs.existsSync(path.dirname(generatedPage))) fs.rmdirSync(path.dirname(generatedPage));
  if (fs.existsSync(generatedRoot)) fs.rmdirSync(generatedRoot);
});

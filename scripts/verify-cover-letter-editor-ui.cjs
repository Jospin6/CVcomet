// Isolated browser checks: real components/styles, synthetic data and mocked HTTP.
// No account, database, AI provider or external network is used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { build } = require("esbuild");
const { chromium } = require("playwright");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cvcomet-letter-ui-"));
let server, browser;
const checks = [];
const letter = {
  id: "letter-1", revision: 0, cv: { id: "resume-1", title: "Developer" }, job: null,
  senderName: "Sam Example", senderEmail: "sam@example.test", senderPhone: "", senderAddress: "Paris", sendertitle: "Developer",
  recipientName: "Hiring team", recipientTitle: "", companyName: "Example", companyAddress: "Paris",
  positionTitle: "Application: Developer", introduction: "Dear hiring team,", body: "I build accessible web applications.", conclusion: "Thank you for your consideration.",
  design: { accent: "#173F35", font: "sans", fontSize: 13, lineHeight: 1.6, padding: 60, alignment: "left", headerStyle: "accent", fieldStyles: {} },
};
const linked = [{ id: "letter-1", positionTitle: letter.positionTitle, companyName: letter.companyName }];
const resume = { id: "resume-1", title: "Developer", revision: 0, createdAt: "2026-01-01", contact: { name: "Sam Example", email: "sam@example.test" }, summary: ["I build accessible web applications."], experiences: [], educations: [], skills: [], projects: [], languages: [], certifications: [], design: { documentName: "My resume" }, coverLetters: linked };

async function main() {
  const result = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import i18n from 'i18next'; import {initReactI18next} from 'react-i18next';
      import {CoverLetterEditor} from './src/components/resumes/cover-letter-editor';
      import {ResumeEditor} from './src/components/resumes/resume-editor';
      import {ResumeCards} from './src/components/resumes/resume-library';
      import {LinkedCoverLetters} from './src/components/resumes/linked-cover-letters';
      i18n.use(initReactI18next).init({lng:'fr',resources:{fr:{translation:{}}},initImmediate:false});
      const mode=new URLSearchParams(location.search).get('mode');
      createRoot(document.getElementById('root')).render(mode==='resume'?<ResumeEditor/>:mode==='library'?<ResumeCards documents={[{...window.fixture,source:'created'}]}/>:mode==='links'?<LinkedCoverLetters letters={window.fixture.coverLetters}/>:<CoverLetterEditor/>);`, resolveDir: root, loader: "tsx" },
    bundle: true, write: false, outdir: temp, platform: "browser", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "isolated-navigation", setup(builder) {
      builder.onResolve({ filter: /^(next\/navigation|next\/link|@\/hooks\/useCurrentUser)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "tsx", resolveDir: root, contents: args.path === "next/link" ? `import React from 'react'; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}` : args.path === "next/navigation" ? `export const useParams=()=>({id:new URLSearchParams(location.search).get('mode')==='resume'?'resume-1':'letter-1'}); export const useRouter=()=>({push:url=>location.assign(url)});` : `const user={id:'test-user',name:'Sam Example',email:'sam@example.test'}; export const useCurrentUser=()=>({user,loading:false});` }));
    } }],
  });
  const assets = Object.fromEntries(result.outputFiles.map(file => [path.basename(file.path), file.contents]));
  const globals = await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8"), { from: path.join(root, "src/app/globals.css") });
  assets["globals.css"] = Buffer.from(globals.css);
  server = http.createServer((req, res) => {
    const name = new URL(req.url, "http://localhost").pathname.slice(1);
    if (assets[name]) { res.setHeader("Content-Type", name.endsWith("css") ? "text/css" : "text/javascript"); return res.end(assets[name]); }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/stdin.css"></head><body style="padding:24px"><div id="root"></div><script type="module" src="/stdin.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  page.setDefaultTimeout(20000);
  const errors = [], requests = [];
  let stored = structuredClone(letter), delaySave = false, rejectSave = false;
  page.on("pageerror", error => { errors.push(error.message); console.error("Browser:", error.message); });
  await page.addInitScript(value => { window.fixture = value; }, resume);
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.endsWith("/assistant")) {
      const body = req.postDataJSON(); assert.equal(body.revision, stored.revision);
      stored = { ...stored, body: "Updated by the assistant.", revision: stored.revision + 1 };
      return route.fulfill({ json: { document: stored, revision: stored.revision, message: "Modification appliquée.", changes: ["Texte modifié"] } });
    }
    if (url.pathname === "/api/cover-letters/letter-1") {
      if (req.method() === "PATCH") {
        const body = req.postDataJSON(); requests.push(body);
        if (delaySave) { delaySave = false; await new Promise(resolve => setTimeout(resolve, 700)); }
        if (rejectSave) { rejectSave = false; return route.fulfill({ status: 500, json: { error: "SAVE" } }); }
        assert.equal(body.revision, stored.revision);
        stored = { ...stored, ...body, revision: stored.revision + 1 };
      }
      return route.fulfill({ json: stored });
    }
    if (url.pathname === "/api/cvs/resume-1") return route.fulfill({ json: resume });
    return route.fulfill({ json: [] });
  });
  const open = async mode => { await page.goto(`${base}/?mode=${mode}`); await page.locator(mode === "library" ? "article" : mode === "links" ? "#root" : ".studio-workspace").waitFor(); };
  const dimensions = () => page.evaluate(() => Object.fromEntries([".studio-toolbar", ".studio-workspace", ".studio-inspector", ".studio-inspector-tabs", ".studio-panel", ".studio-canvas-viewport"].map(selector => { const style = getComputedStyle(document.querySelector(selector)); return [selector, [style.display, style.width, style.padding, style.borderRadius, style.backgroundColor, style.gridTemplateColumns]]; })));
  await open("resume");
  assert.equal(await page.getByRole("link", { name: "Lettre de motivation", exact: true }).getAttribute("href"), "/dashboard/cover-letters/letter-1");
  const resumeDimensions = await dimensions();
  await open("letter");
  assert.deepEqual(await dimensions(), resumeDimensions);
  checks.push("Identical desktop workspace, inspector, tabs, toolbar and canvas styles; existing-letter button");
  console.log(checks.at(-1));
  const body = page.locator('[data-field="body"]');
  await body.fill("First saved edit.");
  await page.waitForFunction(() => document.querySelector(".studio-save-status").textContent.includes("enregistrées"));
  assert.equal(stored.body, "First saved edit.");
  await page.getByRole("button", { name: "Gras", exact: true }).click();
  assert.equal(await body.evaluate(el => getComputedStyle(el).fontWeight), "700");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  assert.equal(await body.evaluate(el => getComputedStyle(el).fontWeight), "400");
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await page.getByRole("button", { name: "Aperçu", exact: true }).click();
  assert.equal(await body.getAttribute("contenteditable"), "false");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  checks.push("Inline edit/autosave, formatting, undo/redo and preview");
  console.log(checks.at(-1));
  delaySave = true;
  await body.fill("Save in flight.");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await body.fill("Latest keystrokes retained.");
  await page.waitForFunction(() => document.querySelector(".studio-save-status").textContent.includes("enregistrées"));
  assert.equal(stored.body, "Latest keystrokes retained.");
  rejectSave = true;
  await body.fill("Retry this edit.");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await body.innerText(), "Retry this edit.");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".studio-save-status").textContent.includes("enregistrées"));
  checks.push("Slow saves preserve later edits; failed saves retain text and retry");
  console.log(checks.at(-1));
  await page.getByRole("tab", { name: "Assistant IA" }).click();
  await page.getByRole("textbox", { name: "Instruction pour l’assistant" }).fill("Raccourcis le texte");
  await page.getByRole("button", { name: "Appliquer les modifications" }).click();
  await page.waitForFunction(() => document.querySelector('[data-field="body"]').textContent === "Updated by the assistant.");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  assert.equal(await body.innerText(), "Retry this edit.");
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await page.getByRole("tab", { name: "Offre associée" }).click();
  assert.ok(await page.getByText("Aucune offre associée.").isVisible());
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le PDF" }).click();
  const download = await downloadPromise;
  const pdfPath = await download.path();
  assert.equal(fs.readFileSync(pdfPath).subarray(0, 5).toString(), "%PDF-");
  checks.push("Assistant uses latest revision, AI edits undo/redo, nullable job, PDF download");
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page.screenshot({ path: path.join(temp, "letter-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".studio-inspector").isVisible(), false);
  await page.getByRole("button", { name: "Ouvrir les outils" }).click();
  assert.equal(await page.locator(".studio-inspector").isVisible(), true);
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(temp, "letter-mobile.png"), fullPage: true });
  checks.push("Mobile tools open/close without horizontal page overflow");
  await open("library");
  assert.equal(await page.getByRole("link", { name: "Lettre de motivation", exact: true }).getAttribute("href"), "/dashboard/cover-letters/letter-1");
  await page.addInitScript(() => { window.fixture.coverLetters = []; });
  await open("links");
  assert.equal(await page.getByRole("link").count(), 0);
  await page.addInitScript(() => { window.fixture.coverLetters = [{ id: "first", positionTitle: "Developer", companyName: "A" }, { id: "second", positionTitle: "Designer", companyName: "B" }]; });
  await open("links");
  await page.getByRole("button", { name: /Lettre de motivation/ }).click();
  assert.equal(await page.getByRole("menuitem", { name: "Designer · B" }).getAttribute("href"), "/dashboard/cover-letters/second");
  checks.push("Library link, no-letter state, multiple-letter chooser");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, saves: requests.length, screenshots: temp }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

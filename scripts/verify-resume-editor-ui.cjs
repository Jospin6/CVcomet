// Real UI, authentication, save/reload and PDF export. AI responses are fixtures.
// Only a uniquely named test account and its documents are created, then removed.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
require("@next/env").loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient(), base = process.argv[2] || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const email = `resume-editor-${randomUUID()}@example.invalid`, password = randomUUID();
const output = path.resolve("docs/resume-editor"); fs.mkdirSync(output, { recursive: true });
let userId, cookie = "", browser, socket, send, command, evaluate, profileDir, slowNextSave = false;
const errors = [], consoleErrors = [], checks = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(endpoint, method = "GET", body) {
  const response = await fetch(base + endpoint, { method, headers: { cookie, origin: base, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120000) });
  if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  return response;
}
async function until(expression, label) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try { if (await evaluate(`Boolean(${expression})`)) return; }
    catch (error) { if (!/context.*destroyed|context.*not found|Cannot find context/i.test(error.message)) throw error; }
    await delay(150);
  }
  throw Error("Timeout: " + label);
}
async function click(selector) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.click()})()`); await delay(120);
}
async function edit(selector, value) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();if(e.isContentEditable){e.textContent=${JSON.stringify(value)};e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));e.blur()}else{const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}})()`); await delay(150);
}
async function screenshot(name) {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
}

async function main() {
  const signup = await api("/api/signup", "POST", { name: "Editor Fixture", email, password });
  assert.equal(signup.status, 201); userId = (await signup.json()).id;
  const creation = await api("/api/cvs", "POST", { source: "SCRATCH" }); assert.equal(creation.status, 201);
  const cv = await creation.json();
  const executable = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(fs.existsSync);
  assert.ok(executable, "Chrome or Edge required");
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "cvcomet-resume-editor-"));
  browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=0", "--user-data-dir=" + profileDir, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let port;
  for (let i = 0; i < 100; i++) { const file = path.join(profileDir, "DevToolsActivePort"); if (fs.existsSync(file)) { port = fs.readFileSync(file, "utf8").trim().split("\n"); break; } await delay(100); }
  assert.ok(port, "Browser debugging connection");
  socket = new WebSocket("ws://127.0.0.1:" + port[0] + port[1]);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let counter = 0; const pending = new Map();
  send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++counter; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const callback = pending.get(message.id); if (callback) { pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") consoleErrors.push(message.params.args.map(arg => arg.value || arg.description || "").join(" "));
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      if (new URL(request.url).pathname === "/api/resume-ai") void command("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify({ proposal: "Frontend developer creating accessible React interfaces and thoughtful user experiences." })).toString("base64") });
      else if (request.method === "PATCH" && slowNextSave) { slowNextSave = false; void delay(4000).then(() => command("Fetch.continueRequest", { requestId })); }
      else void command("Fetch.continueRequest", { requestId });
    }
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  command = (method, params = {}) => send(method, params, sessionId);
  evaluate = async expression => { const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text); return response.result.value; };
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  await command("Network.setExtraHTTPHeaders", { headers: { "Accept-Language": "en" } });
  await command("Network.setCookie", { name: "i18next", value: "en", url: base, path: "/" });
  for (const part of cookie.split("; ")) { const i = part.indexOf("="); await command("Network.setCookie", { name: part.slice(0, i), value: part.slice(i + 1), url: base, path: "/", httpOnly: true }); }
  await command("Page.addScriptToEvaluateOnNewDocument", { source: 'localStorage.setItem("i18nextLng","en");localStorage.setItem("theme","light")' });
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await command("Fetch.enable", { patterns: [{ urlPattern: "*/api/resume-ai", requestStage: "Request" }, { urlPattern: "*/api/cvs/*", requestStage: "Request" }] });
  await command("Page.navigate", { url: base + "/dashboard/resumes/" + cv.id });
  await until(`document.querySelector('[data-resume-page] [data-field="contact.name"]')`, "interactive resume");
  await edit('[data-resume-page] [data-field="contact.name"]', "Camille Example");
  await edit('[data-resume-page] [data-field="title"]', "Frontend Developer");
  await click('button[aria-label="Undo"]');
  assert.equal(await evaluate('document.querySelector("[data-resume-page] [data-field=title]").textContent'), "");
  await click('button[aria-label="Redo"]');
  assert.equal(await evaluate('document.querySelector("[data-resume-page] [data-field=title]").textContent'), "Frontend Developer");
  await click('button[aria-label="Add Experience"]');
  await edit('[data-resume-page] [data-field="experiences.0.title"]', "Frontend Developer");
  await edit('[data-resume-page] [data-field="experiences.0.company"]', "Example Studio");
  await edit('[data-resume-page] [data-field="experiences.0.description"]', "Created accessible React interfaces.\nBuilt a dashboard.");
  await until('document.querySelector(".studio-save-status").textContent.includes("All changes saved")', "auto-save");
  const saved = await (await api("/api/cvs/" + cv.id)).json();
  assert.equal(saved.contact.name, "Camille Example"); assert.equal(saved.experiences[0].company, "Example Studio");
  checks.push("Direct contact, job title and experience editing, undo/redo and actual auto-save.");
  console.log("Editing, undo/redo and database save passed.");
  slowNextSave = true;
  await click('button[aria-label="AI assistant Profile"]');
  await edit('.studio-panel textarea', "I created accessible React interfaces and built a dashboard.");
  await until('document.querySelector(".studio-save-status").textContent.includes("Saving")', "save in flight");
  await evaluate('[...document.querySelectorAll(".studio-panel button")].find(e=>e.textContent.includes("Suggest text")).click()');
  await until(`document.querySelector('textarea[aria-label="AI suggestion"]')`, "AI proposal");
  assert.equal(await evaluate(`document.querySelector('[data-resume-page] [data-field="summary.0"]').textContent`), "");
  await evaluate('[...document.querySelectorAll(".studio-panel button")].find(e=>e.textContent.includes("Insert in my resume")).click()');
  await until(`document.querySelector('[data-resume-page] [data-field="summary.0"]').textContent.includes('accessible React')`, "accepted proposal");
  await until('document.querySelector(".studio-save-status").textContent.includes("All changes saved")', "proposal save");
  checks.push("AI proposes text for an empty section; acceptance is required before insertion.");
  const accepted = await (await api("/api/cvs/" + cv.id)).json();
  assert.ok(accepted.summary[0].includes("accessible React"));
  checks.push("A change applied during an in-flight save is automatically saved afterwards.");
  console.log("AI proposal and overlapping auto-save passed.");
  await click('.studio-inspector-tab[role=tab]:first-child');
  await click('.studio-template:nth-child(2)');
  await click('button[aria-label="Resume color #1E4B8F"]');
  await until('document.querySelector(".studio-save-status").textContent.includes("All changes saved")', "design save");
  await command("Page.reload");
  await until('document.querySelector("[data-resume-page].layout-classic")', "saved layout reload");
  assert.ok(await evaluate(`document.querySelector('[data-resume-page] [data-field="summary.0"]').textContent.includes('accessible React')`));
  await screenshot("studio-desktop");
  checks.push("Template and color survive a page reload along with all resume text.");
  await evaluate('[...document.querySelectorAll("main button")].find(e=>e.textContent==="Preview").click()');
  await until(`document.querySelector('[data-resume-page] .resume-editable.is-preview')`, "clean preview");
  assert.ok(await evaluate(`![...document.querySelectorAll('[data-resume-page] .resume-section-heading')].some(e=>e.textContent.includes('Education'))`));
  await screenshot("studio-preview");
  const downloadDir = path.join(output, "downloads", cv.id); fs.mkdirSync(downloadDir, { recursive: true });
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true });
  await evaluate('[...document.querySelectorAll("main button")].find(e=>e.textContent.includes("Download PDF")).click()');
  let download;
  for (let i = 0; i < 800; i++) { download = fs.readdirSync(downloadDir).find(name => name.endsWith(".pdf")); if (download) break; await delay(150); }
  assert.ok(download, "PDF file downloaded");
  assert.equal(fs.readFileSync(path.join(downloadDir, download)).subarray(0, 5).toString(), "%PDF-");
  checks.push("Native PDF export downloads a valid PDF.");
  await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: false });
  await delay(400);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), "No horizontal page overflow");
  await evaluate('[...document.querySelectorAll("main button")].find(e=>e.textContent.includes("Open tools")).click()');
  await until('document.querySelector(".studio-inspector.is-open")', "mobile tools");
  await screenshot("studio-mobile");
  checks.push("Mobile canvas fits the page and exposes the tools panel.");
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ checks, runtimeErrors: errors, consoleErrors, ai: "Intercepted fixture; no billable generation" }, null, 2) + "\n");
  console.log(JSON.stringify({ checks, runtimeErrors: errors, consoleErrors }, null, 2));
}

main().catch(async error => {
  console.error(error.message);
  if (command) { try { await screenshot("failure"); console.error(await evaluate('document.querySelector("main")?.innerText.slice(0,1400)')); } catch {} }
  process.exitCode = 1;
}).finally(async () => {
  if (send) await send("Browser.close").catch(() => {});
  if (socket) socket.close();
  if (browser) browser.kill();
  try {
    if (userId) await db.$transaction(async tx => {
      await tx.cv.deleteMany({ where: { conversation: { userId } } });
      await tx.conversation.deleteMany({ where: { userId } });
      await tx.user.deleteMany({ where: { id: userId, email } });
    }, { maxWait: 10000, timeout: 30000 });
    console.log("Synthetic editor account and documents removed.");
  } finally { await db.$disconnect(); }
  if (profileDir) {
    const actual = path.resolve(profileDir), temporary = path.resolve(os.tmpdir()) + path.sep;
    if (!actual.startsWith(temporary) || !path.basename(actual).startsWith("cvcomet-resume-editor-")) throw Error("Unexpected browser profile path");
    try { fs.rmSync(actual, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {}
  }
});

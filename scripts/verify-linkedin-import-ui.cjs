/* Real UI with intercepted APIs. No account, AI call or external write. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const base = process.argv[2] || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const routeName = process.argv[3] || "linkedin-import-check-" + randomUUID();
assert.match(routeName, /^linkedin-import-check-[a-f0-9-]+$/);
const routeDir = path.resolve("src/app", routeName);
const output = path.resolve("docs/resume-editor/linkedin-import");
const checks = [], errors = [], imports = [];
const user = { id: "11111111-1111-4111-8111-111111111111", name: "Camille Example", email: "camille@example.test", role: "USER" };
let browser, socket, command, evaluate, available = false, failure = "AI_TIMEOUT", editorNavigation = false, libraryLoaded = false, routeCreated = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression, label, timeout = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { if (await evaluate(`Boolean(${expression})`)) return; }
    catch (error) { if (!/context.*destroyed|context.*not found|Cannot find context/i.test(error.message)) throw error; }
    await delay(150);
  }
  throw Error("Timeout: " + label);
}
async function button(text) {
  await delay(200);
  await evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button: '+${JSON.stringify(text)});if(e.disabled)throw Error('Disabled button');e.scrollIntoView({block:'center'});e.focus();e.click()})()`);
  await delay(150);
}
async function fill(selector, text) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const prototype=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await delay(150);
}
async function screenshot(name) {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
}
async function respond(requestId, status, body) {
  await command("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
}
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/dashboard/resumes/")) {
    editorNavigation = true;
    // The editor itself has its own acceptance test. Stop before its middleware
    // can access a real session or database in this isolated UI check.
    return command("Fetch.failRequest", { requestId, errorReason: "Aborted" });
  }
  // Keep the SSR and initial client account state identical. Authentication is
  // covered by the handler tests; the temporary preview route has no auth gate.
  if (url.pathname === "/api/auth/get-session") return respond(requestId, 200, null);
  if (url.pathname === "/api/resume-documents/linkedin") {
    if (request.method === "GET") return respond(requestId, 200, { urlImportAvailable: available });
    imports.push({ contentType: Object.entries(request.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1], body: request.postData });
    await delay(350);
    return respond(requestId, failure ? 502 : 201, failure ? { error: failure } : { id: "linkedin-ui-resume" });
  }
  if (url.pathname === "/api/me") return respond(requestId, 200, user);
  if (url.pathname === "/api/resume-documents" && request.method === "GET") libraryLoaded = true;
  return respond(requestId, 200, []);
}
async function main() {
  fs.mkdirSync(routeDir); routeCreated = true;
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(routeDir, "page.tsx"), 'import { DocumentsPage } from "@/components/resumes/documents-page"; export default DocumentsPage;\n');
  console.log("Waiting for the temporary UI route to compile…");
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + "/" + routeName, { signal: AbortSignal.timeout(5000) })).ok) { ready = true; break; } }
    catch {}
    await delay(500);
  }
  assert.ok(ready, "Temporary UI route must be available; restart the dev server if new routes are not detected");
  const executable = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
  assert.ok(executable, "Chrome or Edge required");
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "cvcomet-linkedin-ui-"));
  browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=0", "--user-data-dir=" + profileDir, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let endpoint;
  for (let i = 0; i < 100; i++) {
    const file = path.join(profileDir, "DevToolsActivePort");
    if (fs.existsSync(file)) { endpoint = fs.readFileSync(file, "utf8").trim().split("\n"); break; }
    await delay(100);
  }
  assert.ok(endpoint, "Browser debugging connection");
  socket = new WebSocket("ws://127.0.0.1:" + endpoint[0] + endpoint[1]);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let counter = 0; const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timeout = setTimeout(() => { pending.delete(id); reject(Error("Browser command timeout: " + method)); }, method === "Page.navigate" ? 120000 : 20000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      if (callback) { clearTimeout(callback.timeout); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); }
    }
    if (message.method === "Fetch.requestPaused") void intercept(message.params).catch(error => errors.push(error.message));
    if (!editorNavigation && message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (!editorNavigation && message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      const text = message.params.args.map(arg => arg.value || arg.description || "").join(" ");
      if (/hydrat|Minified React|uncaught/i.test(text)) errors.push(text);
    }
  };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  command = (method, params = {}) => send(method, params, sessionId);
  evaluate = async expression => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["*googletagmanager.com*", "*google-analytics.com*", "*js.stripe.com*"] });
  await command("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }, { urlPattern: "*/dashboard/resumes/*", requestStage: "Request" }] });
  await command("Network.setCookie", { name: "i18next", value: "en", url: base, path: "/" });
  await command("Page.addScriptToEvaluateOnNewDocument", { source: 'if(!localStorage.getItem("i18nextLng"))localStorage.setItem("i18nextLng","en");localStorage.setItem("theme","light")' });
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command("Page.navigate", { url: base + "/" + routeName });
  console.log("Checking LinkedIn import in the real documents UI…");
  await until('document.querySelector("main")?.textContent.includes("Import from LinkedIn")', "documents page", 90000);
  for (let i = 0; i < 600 && !libraryLoaded; i++) await delay(100);
  assert.ok(libraryLoaded, "Documents page must be hydrated before interacting");
  await button("Import from LinkedIn");
  await until('document.querySelector("#linkedin-profile-pdf")', "PDF import dialog");
  await button("Profile URL");
  await until('document.querySelector("[role=dialog]")?.textContent.includes("Importing by link is not available yet")', "unconfigured provider fallback");
  assert.equal(await evaluate('document.querySelector("[role=dialog] button[type=submit]").disabled'), true);
  await button("Paste my profile");
  const profileText = "Camille Example\nFrontend Developer\nExample Studio, 2022\nBuilt accessible React applications.\nSkills: React, TypeScript";
  await fill("#linkedin-profile-text", profileText);
  await button("Create my resume");
  await until('document.querySelector("[role=dialog] [role=alert]")?.textContent.includes("too long")', "localized extraction failure");
  assert.equal(await evaluate('document.querySelector("#linkedin-profile-text").value'), profileText);
  assert.equal(JSON.parse(imports.at(-1).body).source, "text");
  await screenshot("desktop-text-import");
  checks.push("Documents button, provider discovery, URL fallback, text submission and preserved input on errors.");
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}))');
  await until('!document.querySelector("[role=dialog]")', "keyboard close");
  assert.equal(await evaluate('document.activeElement.textContent.trim()'), "Import from LinkedIn");
  await evaluate('localStorage.setItem("i18nextLng","fr")');
  await command("Network.setCookie", { name: "i18next", value: "fr", url: base, path: "/" });
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  libraryLoaded = false;
  await command("Page.navigate", { url: base + "/" + routeName });
  await until('document.querySelector("main")?.textContent.includes("Importer depuis LinkedIn")', "French documents page");
  for (let i = 0; i < 300 && !libraryLoaded; i++) await delay(100);
  assert.ok(libraryLoaded, "French page must be hydrated before interacting");
  await button("Importer depuis LinkedIn"); await until('document.querySelector("#linkedin-profile-pdf")', "French PDF dialog");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  assert.equal(await evaluate('document.querySelector("[role=dialog]").getBoundingClientRect().width <= window.innerWidth'), true);
  await screenshot("mobile-french-pdf-import");
  await evaluate('(()=>{const input=document.querySelector("#linkedin-profile-pdf");const transfer=new DataTransfer();transfer.items.add(new File(["%PDF-1.4\\nfixture"],"Profile.pdf",{type:"application/pdf"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}))})()');
  failure = "NO_RESUME_DATA";
  await button("Créer mon CV");
  await until('document.querySelector("[role=dialog] [role=alert]")?.textContent.includes("Aucune information professionnelle")', "French PDF extraction error");
  assert.ok(imports.at(-1).contentType.startsWith("multipart/form-data"));
  assert.ok(imports.at(-1).body.includes('filename="Profile.pdf"'));
  checks.push("PDF selection and multipart submission, French error messages, keyboard focus restoration and mobile layout.");
  await button("Annuler"); available = true;
  await button("Importer depuis LinkedIn"); await button("Lien du profil");
  await fill("#linkedin-profile-url", "https://evil.example/in/person");
  const before = imports.length;
  await button("Créer mon CV");
  await until('document.querySelector("[role=dialog] [role=alert]")?.textContent.includes("profil LinkedIn personnel")', "invalid URL rejection");
  assert.equal(imports.length, before);
  await fill("#linkedin-profile-url", "https://fr.linkedin.com/in/camille-example?trk=tracking");
  failure = "";
  await button("Créer mon CV");
  for (let i = 0; i < 100 && !editorNavigation; i++) await delay(100);
  assert.equal(editorNavigation, true, "Successful import navigates to the existing resume editor");
  assert.deepEqual(JSON.parse(imports.at(-1).body), { source: "url", url: "https://www.linkedin.com/in/camille-example/" });
  checks.push("Configured URL import, URL validation, canonical request and navigation to the resume editor after success.");
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, "checks.json"), JSON.stringify({ checks, imports: imports.length, errors }, null, 2));
  console.log(JSON.stringify({ checks, imports: imports.length, screenshots: output }, null, 2));
}
main().catch(async error => {
  console.error(error.message);
  if (evaluate) {
    try {
      await screenshot("failure");
      console.error(JSON.stringify(await evaluate('({path:location.pathname,dialog:document.querySelector("[role=dialog]")?.textContent,body:document.body.innerText.slice(0,1500)})')));
    } catch {}
  }
  if (errors.length) console.error(JSON.stringify(errors));
  process.exitCode = 1;
}).finally(() => {
  if (socket) socket.close(); if (browser) browser.kill();
  if (routeCreated) {
    const page = path.join(routeDir, "page.tsx");
    if (fs.existsSync(page)) fs.unlinkSync(page);
    if (fs.existsSync(routeDir)) fs.rmdirSync(routeDir);
    const generatedType = path.resolve(".next-dev/types/app", routeName, "page.ts");
    if (fs.existsSync(generatedType)) fs.unlinkSync(generatedType);
  }
});

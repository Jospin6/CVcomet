/* Browser acceptance for phase 2. Intercepted API fixtures, no live DB or AI calls. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const base = process.argv[2] || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local server only");
const output = path.resolve("docs/phase-2");
fs.mkdirSync(output, { recursive: true });
const checks = [], errors = [], apiCalls = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, ws, command, evaluate;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "sam@example.test", role: "USER", isSubscribed: false };
let profile = {
  name: "", email: user.email, phone: "", address: "", headline: "", summary: "", skills: "", languages: "", hobbies: "",
  linkedin: "", github: "", portfolio: "", careerGoal: "", experienceLevel: "", targetJobTitle: "", targetIndustry: "", targetCountry: "", preferredWorkMode: "", resumeSource: "",
  experiences: [], education: [], projects: [], certifications: [], awards: [], professionalLinks: [],
  revision: 0, onboardingCompletedAt: null,
};
let conflict = false, failImport = false, failAI = false;
const writes = [];
async function respond(requestId, status, body) {
  await command("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
}
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  apiCalls.push({ path: url.pathname, method: request.method });
  if (url.pathname === "/api/me") return respond(requestId, 200, user);
  if (url.pathname.startsWith("/api/users/")) return respond(requestId, 200, { ...user, ...profile, Experience: profile.experiences, Education: profile.education, Project: profile.projects });
  if (url.pathname === "/api/conversations") return respond(requestId, 200, []);
  if (url.pathname === "/api/career-profile") {
    if (request.method === "GET") return respond(requestId, 200, profile);
    const body = JSON.parse(request.postData);
    if (conflict) return respond(requestId, 409, { error: "CONFLICT" });
    assert.equal(body.confirmed, true);
    assert.equal(body.revision, profile.revision);
    writes.push(body);
    profile = { ...body.profile, revision: profile.revision + 1, onboardingCompletedAt: body.completeOnboarding ? "2026-10-04T12:00:00.000Z" : profile.onboardingCompletedAt };
    return respond(requestId, 200, profile);
  }
  if (url.pathname === "/api/career-profile/import") {
    if (failImport) return respond(requestId, 502, { error: "AI_FAILED" });
    return respond(requestId, 200, { extracted: { name: "Unwanted replacement", headline: "Imported headline", skills: "TypeScript", experiences: [{ title: "Developer", company: "Example", location: "Paris", start: "2024", end: "", description: "Built a dashboard." }], awards: [{ title: "Project award", organization: "Example school", date: "2024", description: "" }] } });
  }
  if (url.pathname === "/api/career-profile/improve") {
    if (failAI) return respond(requestId, 502, { error: "AI_FAILED" });
    return respond(requestId, 200, { suggestion: "Software student building web applications." });
  }
  // Fail closed: never pass an API request to a real account or service.
  return respond(requestId, 200, []);
}
async function select(id, value) {
  await evaluate("(()=>{const e=document.getElementById(" + JSON.stringify(id) + ");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e," + JSON.stringify(value) + ");e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await delay(150);
}
async function button(text) {
  await evaluate("(()=>{const e=[...document.querySelectorAll('main button')].find(e=>e.textContent.trim()===" + JSON.stringify(text) + ");if(!e)throw Error('Missing button');if(e.disabled)throw Error('Disabled button: '+" + JSON.stringify(text) + ");e.click();})()");
  await delay(200);
}
async function until(expression, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return;
    } catch {}
    await delay(100);
  }
  throw Error("Timeout: " + label);
}
async function click(selector) {
  const point = await evaluate(
    "(()=>{const e=document.querySelector(" +
      JSON.stringify(selector) +
      ');if(!e)throw Error("Missing: "+' +
      JSON.stringify(selector) +
      ');e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
  );
  await command("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await command("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await delay(220);
}
async function fill(selector, value) {
  await evaluate(
    "(()=>{const e=document.querySelector(" +
      JSON.stringify(selector) +
      ');const proto=e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,' +
      JSON.stringify(value) +
      ');e.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
  await delay(150);
}
async function key(key, code, windowsVirtualKeyCode, modifiers = 0) {
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode,
    modifiers,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode,
    modifiers,
  });
  await delay(350);
}
async function navigate(route) {
  await command("Page.navigate", { url: base + route });
  await until(
    'document.readyState==="complete" && !!document.querySelector("main h1")',
    "render " + route,
  );
  await delay(400);
}
async function size(width) {
  await command("Emulation.setDeviceMetricsOverride", {
    width,
    height: width === 375 ? 850 : 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await delay(200);
}
async function screenshot(name) {
  await evaluate("window.scrollTo(0,0);document.activeElement?.blur()");
  await delay(150);
  const { data } = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(
    path.join(output, name + ".png"),
    Buffer.from(data, "base64"),
  );
}
(async () => {
  require("@next/env").loadEnvConfig(process.cwd(), true, {
    info() {},
    error() {},
  });
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: "USER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const executable =
    process.argv[3] ||
    [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].find((p) => fs.existsSync(p));
  assert.ok(executable, "Chrome or Edge must be installed");
  const browserProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), "cvcomet-phase2-"));
  browser = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-extensions",
      "--remote-debugging-port=0",
      "--user-data-dir=" + browserProfileDir,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let endpoint;
  for (let i = 0; i < 150; i++) {
    const file = path.join(browserProfileDir, "DevToolsActivePort");
    if (fs.existsSync(file)) {
      endpoint = fs.readFileSync(file, "utf8").trim().split("\n");
      break;
    }
    await delay(100);
  }
  assert.ok(endpoint, "Chrome debugging endpoint");
  ws = new WebSocket("ws://127.0.0.1:" + endpoint[0] + endpoint[1]);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let counter = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++counter;
      pending.set(id, { resolve, reject });
      ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const item = pending.get(msg.id);
      if (item) {
        pending.delete(msg.id);
        msg.error
          ? item.reject(Error(JSON.stringify(msg.error)))
          : item.resolve(msg.result);
      }
    }
    if (msg.method === "Fetch.requestPaused")
      void intercept(msg.params).catch((e) => errors.push(e.message));
    if (msg.method === "Runtime.exceptionThrown")
      errors.push(
        msg.params.exceptionDetails.exception?.description ||
          msg.params.exceptionDetails.text,
      );
    if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    ) {
      const message = msg.params.args
        .map((a) => a.value || a.description || "")
        .join(" ");
      if (/hydrat|Minified React|uncaught/i.test(message)) errors.push(message);
    }
  };
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  command = (method, params = {}) => send(method, params, sessionId);
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", {
    urls: [
      "*googletagmanager.com*",
      "*google-analytics.com*",
      "*js.stripe.com*",
    ],
  });
  await command("Fetch.enable", {
    patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }],
  });
  evaluate = async (expression) => {
    const r = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result.value;
  };
  await command("Network.setCookie", {
    name: "token_cv",
    value: token,
    url: base,
    httpOnly: true,
    path: "/",
  });
  await command("Network.setCookie", {
    name: "i18next",
    value: "en",
    url: base,
    path: "/",
  });
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: 'if(!localStorage.getItem("i18nextLng"))localStorage.setItem("i18nextLng","en");',
  });

  await size(1440);
  await navigate("/onboarding");
  await until('!!document.querySelector("#careerGoal")', "onboarding loaded");
  await button("Continue");
  assert.ok(await evaluate('!!document.querySelector("main [role=alert]")'));
  await select("careerGoal", "FIRST_JOB"); await button("Continue");
  await select("experienceLevel", "STUDENT"); await button("Continue");
  await fill("#targetJobTitle", "Developer"); await fill("#targetIndustry", "Software"); await fill("#targetCountry", "France"); await select("preferredWorkMode", "REMOTE");
  await button("Back");
  assert.equal(await evaluate('document.querySelector("#experienceLevel").value'), "STUDENT");
  await button("Continue");
  assert.equal(await evaluate('document.querySelector("#targetJobTitle").value'), "Developer");
  await button("Continue");
  await click('input[value="SCRATCH"]'); await button("Continue");
  await until('!!document.querySelector("#name")', "review");
  assert.equal(writes.length, 0);
  await fill("#name", "Sam"); await fill("#headline", "Software student");
  await fill("#summary", "Studying software and building web applications.");
  await fill("#skills", "Java"); await fill("#languages", "French - native");
  await click("#section-education > button");
  await fill("#education-0-degree", "Computer science"); await fill("#education-0-school", "Example school");
  await fill("#education-0-start", "2024");
  await click("#section-projects > button");
  await fill("#projects-0-title", "Portfolio"); await fill("#projects-0-url", "https://example.test");
  assert.equal(writes.length, 0);
  assert.equal(await evaluate('document.querySelector("[role=progressbar]").getAttribute("aria-valuenow")'), "100");
  await click('main input[type=checkbox]');
  await button("Confirm and finish");
  await until('location.pathname==="/dashboard/profile" && !!document.querySelector("#headline")', "saved profile");
  assert.equal(writes.length, 1); assert.equal(profile.name, "Sam");
  assert.equal(profile.education[0].start, "2024");
  checks.push("Five-step scratch onboarding, required fields, back navigation, manual review and explicit persistence; student reaches 100% without work history.");
  await screenshot("profile-desktop");

  await fill("#headline", "Software student building apps.");
  await click("#section-headline button");
  await until('!!document.querySelector("[role=dialog]")', "AI proposal");
  assert.equal(writes.length, 1);
  await fill("#suggestion-headline", "Software student building web applications.");
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.trim()==='Use this wording').click()");
  await until('!document.querySelector("[role=dialog]")', "accept AI");
  assert.equal(profile.headline, "Software student");
  await button("Save profile"); await until('document.querySelector("main").textContent.includes("Profile saved.")', "saved AI");
  assert.equal(writes.length, 2);
  checks.push("AI suggestion shows source and editable proposal; accepting changes only the draft until explicit save.");

  const beforeImport = writes.length;
  await evaluate("(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['Sam'], 'resume.txt', {type:'text/plain'}));const input=document.querySelector('#resume-file');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until('!!document.querySelector("#experiences-0-title")', "import preview");
  assert.equal(await evaluate('document.querySelector("#name").value'), "Sam");
  assert.equal(await evaluate('document.querySelector("#headline").value'), profile.headline);
  assert.equal(writes.length, beforeImport);
  await fill("#experiences-0-description", "Built an accessible dashboard.");
  assert.equal(await evaluate("[...document.querySelectorAll('main button')].find(e=>e.textContent.trim()==='Save profile').disabled"), true);
  await click('main input[type=checkbox]');
  await button("Save profile");
  await until('!document.querySelector("main input[type=checkbox]")', "confirm import");
  assert.equal(writes.length, beforeImport + 1);
  assert.equal(profile.experiences[0].description, "Built an accessible dashboard.");
  checks.push("TXT upload merges non-destructively, allows corrections, requires review confirmation and persists only on Save.");

  conflict = true;
  await fill("#headline", "Unsaved concurrent edit"); await button("Save profile");
  await until('document.querySelector("main [role=alert]")?.textContent.includes("another tab")', "conflict shown");
  assert.equal(await evaluate('document.querySelector("#headline").value'), "Unsaved concurrent edit");
  conflict = false; await button("Discard changes");
  assert.equal(await evaluate('document.querySelector("#headline").value'), profile.headline);
  checks.push("409 conflict preserves the local draft; discard restores the saved snapshot.");

  failImport = true;
  await evaluate("(()=>{const dt=new DataTransfer();dt.items.add(new File(['Sam'], 'resume.txt', {type:'text/plain'}));const e=document.querySelector('#resume-file');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until('document.querySelector("main [role=alert]")?.textContent.includes("failed")', "import failure");
  failImport = false;
  assert.equal(await evaluate('document.querySelector("#name").value'), "Sam");
  failAI = true; await click("#section-headline button");
  await until('document.querySelector("#section-headline [role=alert]")?.textContent.includes("failed")', "AI failure");
  failAI = false;
  checks.push("Import and AI failures leave editable information intact.");

  await navigate("/profil");
  await until('location.pathname==="/dashboard/profile" && !!document.querySelector("#headline")', "legacy redirect");
  assert.equal(await evaluate('document.querySelector("#headline").value'), profile.headline);
  checks.push("Legacy /profil redirects to central profile and persisted information reloads.");

  const layouts = [];
  for (const language of ["en", "fr"]) {
    await command("Network.setCookie", { name: "i18next", value: language, url: base, path: "/" });
    await evaluate('localStorage.setItem("i18nextLng",' + JSON.stringify(language) + ')');
    for (const theme of ["light", "dark"]) {
      await evaluate('localStorage.setItem("theme",' + JSON.stringify(theme) + ')');
      for (const width of [375, 768, 1440]) {
        await size(width); await navigate("/dashboard/profile");
        await until('!!document.querySelector("#headline")', "layout profile");
        const metrics = await evaluate("({viewport:innerWidth,scroll:document.documentElement.scrollWidth})");
        assert.ok(metrics.scroll <= metrics.viewport + 1, JSON.stringify({width, language, theme, metrics}));
        assert.equal(await evaluate('document.documentElement.lang'), language);
        const unnamed = await evaluate("[...document.querySelectorAll('main input:not([type=hidden]),main textarea,main select')].filter(e=>!e.getAttribute('aria-label')&&![...(e.labels||[])].some(l=>l.textContent.trim())).map(e=>e.outerHTML)");
        assert.deepEqual(unnamed, []);
        assert.equal(await evaluate('document.documentElement.classList.contains("dark")'), theme === "dark");
        layouts.push({ language, theme, width });
        if (width === 375) await screenshot("profile-" + language + "-" + theme + "-mobile");
      }
    }
  }
  checks.push("12 profile layouts: FR/EN, light/dark, 375/768/1440 px; all fields labelled and no horizontal page overflow.");
  await command("Network.deleteCookies", { name: "token_cv", url: base });
  await navigate("/dashboard/profile"); await until('location.pathname==="/login"', "anonymous redirect");
  checks.push("Middleware redirects unauthenticated profile access to login.");
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output,"verification.json"), JSON.stringify({ scope: "Real Next.js UI and middleware; synthetic session and intercepted API fixtures; no live database writes or AI requests.", checks, layouts, writes: writes.length, runtimeErrors: errors }, null, 2) + "\n");
  console.log(JSON.stringify({ checks, layouts: layouts.length, writes: writes.length, errors }, null, 2));
  await send("Browser.close").catch(() => {}); ws.close();
})().catch(async error => {
  console.error(error.stack);
  if (command) { try { await screenshot("failure"); console.error(await evaluate("document.body.innerText.slice(-1800)")); } catch {} }
  fs.writeFileSync(path.join(output,"failure.json"),JSON.stringify({error:error.message,checks,errors},null,2));
  if (ws) ws.close(); if (browser) browser.kill(); process.exitCode=1;
});

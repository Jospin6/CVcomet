/* Frontend acceptance checks. All /api requests are intercepted; no database write,
   AI request, or payment is made. Run against a locally running production server:
   node scripts/verify-phase-1.cjs [http://localhost:3000]
   Requires local Chrome/Edge (or a browser executable as the second CLI argument) and the project's existing dependencies. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const base = process.argv[2] || "http://localhost:3000";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Only local servers are allowed",
);
const output = path.resolve("docs/phase-1");
fs.mkdirSync(output, { recursive: true });
const checks = [],
  errors = [],
  apiCalls = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser,
  ws,
  command,
  evaluate,
  guest = false,
  failTemplates = false,
  emptyTemplates = false;
let user = {
  id: "phase1-fixture",
  email: "camille@example.test",
  name: "Camille Martin",
  phone: "+33 6 00 00 00 00",
  address: "Paris, France",
  skills: "React, TypeScript, Design systems",
  languages: "French, English",
  role: "USER",
  isSubscribed: false,
  currentTemplateId: "",
  currentCoverLetterId: "",
  generationCount: 2,
  lastGeneratedAt: new Date().toISOString(),
  Education: [
    {
      id: "edu-fixture",
      degree: "Master",
      school: "Université de démonstration",
      location: "Paris",
      start: "2020-01-01",
      end: "2022-01-01",
      description: "Études de conception",
    },
  ],
  Experience: [
    {
      id: "exp-fixture",
      title: "Product designer",
      company: "Studio exemple",
      location: "Paris",
      start: "2022-01-01",
      description: "Conception de produits accessibles",
    },
  ],
  Project: [],
  certifications: [],
};
const cv = {
  title: "Product designer",
  summary: "Profil de démonstration pour vérifier la présentation du document.",
  skills: [],
  educations: [],
  experiences: [],
  projects: [],
  languages: [],
  certifications: [],
};
const conversation = {
  id: "conversation-fixture",
  userId: user.id,
  title: "Product designer — Studio exemple",
  content:
    "Une offre fictive utilisée uniquement pour les tests de l'interface.",
  Cv: [cv],
  CoverLetter: [],
};
const templates = [
  { id: "free-a", name: "Essentiel", type: "CV", plan: "FREE" },
  { id: "free-b", name: "Équilibre", type: "CV", plan: "FREE" },
  { id: "paid-a", name: "Perspective", type: "CV", plan: "PAID" },
  { id: "paid-b", name: "Signature", type: "CV", plan: "PAID" },
  {
    id: "free-letter",
    name: "Correspondance",
    type: "COVER_LETTER",
    plan: "FREE",
  },
  { id: "paid-letter", name: "Éditorial", type: "COVER_LETTER", plan: "PAID" },
].map((t) => ({ ...t, templateFile: "", createdAt: "2026-10-04" }));
function preview(id) {
  const green = id.includes("paid") ? "#344c66" : "#285446";
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594" viewBox="0 0 420 594"><rect width="420" height="594" fill="white"/><rect x="30" y="32" width="5" height="70" fill="' +
    green +
    '"/><text x="48" y="56" font-family="Arial" font-weight="bold" font-size="21" fill="' +
    green +
    '">CAMILLE MARTIN</text><text x="48" y="79" font-family="Arial" font-size="10" fill="#59635d">PRODUCT DESIGNER</text><text x="48" y="97" font-family="Arial" font-size="8" fill="#59635d">Paris · camille@example.test</text>' +
    [135, 238, 374]
      .map(
        (y, i) =>
          '<text x="32" y="' +
          y +
          '" font-family="Arial" font-size="11" font-weight="bold" fill="' +
          green +
          '">' +
          ["PROFILE", "EXPERIENCE", "EDUCATION"][i] +
          '</text><rect x="32" y="' +
          (y + 8) +
          '" width="350" height="1" fill="#d9e1db"/>' +
          Array.from(
            { length: i === 1 ? 8 : 5 },
            (_, j) =>
              '<rect x="32" y="' +
              (y + 24 + j * 11) +
              '" width="' +
              (j % 3 === 2 ? 245 : 350) +
              '" height="3" fill="#b8c0ba"/>',
          ).join(""),
      )
      .join("") +
    '<text x="32" y="567" font-family="Arial" font-size="8" fill="#59635d">CVcomet · Fixture de test</text></svg>'
  );
}
async function intercept(params) {
  const request = params.request,
    url = new URL(request.url),
    route = url.pathname;
  apiCalls.push({ method: request.method, path: route });
  let status = 200,
    body = {},
    mime = "application/json";
  if (route === "/api/avatar") {
    body = preview(url.searchParams.get("id") || "");
    mime = "image/svg+xml";
  } else if (route === "/api/me") {
    status = guest ? 401 : 200;
    body = guest ? { error: "Unauthenticated" } : user;
  } else if (route === "/api/login" || route === "/api/signup") {
    guest = false;
    body = user;
  } else if (route === "/api/logout") {
    guest = true;
    body = { success: true };
  } else if (route === "/api/templates") {
    status = failTemplates ? 503 : 200;
    body = failTemplates
      ? { message: "Fixture failure" }
      : emptyTemplates
        ? []
        : templates;
  } else if (route.startsWith("/api/users/")) {
    if (request.method === "PUT") {
      const data = JSON.parse(request.postData || "{}");
      if (data.currentTemplateId)
        user = { ...user, currentTemplateId: data.currentTemplateId };
      else user = { ...user, ...data };
    }
    body = user;
  } else if (route === "/api/conversations")
    body = request.method === "POST" ? conversation : [conversation];
  else if (route.startsWith("/api/conversations/")) body = conversation;
  else if (route.startsWith("/api/generate-")) {
    status = 503;
    body = { error: "Generation deliberately disabled by UI test" };
  } else if (
    /\/api\/(experience|education|project|certification)/.test(route)
  ) {
    body = route.includes("experience")
      ? user.Experience
      : route.includes("education")
        ? user.Education
        : [];
  } else {
    body = [];
  }
  await command("Fetch.fulfillRequest", {
    requestId: params.requestId,
    responseCode: status,
    responseHeaders: [
      { name: "Content-Type", value: mime + "; charset=utf-8" },
    ],
    body: Buffer.from(
      typeof body === "string" ? body : JSON.stringify(body),
    ).toString("base64"),
  });
}
async function until(expression, label) {
  const deadline = Date.now() + 30000;
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
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || "secret_key"));
  const executable =
    process.argv[3] ||
    [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].find((p) => fs.existsSync(p));
  assert.ok(executable, "Chrome or Edge must be installed");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cvcomet-phase1-"));
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
      "--user-data-dir=" + profile,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let endpoint;
  for (let i = 0; i < 150; i++) {
    const file = path.join(profile, "DevToolsActivePort");
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
    value: "fr",
    url: base,
    path: "/",
  });
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: 'localStorage.setItem("i18nextLng","fr");',
  });
  await size(1440);
  await navigate("/");
  await until(
    'document.querySelector("[role=meter]")?.getAttribute("aria-valuenow")==="100"',
    "profile data",
  );
  assert.equal(
    apiCalls.filter((r) => r.path === "/api/me").length,
    1,
    "deduplicated session",
  );
  await screenshot("overview-light-1440");
  checks.push(
    "Real Next.js overview uses profile data; eight completed sections produce 100%; only one /api/me request.",
  );
  await click('[data-sidebar="trigger"]');
  assert.equal(
    await evaluate(
      'document.querySelector("[data-collapsible]")?.getAttribute("data-state")',
    ),
    "collapsed",
  );
  await screenshot("sidebar-collapsed");
  await click('[data-sidebar="trigger"]');
  checks.push("Desktop sidebar collapses and expands.");
  await click('[data-testid="command-trigger"]');
  assert.equal(await evaluate("document.activeElement.tagName"), "INPUT");
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[role=dialog] button:disabled").length',
    ),
    4,
  );
  await key("ArrowDown", "ArrowDown", 40);
  assert.ok(
    await evaluate(
      'document.activeElement.textContent.includes("Créer un CV")',
    ),
  );
  await key("ArrowDown", "ArrowDown", 40);
  assert.ok(
    await evaluate(
      'document.activeElement.textContent.includes("Créer une lettre")',
    ),
  );
  await key("Escape", "Escape", 27);
  assert.equal(
    await evaluate("document.activeElement.dataset.testid"),
    "command-trigger",
  );
  await key("k", "KeyK", 75, 2);
  await fill('[role="dialog"] input', "xyz-no-action");
  assert.ok(
    await evaluate('!!document.querySelector("[role=dialog] [role=status]")'),
  );
  await fill('[role="dialog"] input', "lettre");
  await key("Enter", "Enter", 13);
  await until(
    'location.search.includes("coverLetter")&&!document.querySelector("[role=dialog]")',
    "palette navigation",
  );
  assert.ok(
    await evaluate(
      'document.querySelector("#composer button[aria-pressed=true]").textContent.includes("Lettre")',
    ),
  );
  await key("k", "KeyK", 75, 4);
  await until('!!document.querySelector("[role=dialog]")', "Cmd+K");
  await key("Escape", "Escape", 27);
  checks.push(
    "Ctrl+K and Cmd+K; search/empty state; arrows skip unavailable commands; Enter opens composer; Escape restores focus.",
  );
  await click('[data-testid="theme-switcher"]');
  await click('[role="menuitemradio"]:nth-child(2)');
  await until('document.documentElement.classList.contains("dark")', "theme switch");
  await navigate("/");
  assert.ok(await evaluate('document.documentElement.classList.contains("dark")'));
  await click('[data-testid="theme-switcher"]');
  await click('[role="menuitemradio"]:first-child');
  await until('!document.documentElement.classList.contains("dark")', "light theme");
  checks.push("Header theme switch changes the interface and persists across reloads.");
  await navigate("/templates");
  await until('document.querySelectorAll("article").length===4', "templates");
  await screenshot("templates-light-1440");
  await fill('input[aria-label*="modèle"]', "zzzz");
  assert.equal(
    await evaluate('document.querySelectorAll("article").length'),
    0,
  );
  await fill('input[aria-label*="modèle"]', "Essentiel");
  assert.equal(
    await evaluate('document.querySelectorAll("article").length'),
    1,
  );
  await click("article button");
  assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));
  await screenshot("template-dialog");
  await key("Escape", "Escape", 27);
  assert.ok(await evaluate('!!document.activeElement.closest("article")'));
  await click("article button");
  await click(
    '[role="dialog"] button:not([data-slot="dialog-close"]):not([aria-label])',
  );
  await until(
    '!document.querySelector("[role=dialog]")',
    "selection closes dialog",
  );
  await until(
    'document.querySelector("article").textContent.includes("Sélectionné")',
    "selection persists",
  );
  await fill('input[aria-label*="modèle"]', "");
  await click('[role="combobox"]');
  await click('[role="option"][data-state="unchecked"]:last-child');
  await until(
    'document.querySelectorAll("article").length===2',
    "premium filter",
  );
  await click("article button");
  assert.ok(
    await evaluate(
      '!!document.querySelector("[role=dialog] a[href=\\"/upgrade\\"]")',
    ),
  );
  await key("Escape", "Escape", 27);
  checks.push(
    "Gallery search, empty result, premium filter, accessible A4 preview, focus restoration, free selection and premium upgrade link.",
  );
  failTemplates = true;
  await navigate("/templates");
  await until(
    'document.querySelector("main").textContent.includes("Impossible de charger")',
    "gallery error",
  );
  failTemplates = false;
  emptyTemplates = true;
  await navigate("/templates");
  await until(
    'document.querySelector("main").textContent.includes("Aucun modèle pour le moment")',
    "empty gallery",
  );
  emptyTemplates = false;
  checks.push(
    "Gallery failure and empty states are visible and retry/reset controls exist.",
  );
  const matrix = [];
  for (const theme of ["light", "dark"]) {
    await evaluate(
      'localStorage.setItem("theme",' + JSON.stringify(theme) + ")",
    );
    for (const width of [375, 768, 1024, 1440]) {
      await size(width);
      for (const route of [
        "/",
        "/templates",
        "/profil",
        "/settings",
        "/help",
        "/upgrade",
        "/g/conversation-fixture",
        "/login",
        "/signup",
      ]) {
        await navigate(route);
        const metrics = await evaluate(
          "({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth})",
        );
        assert.ok(
          metrics.scroll <= metrics.viewport + 1 &&
            metrics.body <= metrics.viewport + 1,
          route +
            " " +
            theme +
            " overflow at " +
            width +
            ": " +
            JSON.stringify(metrics),
        );
        assert.equal(
          await evaluate('document.documentElement.classList.contains("dark")'),
          theme === "dark",
        );
        matrix.push({ route, theme, width, overflow: false });
        const unnamed = await evaluate(
          '[...document.querySelectorAll("main input:not([type=hidden]),main textarea,main select")].filter(e=>!e.getAttribute("aria-label")&&!e.getAttribute("aria-labelledby")&&![...(e.labels||[])].some(l=>l.textContent.trim())).map(e=>e.outerHTML)',
        );
        assert.deepEqual(unnamed, [], route + " unlabeled fields");
        if (route === "/" && (width === 375 || width === 1440))
          await screenshot("overview-" + theme + "-" + width);
        if (route === "/templates" && width === 375)
          await screenshot("templates-" + theme + "-375");
        if (route === "/profil" && width === 1440 && theme === "light")
          await screenshot("profile-light-1440");
        if (route === "/g/conversation-fixture") {
          const paper = await evaluate(
            '(()=>{const e=document.querySelector(".document-paper");if(!e)return null;const c=getComputedStyle(e);return {width:e.getBoundingClientRect().width,bg:c.backgroundColor,color:c.color};})()',
          );
          assert.ok(paper && paper.width >= 790);
          assert.equal(paper.bg, "rgb(255, 255, 255)");
          assert.equal(paper.color, "rgb(32, 38, 32)");
          if (width === 375 && theme === "dark")
            await screenshot("document-dark-375");
        }
      }
    }
  }
  checks.push(
    "72 layout checks: nine real routes, 375/768/1024/1440 px, light/dark; no page overflow; all form fields have accessible names; A4 paper stays white with dark text.",
  );
  await size(375);
  await navigate("/");
  await click('[data-sidebar="trigger"]');
  await until(
    '!!document.querySelector("[data-mobile=true]")',
    "mobile navigation",
  );
  await screenshot("mobile-navigation");
  for (let i = 0; i < 20; i++) {
    await key("Tab", "Tab", 9);
    assert.ok(
      await evaluate('!!document.activeElement.closest("[role=dialog]")'),
      "mobile focus containment",
    );
  }
  await key("Escape", "Escape", 27);
  assert.equal(
    await evaluate('document.activeElement.getAttribute("data-sidebar")'),
    "trigger",
  );
  await click('[data-sidebar="trigger"]');
  await click('[data-mobile=true] a[href="/settings"]');
  await until(
    'location.pathname==="/settings"&&!document.querySelector("[data-mobile=true]")',
    "mobile navigation closes",
  );
  await click("main button:nth-of-type(1)");
  await command("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(
    await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'),
    true,
  );
  await click('[data-testid="command-trigger"]');
  const duration = await evaluate(
    'getComputedStyle(document.querySelector("[role=dialog]")).animationDuration',
  );
  assert.ok(duration.split(",").every((x) => parseFloat(x) <= 0.001));
  await key("Escape", "Escape", 27);
  checks.push(
    "Mobile drawer traps Tab focus, Escape restores focus, navigation closes it; reduced-motion media disables long transitions.",
  );
  guest = true;
  await navigate("/");
  await until(
    'document.querySelector("[role=meter]")?.getAttribute("aria-valuenow")==="0"',
    "guest",
  );
  await navigate("/login");
  await fill("input[type=email]", "camille@example.test");
  await fill("input[type=password]", "Fixture-only-password");
  await click("button[type=submit]");
  await until(
    'location.pathname==="/"&&document.querySelector("[role=meter]")?.getAttribute("aria-valuenow")==="100"',
    "login form",
  );
  checks.push(
    "Guest state is empty; React Hook Form login fields submit correctly, successful mocked login updates session and overview.",
  );
  const contrasts = await evaluate(
    '(()=>{const names=[["foreground","background"],["muted-foreground","card"],["primary-foreground","primary"],["success","card"],["warning","card"],["destructive","card"]];function lum(hex){const a=hex.trim().slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;}const result=[];for(const theme of ["light","dark"]){document.documentElement.className=theme;const style=getComputedStyle(document.documentElement);for(const [fg,bg]of names){const a=[lum(style.getPropertyValue("--"+fg)),lum(style.getPropertyValue("--"+bg))].sort((a,b)=>b-a);result.push({theme,fg,bg,ratio:(a[0]+.05)/(a[1]+.05)});}}return result;})()',
  );
  for (const c of contrasts) assert.ok(c.ratio >= 4.5, JSON.stringify(c));
  assert.deepEqual(errors, []);
  const result = {
    scope:
      "Next.js application browser acceptance; synthetic JWT and intercepted API fixtures; no live AI, database writes or billing tested.",
    checks,
    matrix,
    contrasts,
    runtimeErrors: errors,
    apiRequests: apiCalls.length,
  };
  fs.writeFileSync(
    path.join(output, "verification.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      { checks, layouts: matrix.length, runtimeErrors: errors },
      null,
      2,
    ),
  );
  await send("Browser.close").catch(() => {});
  ws.close();
})().catch(async (error) => {
  console.error(error.stack);
  if (command) {
    try {
      await screenshot("failure");
      console.error(
        await evaluate(
          "JSON.stringify({url:location.href,text:document.body.innerText.slice(-2500)})",
        ),
      );
    } catch {}
  }
  fs.writeFileSync(
    path.join(output, "failure.json"),
    JSON.stringify({ error: error.message, checks, errors }, null, 2),
  );
  if (ws) ws.close();
  if (browser) browser.kill();
  process.exitCode = 1;
});

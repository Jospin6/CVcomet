/* Real Better Auth endpoints and Prisma adapter, with an isolated in-memory DB. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const loader = require("./source-loader.cjs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { Prisma } = require("@prisma/client");
const root = path.resolve(__dirname, "..");

process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "isolated-auth-test-secret-with-at-least-32-characters";

function fixture() {
  const tables = { user: [], account: [], session: [], verification: [] };
  const fields = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name.toLowerCase(), new Set(model.fields.map(field => field.name))]));
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, expected]) => {
      if (key === "AND") return expected.every(clause => matches(row, clause));
      if (key === "OR") return expected.some(clause => matches(row, clause));
      if (key === "providerId_accountId") return matches(row, expected);
      if (expected && typeof expected === "object" && !(expected instanceof Date)) {
        if ("in" in expected) return expected.in.includes(row[key]);
        if ("not" in expected) return row[key] !== expected.not;
        if ("gt" in expected) return row[key] > expected.gt;
      }
      return row[key] === expected;
    });
  }
  function select(row, selection) {
    if (!row) return null;
    if (!selection) return structuredClone(row);
    return Object.fromEntries(Object.keys(selection).filter(key => selection[key]).map(key => [key, row[key]]));
  }
  const db = {};
  for (const [model, rows] of Object.entries(tables)) {
    db[model] = {
      async create({ data, select: selection }) {
        for (const key of Object.keys(data)) assert.ok(fields.get(model).has(key), `${model}.${key} must exist in Prisma`);
        const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        if (model === "user") Object.assign(row, { password: null, verificationCode: null, role: "USER", isSubscribed: false, ...data });
        rows.push(row);
        return select(row, selection);
      },
      async findFirst({ where, select: selection } = {}) { return select(rows.find(row => matches(row, where)), selection); },
      async findUnique({ where, select: selection, include } = {}) {
        const row = select(rows.find(row => matches(row, where)), selection);
        if (row && include?.Account) row.Account = tables.account.filter(account => account.userId === row.id);
        return row;
      },
      async findUniqueOrThrow(args) { const row = await this.findUnique(args); assert.ok(row); return row; },
      async findMany({ where } = {}) { return structuredClone(rows.filter(row => matches(row, where))); },
      async count({ where } = {}) { return rows.filter(row => matches(row, where)).length; },
      async update({ where, data, select: selection }) {
        const row = rows.find(row => matches(row, where));
        assert.ok(row); Object.assign(row, data); return select(row, selection);
      },
      async upsert({ where, create, update }) {
        return rows.some(row => matches(row, where)) ? this.update({ where, data: update }) : this.create({ data: create });
      },
      async delete({ where }) {
        const index = rows.findIndex(row => matches(row, where));
        if (index < 0) throw new Error("Not found");
        return rows.splice(index, 1)[0];
      },
      async deleteMany({ where }) {
        const removed = rows.filter(row => matches(row, where));
        for (const row of removed) rows.splice(rows.indexOf(row), 1);
        return { count: removed.length };
      },
    };
  }
  let cookie = "";
  const load = loader({
    [path.join(root, "prisma/prisma.ts")]: db,
    "next/headers": { headers: async () => new Headers({ cookie }) },
    // Endpoint responses carry real Set-Cookie headers; Next's request scope is supplied by the app.
    "better-auth/next-js": { nextCookies: () => ({ id: "next-cookies" }) },
  });
  const module = load("src/lib/auth.ts");
  async function call(endpoint, body, currentCookie = cookie) {
    const response = await module.auth.handler(new Request(`http://localhost:3000/api/auth/${endpoint}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie: currentCookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length) cookie = setCookies.filter(value => !value.includes("Max-Age=0")).map(value => value.split(";")[0]).join("; ");
    return response;
  }
  return { ...module, load, db, tables, call, getCookie: () => cookie, setCookie: value => { cookie = value; } };
}

test("signup creates one credential account, authenticates immediately and forbids role escalation", async () => {
  const f = fixture();
  const response = await f.call("sign-up/email", { name: "Test User", email: "user@example.test", password: "secret1", role: "ADMIN", isSubscribed: true });
  assert.equal(response.status, 200);
  assert.ok(f.getCookie().includes("better-auth.session_token="));
  assert.equal(f.tables.account.length, 1);
  assert.equal(f.tables.account[0].providerId, "credential");
  assert.equal(f.tables.user[0].role, "USER");
  assert.equal(f.tables.user[0].isSubscribed, false);
  assert.deepEqual(await f.getSessionUser(), { id: f.tables.user[0].id, email: "user@example.test", role: "USER" });
  const body = await response.json();
  assert.equal("password" in body.user, false);
  assert.equal("verificationCode" in f.sanitizeUser(f.tables.user[0]), false);
});

test("wrong passwords fail, valid passwords sign in and duplicate signup does not duplicate users", async () => {
  const f = fixture();
  await f.call("sign-up/email", { name: "Test User", email: "user@example.test", password: "secret1" });
  const wrong = await f.call("sign-in/email", { email: "user@example.test", password: "wrong1" });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("set-cookie"), null);
  assert.equal((await f.call("sign-in/email", { email: "user@example.test", password: "secret1" })).status, 200);
  assert.ok((await f.call("sign-up/email", { name: "Another User", email: "user@example.test", password: "secret2" })).status >= 400);
  assert.equal(f.tables.user.length, 1);
});

test("logout revokes the session; expired and forged cookies never authorize requests", async () => {
  const f = fixture();
  await f.call("sign-up/email", { name: "Test User", email: "user@example.test", password: "secret1" });
  const cookie = f.getCookie();
  f.tables.session[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal(await f.getSessionUser(), null);
  await f.call("sign-in/email", { email: "user@example.test", password: "secret1" });
  const validCookie = f.getCookie();
  assert.equal((await f.call("sign-out", {})).status, 200);
  f.setCookie(validCookie);
  assert.equal(await f.getSessionUser(), null);
  f.setCookie(cookie + "tampered");
  assert.equal(await f.getSessionUser(), null);
  f.setCookie("token_cv=forged-admin-token");
  assert.equal(await f.getSessionUser(), null);
});

test("legacy bcrypt users migrate only after valid credentials and then use the same session", async () => {
  const f = fixture();
  const legacy = await f.db.user.create({ data: { email: "legacy@example.test", name: "Legacy User", password: await bcrypt.hash("secret1", 4), emailVerified: false } });
  const { prepareLegacyCredential } = f.load("src/lib/credentials.ts");
  await prepareLegacyCredential(legacy.email, "wrong1");
  assert.equal(f.tables.account.length, 0);
  await prepareLegacyCredential(legacy.email, "secret1");
  await prepareLegacyCredential(legacy.email, "secret1");
  assert.equal(f.tables.account.length, 1);
  assert.equal((await f.call("sign-in/email", { email: legacy.email, password: "secret1" })).status, 200);
  assert.equal((await f.getSessionUser()).id, legacy.id);
});

test("compatibility endpoints normalize emails, validate JSON and return the full sanitized user", async () => {
  const f = fixture();
  const signup = f.load("src/app/api/signup/route.ts");
  const login = f.load("src/app/api/login/route.ts");
  const request = (body, endpoint) => new Request(`http://localhost:3000/api/${endpoint}`, {
    method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body,
  });
  assert.equal((await signup.POST(request("{", "signup"))).status, 400);
  assert.equal((await login.POST(request(JSON.stringify({ email: "invalid", password: "secret1" }), "login"))).status, 400);
  const created = await signup.POST(request(JSON.stringify({ email: " User@Example.test ", password: "secret1" }), "signup"));
  assert.equal(created.status, 201);
  assert.ok(created.headers.get("set-cookie"));
  const user = await created.json();
  assert.equal(user.email, "user@example.test");
  assert.equal("password" in user, false);
  assert.equal("verificationCode" in user, false);
  assert.equal((await login.POST(request(JSON.stringify({ email: "USER@EXAMPLE.TEST", password: "wrong1" }), "login"))).status, 401);
  assert.equal((await login.POST(request(JSON.stringify({ email: "USER@EXAMPLE.TEST", password: "secret1" }), "login"))).status, 200);
});

test("local signup works before any session request when BETTER_AUTH_URL is unset", async () => {
  const previousURL = process.env.BETTER_AUTH_URL;
  const previousMode = process.env.NODE_ENV;
  delete process.env.BETTER_AUTH_URL;
  process.env.NODE_ENV = "development";
  try {
    const f = fixture();
    const { POST } = f.load("src/app/api/signup/route.ts");
    const response = await POST(new Request("http://localhost:3000/api/signup", {
      method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "first-request@example.test", password: "secret1" }),
    }));
    assert.equal(response.status, 201);
  } finally {
    process.env.BETTER_AUTH_URL = previousURL;
    process.env.NODE_ENV = previousMode;
  }
});

test("authorization reflects current database roles and rejects other users", async () => {
  const f = fixture();
  await f.call("sign-up/email", { name: "Test User", email: "user@example.test", password: "secret1" });
  let session = await f.getSessionUser();
  assert.equal(f.canAccessUser(session, session.id), true);
  assert.equal(f.canAccessUser(session, randomUUID()), false);
  assert.equal(f.isAdmin(session), false);
  f.tables.user[0].role = "ADMIN";
  session = await f.getSessionUser();
  assert.equal(f.isAdmin(session), true);
  assert.equal(f.canAccessUser(session, randomUUID()), true);
  assert.equal(f.canAccessUser(null, randomUUID()), false);
});

test("middleware redirects anonymous and expired sessions and enforces admin access", async () => {
  const f = fixture();
  const { middleware } = f.load("src/middleware.ts");
  const { NextRequest } = require("next/server");
  const savedFetch = global.fetch;
  global.fetch = (url, options) => f.auth.handler(new Request(url, { headers: options.headers }));
  try {
    const protectedURL = "http://localhost:3000/dashboard/profile";
    const anonymous = await middleware(new NextRequest(protectedURL));
    assert.equal(new URL(anonymous.headers.get("location")).pathname, "/login");
    assert.equal(new URL(anonymous.headers.get("location")).searchParams.get("redirect"), "/dashboard/profile");
    await f.call("sign-up/email", { name: "Test User", email: "user@example.test", password: "secret1" });
    const headers = { cookie: f.getCookie() };
    assert.equal((await middleware(new NextRequest(protectedURL, { headers }))).headers.get("x-middleware-next"), "1");
    const denied = await middleware(new NextRequest("http://localhost:3000/admin", { headers }));
    assert.equal(new URL(denied.headers.get("location")).pathname, "/unauthorized");
    f.tables.user[0].role = "ADMIN";
    assert.equal((await middleware(new NextRequest("http://localhost:3000/admin", { headers }))).headers.get("x-middleware-next"), "1");
    f.tables.session[0].expiresAt = new Date(Date.now() - 1000);
    assert.equal(new URL((await middleware(new NextRequest(protectedURL, { headers }))).headers.get("location")).pathname, "/login");
  } finally {
    global.fetch = savedFetch;
  }
});

test("login redirection preserves internal destinations and rejects external redirects", () => {
  const { safeRedirectPath } = loader({})("src/lib/utils.ts");
  assert.equal(safeRedirectPath("/dashboard/profile?tab=skills"), "/dashboard/profile?tab=skills");
  for (const destination of ["https://example.test", "//example.test", "/\\example.test", null, ""]) {
    assert.equal(safeRedirectPath(destination), "/");
  }
});

test("logout and account changes clear cached personal data across the Redux store", () => {
  const load = loader({ "@/lib/auth-client": { authClient: { $store: { notify() {} } } } });
  const { makeStore } = load("src/redux/store.ts");
  const { fetchCvs } = load("src/redux/cv/cvSlice.ts");
  const { fetchUser } = load("src/redux/user/userSlice.ts");
  const store = makeStore();
  const privateUser = { id: "old-user", email: "old@example.test", name: "Old User" };
  const fill = () => {
    store.dispatch(fetchUser.fulfilled(privateUser, "request"));
    store.dispatch(fetchCvs.fulfilled([{ id: "private-cv", title: "Private CV", userId: privateUser.id }], "request"));
    assert.equal(store.getState().cv.cvs.length, 1);
  };
  fill();
  store.dispatch({ type: "auth/logout/fulfilled" });
  assert.deepEqual(store.getState().cv.cvs, []);
  assert.equal(store.getState().user.user, null);
  fill();
  const nextUser = { id: "next-user", email: "next@example.test" };
  store.dispatch({ type: "auth/login/fulfilled", payload: nextUser });
  assert.deepEqual(store.getState().cv.cvs, []);
  assert.equal(store.getState().user.user.id, nextUser.id);
});

/* Exercise the compiled local app; remove only the uniquely named test account afterward. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const base = process.argv[2] || "http://localhost:3107";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local verification server");
const db = new PrismaClient();
const email = `http-auth-check-${randomUUID()}@example.invalid`;
const password = randomUUID();
let cookie = "";

async function call(endpoint, method = "GET", body) {
  const response = await fetch(new URL(endpoint, base), {
    method, redirect: "manual", headers: { cookie, origin: base, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.filter(value => !value.includes("Max-Age=0")).map(value => value.split(";")[0]).join("; ");
  return response;
}

async function main() {
  assert.equal(await db.user.findUnique({ where: { email } }), null);
  try {
    for (const page of ["/", "/login", "/signup"]) assert.equal((await call(page)).status, 200);
    assert.equal((await call("/api/me")).status, 401);
    assert.equal((await call("/dashboard/profile")).status, 307);
    assert.equal((await call("/api/signup", "POST", { email: "invalid", password })).status, 400);
    const signup = await call("/api/signup", "POST", { email, password, name: "HTTP Authentication Check", role: "ADMIN" });
    assert.equal(signup.status, 201);
    const user = await signup.json();
    assert.equal(user.role, "USER");
    assert.equal("password" in user, false);
    assert.equal("verificationCode" in user, false);
    assert.ok(cookie.includes("better-auth.session_token="));
    assert.equal((await call("/api/me")).status, 200);
    assert.equal((await call("/dashboard/profile")).status, 200);
    const denied = await call("/admin");
    assert.equal(denied.status, 307);
    assert.equal(new URL(denied.headers.get("location"), base).pathname, "/unauthorized");
    assert.equal((await call("/api/login", "POST", { email, password: "invalid-password" })).status, 401);
    assert.equal((await call("/api/login", "POST", { email, password })).status, 200);
    const oldCookie = cookie;
    assert.equal((await call("/api/logout", "DELETE")).status, 200);
    cookie = oldCookie;
    assert.equal((await call("/api/me")).status, 401);
    assert.equal((await call("/dashboard/profile")).status, 307);
    console.log("Compiled app signup, login, middleware, admin restrictions and logout checks passed.");
  } finally {
    const fixture = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (fixture) await db.user.delete({ where: { id: fixture.id, email } });
    assert.equal(await db.user.findUnique({ where: { email } }), null);
    console.log("Temporary HTTP verification account removed.");
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());

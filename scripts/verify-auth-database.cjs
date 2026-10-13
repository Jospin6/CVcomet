/* Verify real PostgreSQL authentication inside a transaction that is always rolled back. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const loader = require("./source-loader.cjs");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
process.env.BETTER_AUTH_URL = "http://localhost:3000";
const db = new PrismaClient();
const rollback = new Error("ROLLBACK_AUTH_VERIFICATION");

async function main() {
  const counts = await Promise.all([db.user.count(), db.account.count(), db.session.count()]);
  try {
    await db.$transaction(async tx => {
      let cookie = "";
      const load = loader({
        [path.resolve("prisma/prisma.ts")]: tx,
        "next/headers": { headers: async () => new Headers({ cookie }) },
        // HTTP endpoint cookies are verified through response headers, without Next's request scope.
        "better-auth/next-js": { nextCookies: () => ({ id: "next-cookies" }) },
      });
      const { auth, getSessionUser } = load("src/lib/auth.ts");
      const email = `auth-check-${randomUUID()}@example.invalid`;
      const password = randomUUID();
      async function call(endpoint, body) {
        const response = await auth.handler(new Request(`http://localhost:3000/api/auth/${endpoint}`, {
          method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", cookie },
          body: JSON.stringify(body),
        }));
        const cookies = response.headers.getSetCookie();
        if (cookies.length) cookie = cookies.filter(value => !value.includes("Max-Age=0")).map(value => value.split(";")[0]).join("; ");
        return response;
      }
      assert.equal((await call("sign-up/email", { name: "Authentication Check", email, password })).status, 200);
      assert.equal(await tx.account.count({ where: { user: { email }, providerId: "credential" } }), 1);
      assert.equal((await getSessionUser()).email, email);
      assert.equal((await call("sign-in/email", { email, password: "invalid-password" })).status, 401);
      assert.equal((await call("sign-in/email", { email, password })).status, 200);
      const previousCookie = cookie;
      assert.equal((await call("sign-out", {})).status, 200);
      cookie = previousCookie;
      assert.equal(await getSessionUser(), null);
      console.log("PostgreSQL signup, login, session and logout checks passed.");
      throw rollback;
    }, { maxWait: 10000, timeout: 60000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.deepEqual(await Promise.all([db.user.count(), db.account.count(), db.session.count()]), counts);
  console.log("Verification transaction rolled back; no test account or session was kept.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("quality schema and migration have account deletion cascades and non-text metrics only", () => {
  const schema = read("prisma/schema.prisma");
  const sql = read("prisma/migrations/20261025030000_career_quality/migration.sql");
  assert.match(schema, /model CareerAgentObservation \{/);
  assert.match(sql, /CREATE TABLE "CareerAgentObservation"/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(schema, /feedbackRating CareerAgentFeedback\?/);
  for (const disallowed of ['"prompt"', '"answer"', '"cvText"', '"ipAddress"']) {
    assert.ok(!sql.includes(disallowed));
  }
});
test("Career Agent metrics are always attempted on both success and provider failure", () => {
  const source = read("src/lib/career-os/agent-service.ts");
  assert.match(source, /finally \{[\s\S]*?recordCareerAgentObservation\(actor.id/);
  assert.match(source, /reviewCareerAgentAnswer\(assertAgentAnswer\(final.text\)\)/);
  assert.match(source, /safeAgentErrorCode/);
  assert.ok(!source.includes("console.log(message)"));
});
test("feedback endpoint has strict schema, authenticated actor, origin guard and ownership lookup", () => {
  const route = read("src/app/api/career/v1/missions/[id]/runs/[runId]/feedback/route.ts");
  const service = read("src/lib/quality/feedback-service.ts");
  for (const marker of ["getSessionUser()", "assertTrustedWriteOrigin(req)", ".strict()", "withCareerHttp(", "profileJson(req, 512)"]) assert.ok(route.includes(marker), marker);
  for (const marker of ["userId: actor.id", "mission: { userId: actor.id }", 'status: "COMPLETED"', "updateMany", "feedbackAt"]) assert.ok(service.includes(marker), marker);
  assert.ok(!route.includes("body.userId"));
});
test("admin endpoint checks session/role and publishes aggregates only", () => {
  const source = read("src/app/api/admin/quality/route.ts");
  const overview = read("src/lib/quality/agent-observations.ts");
  assert.ok(source.includes("requireAIAdmin(req)"));
  assert.ok(source.includes("aiAdminResponse"));
  assert.ok(overview.includes('take: 1000'));
  assert.ok(overview.includes("careerAgentObservation.groupBy"));
  assert.ok(!overview.includes("select: { question:"));
});
test("candidate feedback is presented only for a persisted completed answer", () => {
  const view = read("src/app/dashboard/assistant/page.tsx");
  assert.ok(view.includes('run.status === "COMPLETED" ? run.id : undefined'));
  assert.ok(view.includes("/feedback"));
  assert.ok(view.includes("aria-pressed"));
  assert.ok(view.includes('rating: choice'));
});
test("retention defaults to preview and requires explicit --execute flag", () => {
  const code = read("scripts/cleanup-career-observations.cjs");
  assert.ok(code.includes("process.argv.includes('--execute')"));
  assert.ok(code.includes("const days = 30"));
  assert.ok(code.includes("deleteMany"));
  assert.ok(code.includes("if (!execute)"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const load = path => readFileSync(new URL(path, root), "utf8");
const service = load("src/lib/career-os/application-packet-service.ts");
const schema = load("prisma/schema.prisma");
const createRoute = load("src/app/api/career/v1/application-packets/route.ts");
const detailRoute = load("src/app/api/career/v1/application-packets/[id]/route.ts");
const decisionRoute = load("src/app/api/career/v1/application-packets/[id]/decision/route.ts");
const suggestRoute = load("src/app/api/career/v1/application-packets/[id]/suggest-email/route.ts");
const registry = load("src/lib/career-os/tool-registry.ts");
const migration = load("prisma/migrations/20261025010000_career_application_packets/migration.sql");

test("all packet mutations use authenticated owner identity and origin / payload protection", () => {
  for (const source of [createRoute, detailRoute, decisionRoute, suggestRoute]) {
    assert.match(source, /getSessionUser/);
    assert.match(source, /assertTrustedWriteOrigin/);
    assert.match(source, /profileJson/);
    assert.match(source, /withCareerHttp/);
  }
  assert.match(service, /userId: actor\.id/);
  assert.match(service, /conversation: \{ userId: actor\.id \}/);
});
test("explicit author confirmation never sends an email or submits an application", () => {
  assert.match(service, /submissionPerformed: false/);
  assert.match(service, /externalEmailSent: false/);
  assert.match(decisionRoute, /decideApplicationPacket/);
  assert.doesNotMatch(service + decisionRoute, /sendMail\(|resend\.emails|nodemailer|jobApplication\.create\(|fetch\(.*apply/i);
});
test("packet CAS, serialization, revisions and deterministic request replay", () => {
  assert.match(service, /userId_requestKey/);
  assert.match(service, /intentHash/);
  assert.match(service, /status: "DRAFT", revision:/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /assertSourcesCurrent/);
  assert.match(service, /PACKET_SOURCE_CHANGED/);
});
test("AI request returns preview only, uses career profile facts, budget & factual guard", () => {
  assert.match(suggestRoute, /getProfileFacts\(actor\.id/);
  assert.doesNotMatch(suggestRoute, /listConfirmedEvidenceForAgent/);
  assert.match(suggestRoute, /reserveProfileAI/);
  assert.match(suggestRoute, /assertDocumentFacts/);
  assert.match(suggestRoute, /saved: false, sent: false, reviewed: false/);
  assert.doesNotMatch(suggestRoute, /\.update\(|\.create\(/);
});
test("tenant-safe read tool never shares email bodies or recipient addresses with agent", () => {
  assert.match(registry, /list_my_application_packets/);
  assert.match(registry, /where: \{ userId: actor\.id \}/);
  assert.match(registry, /select: \{ id: true, status: true, approvedAt: true, job:/);
});
test("schema and migration include idempotency, cascade and per-user indexes", () => {
  assert.match(schema, /model CareerApplicationPacket/);
  assert.match(schema, /@@unique\(\[userId, requestKey\]\)/);
  assert.match(migration, /CareerApplicationPacket_userId_requestKey_key/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.equal((schema.match(/model CareerApplicationPacket \{/g) || []).length, 1);
});

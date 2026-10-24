import test from "node:test";
import assert from "node:assert/strict";
import { draftApplicationEmail, intentHash, assertEditable, assertSourcesCurrent, decidePacket, normalizedHeading } from "../src/lib/career-os/application-packet-policy.ts";

test("email is cautious and never claims employer submission or attachments already sent", () => {
  const fr = draftApplicationEmail({ company: "Acme", title: "Ingénieur logiciel", name: "Ada", language: "fr" });
  const en = draftApplicationEmail({ company: "Acme", title: "Software Engineer", name: null, language: "en" });
  assert.match(fr.subject, /Candidature/);
  assert.match(fr.body, /Ada/);
  assert.match(en.subject, /Application/);
  assert.doesNotMatch((fr.body + en.body).toLowerCase(), /ci-joint|attached|i have sent|j'ai envoyé/);
});
test("untrusted posting names cannot inject email headers or excessive text", () => {
  const dangerous = "Engineer\r\nBcc: stolen@example.com\r\n" + "x".repeat(5000);
  const draft = draftApplicationEmail({ company: dangerous, title: dangerous, name: dangerous, language: "en" });
  assert.ok(draft.subject.length <= 300);
  assert.ok(draft.body.length < 1000);
  assert.ok(!draft.subject.includes("\n"));
  assert.ok(!normalizedHeading(dangerous).includes("\n"));
});
test("idempotency hash binds job, CV, mission, letter and language but not user-supplied actor", () => {
  const base = { jobId: "a", cvId: "b", language: "fr" };
  assert.equal(intentHash(base), intentHash(base));
  assert.notEqual(intentHash(base), intentHash({ ...base, language: "en" }));
  assert.notEqual(intentHash(base), intentHash({ ...base, missionId: "c" }));
  assert.notEqual(intentHash(base), intentHash({ ...base, coverLetterId: "d" }));
  assert.notEqual(intentHash(base), intentHash({ ...base, cvId: "other" }));
});
test("approval requires explicit checkbox and exact optimistic revision", () => {
  assert.throws(() => decidePacket("DRAFT", 1, 1, "approve", false), /EXPLICIT_REVIEW_REQUIRED/);
  assert.throws(() => decidePacket("DRAFT", 1, 0, "approve", true), /PACKET_CHANGED/);
  assert.throws(() => decidePacket("READY", 2, 2, "approve", true), /PACKET_NOT_EDITABLE/);
  assert.throws(() => decidePacket("CANCELED", 2, 2, "approve", true), /PACKET_NOT_EDITABLE/);
  assert.equal(decidePacket("DRAFT", 1, 1, "approve", true), "READY");
  assert.equal(decidePacket("DRAFT", 1, 1, "cancel", false), "CANCELED");
});
test("a modified CV, letter or job invalidates an earlier review", () => {
  const original = { cvRevision: 3, letterRevision: 2, jobUpdatedAt: new Date("2026-10-24T10:00:00Z") };
  assert.doesNotThrow(() => assertSourcesCurrent(original, { ...original }));
  assert.throws(() => assertSourcesCurrent(original, { ...original, cvRevision: 4 }), /PACKET_SOURCE_CHANGED/);
  assert.throws(() => assertSourcesCurrent(original, { ...original, letterRevision: 3 }), /PACKET_SOURCE_CHANGED/);
  assert.throws(() => assertSourcesCurrent(original, { ...original, jobUpdatedAt: new Date("2026-10-24T10:01:00Z") }), /PACKET_SOURCE_CHANGED/);
});
test("patches to an approved packet are always rejected", () => {
  assert.doesNotThrow(() => assertEditable("DRAFT", 5, 5));
  assert.throws(() => assertEditable("READY", 5, 5), /PACKET_NOT_EDITABLE/);
});

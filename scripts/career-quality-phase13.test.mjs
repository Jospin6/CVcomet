import test from "node:test";
import assert from "node:assert/strict";
import { reviewCareerAgentAnswer, sanitizeAgentObservation, percentile, safeAgentErrorCode, boundedMetric } from "../src/lib/quality/agent-quality-policy.ts";
import { validateAgentCalls, boundAgentRead } from "../src/lib/career-os/agent-engine.ts";
import { unsupportedNumericClaims } from "../src/lib/resume-ai/review.ts";
import { addedUnsupportedNumbers, unsupportedJobTerms } from "../src/lib/cover-letter-ai/review.ts";

// Synthetic examples only; no real candidate, document, or employer information.
test("career agent blocks unequivocal false claims of external submission in English and French", () => {
  for (const response of [
    "I have submitted your application.", "I emailed the employer.",
    "J'ai envoyé votre candidature.", "J’ai contacté votre recruteur.",
  ]) assert.throws(() => reviewCareerAgentAnswer(response), { code: "AGENT_UNSUPPORTED_ACTION_CLAIM" });
});
test("career agent allows honest limitation responses (no false-positive on negation)", () => {
  for (const response of [
    "I have not submitted your application. You must approve any next step.",
    "Je n'ai pas envoyé votre candidature. Vérifiez le dossier avant de poursuivre.",
    "Here is the draft email, which has not been sent.",
  ]) assert.equal(reviewCareerAgentAnswer(response), response);
});
test("the output guard is not claimed to detect all hallucinations", () => {
  assert.equal(reviewCareerAgentAnswer("I may be wrong; please confirm this degree."), "I may be wrong; please confirm this degree.");
});
test("observations cannot store arbitrary prompts, PII, user identifiers, or provider errors", () => {
  const event = sanitizeAgentObservation({ outcome: "FAILED", phase: "TOOLS", durationMs: 1050, toolCount: 2,
    errorCode: "candidate@example.org CV text: Private" , arbitrary: "top secret" });
  assert.deepEqual(Object.keys(event), ["outcome", "phase", "durationMs", "toolCount", "errorCode"]);
  assert.deepEqual(event, { outcome: "FAILED", phase: "TOOLS", durationMs: 1050, toolCount: 2, errorCode: "AGENT_FAILED" });
  assert.ok(!JSON.stringify(event).includes("candidate@example"));
});
test("negative, NaN, over-range or fractional metrics fail closed", () => {
  assert.equal(boundedMetric(-1, 3), 0);
  assert.equal(boundedMetric(2.4, 3), 0);
  assert.equal(boundedMetric(40000000, 3), 3);
  assert.equal(boundedMetric(Infinity, 3), 0);
  assert.equal(safeAgentErrorCode("AGENT_UNSUPPORTED_ACTION_CLAIM"), "AGENT_UNSUPPORTED_ACTION_CLAIM");
  assert.equal(safeAgentErrorCode("USER_JANE_DOE_PRIVATE_DATA"), "AGENT_FAILED");
  assert.deepEqual(sanitizeAgentObservation({ outcome: "COMPLETED", errorCode: "PRIVATE" }).errorCode, null);
});
test("exact percentile calculation is deterministic and has explicit empty-data semantics", () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([10, 20, 30, 40], 50), 20);
  assert.equal(percentile([10, 20, 30, 40], 95), 40);
  assert.equal(percentile([-5, 1, Number.NaN, 3], 50), 1);
  assert.equal(percentile([1], 120), null);
});
test("prompt injection from a fake tool plan cannot register an external operation", () => {
  assert.throws(() => validateAgentCalls([{ tool: "submit_application", input: { target: "employer" } }]), { code: "AGENT_PLAN_REJECTED" });
  assert.throws(() => validateAgentCalls([{ tool: "list_my_resumes", input: { }, effect: "external" }]), { code: "AGENT_PLAN_REJECTED" });
  const allowed = validateAgentCalls([{ tool: "get_my_profile", input: {} }]);
  assert.equal(allowed.length, 1);
});
test("oversized tool outputs are truncated before sending to AI provider", () => {
  const result = boundAgentRead({ material: "X".repeat(12000) }, 512);
  assert.equal(result.truncated, true);
  assert.equal(typeof result.result.excerpt, "string");
  assert.ok(result.result.excerpt.length <= 512);
});

test("resume rewriting catches invented quantified achievement and accepts an existing source", () => {
  const edits = [{ type: "setField", path: "summary", value: "Grew revenue by 87%" }];
  assert.deepEqual(unsupportedNumericClaims(edits, ["Grew revenue 5%"]), ["87"]);
  assert.deepEqual(unsupportedNumericClaims(edits, ["My verified note: 87% growth"]), []);
});
test("cover letter checks unsupported numbers and skills copied from an ad", () => {
  const doc = { introduction: "Hello", body: "I develop web applications.", conclusion: "Best regards" };
  const after = { ...doc, body: "I managed 500 people and used Kubernetes." };
  assert.deepEqual(addedUnsupportedNumbers(doc, after, []), ["500"]);
  assert.deepEqual(unsupportedJobTerms(after, doc, ["Kubernetes"], []), ["Kubernetes"]);
  assert.deepEqual(unsupportedJobTerms(after, doc, ["Kubernetes"], ["Used Kubernetes in Project B"]), []);
});

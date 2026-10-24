import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('agent endpoint is versioned, authenticated, strict and checks write origin', () => {
  const source = read('src/app/api/career/v1/agent/route.ts');
  for (const expected of ['getSessionUser()', 'requireCareerVersion', 'profileJson(req, 8 * 1024)', 'assertTrustedWriteOrigin(req)', 'runCareerAgent(actor, body.message, req.signal)', 'withCareerHttp', '.strict()'])
    assert.ok(source.includes(expected), expected);
  assert.ok(!source.includes('body.userId'));
  assert.ok(!source.includes('body.tool'));
});

test('legacy career chat is wired to the agent with strict JSON caps, not a free-text standalone model', () => {
  const source = read('src/app/api/assistant/route.ts');
  for (const expected of ['runCareerAgent(actor, message, req.signal)', 'requireUser()', 'assertTrustedWriteOrigin(req)', 'profileJson(req, 8 * 1024)'])
    assert.ok(source.includes(expected), expected);
  assert.ok(!source.includes('generateText('));
});

test('two provider calls have separate quota reservations, bounded tokens, and usage accounting', () => {
  const source = read('src/lib/career-os/agent-service.ts');
  assert.equal(source.match(/reserveProfileAI\(actor\.id, "CAREER_ASSISTANT"\)/g)?.length, 2);
  assert.ok(source.includes('maxTokens: 400'));
  assert.ok(source.includes('maxTokens: 1200'));
  assert.ok(source.includes('auditAIUsage(actor.id, ai.provider, ai.modelId, plan.usage)'));
  assert.ok(source.includes('auditAIUsage(actor.id, ai.provider, ai.modelId, final.usage)'));
  assert.ok(source.includes('executeCareerReadTool(actor, tool, input)'));
  assert.ok(!source.includes('submit_application('));
});

test('server authority remains in existing owner-scoped read tool implementations', () => {
  const source = read('src/lib/career-os/tool-registry.ts');
  assert.ok(source.includes('where: { conversation: { userId: actor.id } }'));
  assert.ok(source.includes('where: { id: resumeId, conversation: { userId: actor.id } }'));
  assert.ok(source.includes('where: { userId: actor.id }'));
  assert.ok(source.includes('listConfirmedEvidenceForAgent(actor.id, limit)'));
  assert.ok(!source.includes('rawInput.userId'));
});

test('assistant UI displays only server-approved read traces, not private tool results', () => {
  const source = read('src/app/dashboard/assistant/page.tsx');
  assert.ok(source.includes('result.steps?.filter'));
  assert.ok(source.includes('labels[s.tool]'));
  assert.ok(source.includes('role="status"'));
  assert.ok(!source.includes('step.result'));
});

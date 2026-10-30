import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_API_VERSION, CAREER_READ_TOOLS, CAREER_TOOL_CATALOG,
  CareerContractError, requireCareerVersion, careerEnvelope, isCareerReadTool,
} from '../src/lib/career-os/contracts.ts';
import { authorizeCareerTool, requireEnabledReadTool } from '../src/lib/career-os/policy.ts';
import { parseIdempotencyKey, assertSameIdempotentRequest } from '../src/lib/career-os/idempotency.ts';
import { startCareerTrace, finishCareerTrace } from '../src/lib/career-os/telemetry.ts';

const owner = { id: 'owner-123', role: 'USER' };

test('v1 wire version is explicit and rejects unsupported versions', () => {
  assert.equal(CAREER_API_VERSION, 'v1');
  assert.equal(requireCareerVersion('v1'), 'v1');
  for (const bad of [undefined, 1, 'v2', null, 'V1']) {
    assert.throws(() => requireCareerVersion(bad), e => e instanceof CareerContractError && e.code === 'UNSUPPORTED_API_VERSION');
  }
});

test('versioned envelope always carries server-issued trace id', () => {
  assert.deepEqual(careerEnvelope('req-123', { success: true }), { apiVersion: 'v1', requestId: 'req-123', data: { success: true } });
});

test('tool catalog has no duplicate ID and enables owner-only reads and reviewed draft preparation', () => {
  assert.equal(new Set(CAREER_TOOL_CATALOG.map(t => t.id)).size, CAREER_TOOL_CATALOG.length);
  assert.deepEqual(CAREER_TOOL_CATALOG.filter(t => t.available).map(t => t.id), [...CAREER_READ_TOOLS, 'draft_resume_changes', 'draft_cover_letter']);
  assert.ok(CAREER_TOOL_CATALOG.filter(t => t.available && t.effect === 'draft').every(t => !t.requiresApproval));
  // Draft preparation changes no document; a distinct authenticated endpoint confirms edits.
  assert.ok(CAREER_TOOL_CATALOG.filter(t => t.available).every(t => t.effect !== 'external' && t.effect !== 'sensitive_write'));
  for (const tool of CAREER_TOOL_CATALOG) {
    assert.equal(tool.requiresApproval, tool.effect === 'external' || tool.effect === 'sensitive_write');
  }
});

test('tool allowlist rejects fictitious, planned and malicious names', () => {
  assert.equal(isCareerReadTool('get_my_profile'), true);
  for (const tool of ['submit_application', 'get_other_profile', 'draft_resume_changes', '__proto__', '']) {
    assert.equal(isCareerReadTool(tool), false);
    assert.throws(() => requireEnabledReadTool(tool, CAREER_READ_TOOLS), e => e.code === 'TOOL_NOT_AVAILABLE');
  }
});

test('tool authorization is default deny for missing actor and cross-account reads, including ADMIN', () => {
  assert.throws(() => authorizeCareerTool({ actor: null, ownerId: owner.id, effect: 'read' }), e => e.status === 401);
  assert.throws(() => authorizeCareerTool({ actor: owner, ownerId: 'victim', effect: 'read' }), e => e.status === 403);
  assert.throws(() => authorizeCareerTool({ actor: { ...owner, role: 'ADMIN' }, ownerId: 'victim', effect: 'read' }), e => e.status === 403);
  assert.doesNotThrow(() => authorizeCareerTool({ actor: owner, ownerId: owner.id, effect: 'read' }));
});

test('LLM-supplied approved flag cannot enable email, external or sensitive writes', () => {
  for (const effect of ['external', 'sensitive_write']) {
    assert.throws(() => authorizeCareerTool({ actor: owner, ownerId: owner.id, effect, approved: true }), e => e.code === 'ACTION_NOT_ENABLED');
    assert.throws(() => authorizeCareerTool({ actor: owner, ownerId: owner.id, effect }), e => e.code === 'ACTION_NOT_ENABLED');
  }
});

test('idempotency key format is unambiguous and bounded', () => {
  assert.equal(parseIdempotencyKey('trace_20261024_XYZ'), 'trace_20261024_XYZ');
  for (const bad of [null, '', 'short', '../123456789', 'A'.repeat(129), 'abcdefgh\n']) {
    assert.throws(() => parseIdempotencyKey(bad), e => e.code === 'INVALID_IDEMPOTENCY_KEY');
  }
});

test('idempotency fingerprint rejects replay with different payload and malformed hashes', () => {
  const a = 'a'.repeat(64), b = 'b'.repeat(64);
  assert.doesNotThrow(() => assertSameIdempotentRequest(a, a));
  assert.throws(() => assertSameIdempotentRequest(a, b), e => e.status === 409 && e.code === 'IDEMPOTENCY_CONFLICT');
  assert.throws(() => assertSameIdempotentRequest('bad', a), e => e.code === 'INVALID_OPERATION_FINGERPRINT');
});

test('structured operation telemetry is correlated and contains no content fields', () => {
  const trace = startCareerTrace('tools.read');
  assert.match(trace.requestId, /^[a-f\d-]{36}$/i);
  const oldInfo = console.info;
  const logs = [];
  console.info = (...args) => logs.push(args);
  try { finishCareerTrace(trace, 'error', 'FORBIDDEN'); } finally { console.info = oldInfo; }
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'career_os_operation');
  assert.deepEqual(Object.keys(logs[0][1]).sort(), ['durationMs', 'errorCode', 'operation', 'requestId', 'status']);
  assert.equal(logs[0][1].errorCode, 'FORBIDDEN');
});

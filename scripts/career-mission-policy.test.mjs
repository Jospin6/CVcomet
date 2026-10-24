import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_HISTORY_LIMIT, MISSION_LEASE_MS, MISSION_MAX_LIST, MISSION_MAX_CONTEXT_CHARS,
  contextFromCompletedRuns, assertMissionRequestKey, assertSameMissionRequest, requireApprovalDecision,
} from '../src/lib/career-os/mission-policy.ts';

test('mission runs use a bounded lease and conservative history limits', () => {
  assert.equal(MISSION_LEASE_MS, 90000);
  assert.equal(MISSION_HISTORY_LIMIT, 6);
  assert.equal(MISSION_MAX_LIST, 30);
});
test('mission request IDs are UUIDs and cannot be arbitrary caller-provided identifiers', () => {
  assert.equal(assertMissionRequestKey('DFBA3A04-20C4-48AF-BACE-F181897C3D7A'), 'dfba3a04-20c4-48af-bace-f181897c3d7a');
  for (const key of ['', null, 'abc', 'no-id', '00000000-0000-0000-0000-000000000000']) {
    assert.throws(() => assertMissionRequestKey(key), e => e.code === 'INVALID_REQUEST_KEY');
  }
});
test('same key can only represent exactly the same mission input', () => {
  assert.doesNotThrow(() => assertSameMissionRequest('Review my CV', 'Review my CV'));
  assert.throws(() => assertSameMissionRequest('Review my CV', 'Send my application'), e => e.code === 'REQUEST_KEY_REUSED');
});
test('history uses only completed question-answer pairs in chronological order', () => {
  const runs = Array.from({ length: 9 }, (_, i) => ({question:`user-${i}`,answer:`assistant-${i}`}));
  const history = contextFromCompletedRuns(runs);
  assert.equal(history.length, MISSION_HISTORY_LIMIT * 2);
  assert.deepEqual(history[0], {role:'user',content:'user-3'});
  assert.deepEqual(history.at(-1), {role:'assistant',content:'assistant-8'});
  assert.deepEqual(contextFromCompletedRuns([{question:'   ',answer:'valid'},{question:'hello',answer:''}]), []);
});
test('long conversation history is cropped to a bounded budget, without tool results', () => {
  const history = contextFromCompletedRuns(Array.from({length:10},()=>({ question:'q'.repeat(2000), answer:'a'.repeat(9000)})));
  assert.ok(history.reduce((sum,x)=>sum+x.content.length,0)<=MISSION_MAX_CONTEXT_CHARS);
  assert.ok(history.every(turn => turn.content.length<=2200));
  assert.ok(history.every(turn => ['user','assistant'].includes(turn.role)));
});
test('approval expires, cannot be reused, and only explicit decisions are accepted', () => {
  const now = new Date('2026-10-24T00:00:00Z');
  const valid = new Date('2026-10-24T00:01:00Z');
  assert.equal(requireApprovalDecision('PENDING', valid, now, 'approve'), 'APPROVED');
  assert.equal(requireApprovalDecision('PENDING', valid, now, 'reject'), 'REJECTED');
  assert.throws(()=>requireApprovalDecision('APPROVED',valid,now,'approve'), e=>e.code==='APPROVAL_ALREADY_DECIDED');
  assert.throws(()=>requireApprovalDecision('CONSUMED',valid,now,'reject'), e=>e.code==='APPROVAL_ALREADY_DECIDED');
  assert.throws(()=>requireApprovalDecision('PENDING',now,now,'approve'), e=>e.code==='APPROVAL_EXPIRED');
  assert.throws(()=>requireApprovalDecision('PENDING',valid,now,'execute'), e=>e.code==='INVALID_APPROVAL_DECISION');
});

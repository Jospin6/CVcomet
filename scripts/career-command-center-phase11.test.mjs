import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationCount, missionCount, safeCount, chooseCareerNextStep } from '../src/lib/career/command-center.ts';

test('dashboard counters never transform invalid or missing API results into zero', () => {
  for (const value of [null, undefined, '', '0', -1, 1.5, NaN, Infinity, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(safeCount(value), null);
  }
  assert.equal(safeCount(0), 0);
  assert.equal(applicationCount({ total: 7 }), 7);
  assert.equal(applicationCount({ total: '7' }), null);
  assert.equal(applicationCount({ error: { code: 'UNAUTHORIZED' } }), null);
  assert.equal(missionCount({ data: { items: [{ id: 'a' }, { id: 'b' }] } }), 2);
  assert.equal(missionCount({ data: { items: [] } }), 0);
  assert.equal(missionCount({ data: { items: null } }), null);
  assert.equal(missionCount({ data: { items: Array(31).fill(1) } }), null);
});

test('next action uses available data without pretending a job is ready', () => {
  assert.equal(chooseCareerNextStep(false, 5, 9), 'SIGN_IN');
  assert.equal(chooseCareerNextStep(true, null, 0), 'UNAVAILABLE');
  assert.equal(chooseCareerNextStep(true, 0, 9), 'CREATE_RESUME');
  assert.equal(chooseCareerNextStep(true, 2, 0), 'REVIEW_MATCH');
  assert.equal(chooseCareerNextStep(true, 2, null), 'REVIEW_MATCH');
  assert.equal(chooseCareerNextStep(true, 2, 1), 'PREPARE_PACKET');
});

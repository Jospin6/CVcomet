import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_KINDS, EVIDENCE_STATUSES, nextEvidenceStatus, statusAfterEdit } from '../src/lib/career-evidence/contracts.ts';
import { extractProfileEvidence } from '../src/lib/career-evidence/import.ts';

test('evidence categories are explicit and statuses exclude implicit VERIFIED', () => {
  assert.ok(EVIDENCE_KINDS.includes('EXPERIENCE'));
  assert.ok(EVIDENCE_KINDS.includes('SKILL'));
  assert.deepEqual([...EVIDENCE_STATUSES], ['DRAFT', 'CONFIRMED', 'REJECTED', 'REVOKED']);
});
test('confirmation requires user action and cannot resuscitate revoked facts', () => {
  assert.equal(nextEvidenceStatus('DRAFT', 'confirm'), 'CONFIRMED');
  assert.equal(nextEvidenceStatus('REJECTED', 'confirm'), 'CONFIRMED');
  for (const status of EVIDENCE_STATUSES) {
    if (status !== 'DRAFT' && status !== 'REJECTED') assert.equal(nextEvidenceStatus(status, 'confirm'), null);
    if (status !== 'CONFIRMED') assert.equal(nextEvidenceStatus(status, 'revoke'), null);
    if (status !== 'DRAFT') assert.equal(nextEvidenceStatus(status, 'reject'), null);
  }
  assert.equal(nextEvidenceStatus('CONFIRMED', 'revoke'), 'REVOKED');
  assert.equal(nextEvidenceStatus('REVOKED', 'confirm'), null);
});
test('editing any active fact invalidates confirmation, revoked history is immutable', () => {
  for (const status of ['DRAFT', 'CONFIRMED', 'REJECTED']) assert.equal(statusAfterEdit(status), 'DRAFT');
  assert.equal(statusAfterEdit('REVOKED'), null);
});
const profile = {
  experiences: [{id:'x1', title:'Developer',company:'ACME',start:'2024',end:'2026',description:'Built dashboards'}],
  education: [{id:'e1',degree:'Bachelor',school:'University A',start:'2019',end:'2022'}],
  projects: [{id:'p1',title:'Mobile Wallet',description:'Local payments'}],
  certifications: [{id:'c1',name:'Cloud Professional',organization:'Provider',date:'2025'}],
  skills:'Go, Rust, TypeScript, Rust, Python',
};
test('opt-in profile import extracts structured evidence with stable provenance keys', () => {
  const rows = extractProfileEvidence(profile);
  assert.ok(rows.length >= 8);
  assert.ok(rows.some(x => x.kind === 'EXPERIENCE' && x.statement.includes('Developer')));
  assert.ok(rows.some(x => x.kind === 'EDUCATION'));
  assert.ok(rows.some(x => x.kind === 'SKILL' && x.statement === 'Go'));
  assert.equal(rows.filter(x => x.statement === 'Rust').length, 1);
  assert.equal(new Set(rows.map(x => x.sourceKey)).size, rows.length);
  assert.deepEqual(extractProfileEvidence(profile), rows);
  assert.ok(rows.every(x => x.sourceKey.startsWith('profile:')));
  assert.ok(rows.every(x => x.statement.length <= 1600));
});
test('import never pulls private account identifiers, email, password, and has a bounded workload', () => {
  const rows = extractProfileEvidence({ ...profile, email:'private@address.com', password:'SHOULD_NOT_BE_INCLUDED',
    skills: Array(150).fill('NewSkill').map((x,i) => `${x}${i}`).join(',') });
  assert.ok(rows.length <= 50);
  assert.ok(!JSON.stringify(rows).includes('private@address.com'));
  assert.ok(!JSON.stringify(rows).includes('SHOULD_NOT_BE_INCLUDED'));
});
test('profile import uses unique structured IDs for deterministic deduplication', () => {
  const first = extractProfileEvidence(profile);
  const second = extractProfileEvidence({ ...profile, experiences:[{...profile.experiences[0], description:'Updated evidence'}] });
  assert.equal(first.find(x=>x.kind === 'EXPERIENCE')?.sourceKey, second.find(x=>x.kind === 'EXPERIENCE')?.sourceKey);
});

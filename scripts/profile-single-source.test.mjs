import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileFacts } from '../src/lib/career-profile/profile-facts.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const profile = {
  name: 'Candidate', email: 'private@example.org', password: 'SECRET',
  targetJobTitle: 'Neurosurgeon', careerGoal: 'INTERNATIONAL_JOB',
  headline: 'Developer', summary: 'Improved delivery for the team',
  experiences: [{ title: 'Developer', company: 'ACME', start: '2024', end: '2025', description: 'Built real systems' }],
  education: [{ degree: 'BSc', school: 'Example College', start: '2018', end: '2022', description: '' }],
  projects: [{ title: 'App', description: 'React Native', url: '' }],
  certifications: [{ name: 'Cloud Certificate', organization: 'Exam Board', date: '2025', description: '' }],
  awards: [], skills: 'TypeScript, PostgreSQL, TypeScript',
};
test('profile extraction includes user-entered career information but excludes goals and secrets', () => {
  const facts = profileFacts(profile, 50);
  assert.ok(facts.some(item => item.statement.includes('Built real systems')));
  assert.ok(facts.some(item => item.statement === 'TypeScript'));
  assert.equal(facts.filter(item => item.statement === 'TypeScript').length, 1);
  assert.ok(facts.every(item => item.sourceLabel === 'Career Profile'));
  assert.doesNotMatch(JSON.stringify(facts), /Neurosurgeon|SECRET|private@example\.org/);
});
test('only bounded, non-fabricated statements are returned', () => {
  assert.equal(profileFacts(profile, 0).length, 0);
  assert.ok(profileFacts({ ...profile, skills: 'X,'.repeat(300) }, 30).length <= 30);
});
test('all new IA entrypoints read the current profile and never query the retired vault', () => {
  const modules = [
    'src/app/api/cvs/[id]/assistant/route.ts',
    'src/app/api/cover-letters/[id]/assistant/route.ts',
    'src/app/api/resume-ai/route.ts',
    'src/lib/career/interview.ts',
    'src/lib/career-os/application-drafts.ts',
    'src/app/api/career/v1/application-packets/[id]/suggest-email/route.ts',
  ];
  for (const module of modules) {
    const code = read(module);
    assert.match(code, /getProfileFacts|profileFacts\(/, module);
    assert.doesNotMatch(code, /careerEvidence\.findMany|listConfirmedEvidenceForAgent/, module);
  }
});
test('existing proposals continue to require explicit approval and preserve legacy references', () => {
  for (const file of ['src/lib/resume-ai/proposal-service.ts', 'src/lib/cover-letter-ai/proposal-service.ts']) {
    const code = read(file);
    assert.match(code, /evidenceRevisions/);
    assert.match(code, /status: "PENDING"/);
    assert.match(code, /EVIDENCE_CHANGED/);
    assert.match(code, /revision: proposal\.baseRevision/);
  }
});

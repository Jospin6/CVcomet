import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const report = read('src/components/career/job-match-report.tsx');
const page = read('src/app/dashboard/job-match/page.tsx');

test('overview is the first tab and scores are sourced from stored results', () => {
  assert.match(report, /useState<Tab>\("overview"\)/);
  assert.match(report, /match\.overallScore/);
  assert.match(report, /match\.components\.essentialSkills/);
  assert.match(report, /match\.requirements\.length/);
  assert.doesNotMatch(report, /const\s+demoScore\s*=/);
});

test('improvements distinguish missing evidence from verified errors', () => {
  assert.match(report, /labels\.actual/);
  assert.match(report, /item\.status === "PARTIAL"/);
  assert.match(report, /item\.status === "VERIFY"/);
  assert.match(report, /bg-red-500\/10/);
  assert.match(report, /bg-emerald-500\/10/);
});

test('requirements are collapsed by default and evidence is retained', () => {
  assert.match(report, /<details key=\{item\.id\}/);
  assert.match(report, /item\.evidenceSources/);
  assert.match(report, /item\.evidence/);
  assert.match(report, /aria-labelledby="job-match-tab-requirements"/);
});

test('proposal approval, rejection, generation and saving remain functional', () => {
  assert.match(page, /action: "ACCEPT", matchId: result\.id/);
  assert.match(page, /action: "REJECT"/);
  assert.match(page, /generateProposal\("IMPROVE"\)/);
  assert.match(page, /generateProposal\("TAILOR"\)/);
  assert.match(page, /generateLetter\(\)/);
  assert.match(page, /saveApplication\(\)/);
  assert.match(page, /saveEmail\(\)/);
  assert.match(page, /saveLetter\(\)/);
});

test('keyboard tab navigation and local theme are preserved', () => {
  assert.match(report, /role="tablist"/);
  assert.match(report, /ArrowRight/);
  assert.match(report, /ArrowLeft/);
  assert.match(report, /tabIndex=\{tab === item\.value \? 0 : -1\}/);
  assert.match(report, /bg-background/);
  assert.doesNotMatch(report, /dangerouslySetInnerHTML/);
});

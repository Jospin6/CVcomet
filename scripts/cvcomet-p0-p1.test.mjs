import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankJobs } from '../src/lib/find-jobs/ranking.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const job = (title, skills, options = {}) => ({
  id: title, title, skills, description: title + ' ' + skills.join(' '),
  company: 'Employer', provider: 'LEVER', externalId: title,
  location: null, remote: null, contractType: null, seniority: null,
  eligibleCountries: [], ...options,
});

test('ranking prefers the user’s professional field over unrelated jobs', () => {
  const results = rankJobs([
    job('Senior Software Engineer', ['typescript', 'react']),
    job('Customer Support Representative', ['zendesk', 'crm']),
  ], { targetJobTitle: 'Customer Support Specialist', targetIndustry: 'Customer Service', skills: 'zendesk crm communication', experienceLevel: 'junior' });
  assert.equal(results[0].title, 'Customer Support Representative');
  assert.equal(results[0].match.relevant, true);
  assert.equal(results.find(x => x.title === 'Senior Software Engineer').match.relevant, false);
  assert.ok(results[0].match.score > results[1].match.score);
});

test('ranking distinguishes location restrictions and does not claim employment eligibility', () => {
  const results = rankJobs([
    job('Customer Support', ['zendesk'], { eligibleCountries: ['US'], remote: true }),
    job('Customer Support', ['zendesk'], { eligibleCountries: ['Worldwide'], remote: true, id: 'global' }),
  ], { targetJobTitle: 'Customer Support', skills: 'zendesk', targetCountry: 'CD', preferredWorkMode: 'remote' });
  assert.equal(results.find(x => x.id === 'global').match.relevant, true);
  assert.equal(results.find(x => x.id !== 'global').match.relevant, false);
  assert.ok(results.find(x => x.id !== 'global').match.warnings.length > 0);
});

test('imported documents require explicit reviewed creation and owner-scoped lookup', () => {
  const route = read('src/app/api/resume-documents/[id]/convert/route.ts');
  const form = read('src/app/dashboard/resumes/import/[id]/page.tsx');
  for (const fragment of ['uploadedResume.findFirst', 'userId: actor.id', 'extractionSchema.parse(body.extracted)', 'action === "confirm"', 'assertTrustedWriteOrigin(req)', 'original.id']) assert.ok(route.includes(fragment), fragment);
  assert.ok(form.includes('setConfirmed(false)'));
  assert.ok(form.includes('action: "preview"'));
  assert.ok(form.includes('action: "confirm"'));
  assert.ok(form.includes('coverLetterId: null'));
});

test('template letters validate owned CV, job, and application before linking', () => {
  const route = read('src/app/api/cover-letters/from-template/route.ts');
  for (const fragment of ['catalogById.get(body.templateId)', 'conversation: { userId: actor.id }', 'userId: actor.id', 'APPLICATION_CONTEXT_MISMATCH', 'assertTrustedWriteOrigin(req)', 'coverLetterId: created.id']) assert.ok(route.includes(fragment), fragment);
  const page = read('src/components/resumes/cover-letters-page.tsx');
  for (const fragment of ['params.get("template")', 'params.get("applicationId")', 'params.get("cvId")', 'params.get("jobId")', '/api/cover-letters/from-template']) assert.ok(page.includes(fragment), fragment);
});

test('app workspace navigation preserves context in satellite tools', () => {
  const files = [
    'src/app/dashboard/applications/[id]/page.tsx',
    'src/app/dashboard/job-match/page.tsx',
    'src/app/dashboard/application-agent/page.tsx',
    'src/app/dashboard/interviews/page.tsx',
    'src/components/resumes/resume-studio.tsx',
    'src/components/resumes/cover-letter-studio.tsx',
  ];
  for (const file of files) assert.ok(read(file).includes('applicationId'), file);
});

test('draft actions are server-owned, require distinct approval, and cannot send applications', () => {
  const propose = read('src/lib/career-os/application-drafts.ts');
  const create = read('src/app/api/career/v1/agent/drafts/route.ts');
  const decide = read('src/app/api/career/v1/agent/drafts/decision/route.ts');
  const ui = read('src/app/dashboard/assistant/page.tsx');
  for (const token of ['ownedApplication(userId, applicationId)', 'proposeResumeAI', 'proposeCoverLetterAI', 'decideResumeAI', 'decideCoverLetterAI']) assert.ok(propose.includes(token), token);
  assert.ok(create.includes('assertTrustedWriteOrigin(req)'));
  assert.ok(decide.includes('assertTrustedWriteOrigin(req)'));
  assert.ok(decide.includes('action: z.enum(["accept", "discard"])'));
  assert.ok(ui.includes('draftReviewed'));
  assert.ok(ui.includes('requestedDocument(question)'));
  assert.ok(ui.includes('setDraftInstruction(question)'));
  assert.ok(ui.includes('Voir la proposition'));
  assert.ok(!propose.includes('sendApplication('));
});

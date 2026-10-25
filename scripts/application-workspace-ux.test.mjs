import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applicationStatusLabel, applicationStageIndex } from '../src/lib/career/application-workspace.ts';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('localized application steps do not invent a status', () => {
  assert.equal(applicationStatusLabel('SAVED'), 'Enregistrée');
  assert.equal(applicationStatusLabel('TECHNICAL_INTERVIEW'), 'Entretien technique');
  assert.equal(applicationStatusLabel('UNRECOGNIZED'), 'Statut inconnu');
  assert.equal(applicationStageIndex('TECHNICAL_INTERVIEW'), 2);
  assert.equal(applicationStageIndex('REJECTED'), -1);
});
test('application workspace contains the five contextual pillars', () => {
  const content = read('src/app/dashboard/applications/[id]/page.tsx');
  for (const id of ['overview', 'documents', 'analysis', 'interviews', 'activity']) {
    assert.match(content, new RegExp(`id: "${id}"`));
  }
  assert.match(content, /\/api\/applications\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(content, /api\/career\/v1\/application-packets\/options/);
  assert.match(content, /applicationStatusLabel/);
  assert.match(content, /aria-selected/);
  assert.match(content, /nextAction/);
  assert.match(content, /type="datetime-local"/);
  assert.match(content, /jobId:selectedJob/);
});
test('owner-scoped association of CV, letter and analysed job', () => {
  const content = read('src/app/api/applications/[id]/route.ts');
  assert.match(content, /userId: u\.id/);
  assert.match(content, /JOB_NOT_FOUND/);
  assert.match(content, /CV_NOT_FOUND/);
  assert.match(content, /LETTER_NOT_FOUND/);
  assert.match(content, /job\.userId !== u\.id/);
  assert.match(content, /Prisma\.DbNull/);
});
test('job match is allowed to create one owned application', () => {
  const content = read('src/app/api/applications/route.ts');
  assert.match(content, /jobId:z\.string\(\)\.uuid\(\)\.optional/);
  assert.match(content, /prisma\.jobOpportunity\.findFirst/);
  assert.match(content, /JOB_NOT_FOUND/);
  assert.match(read('src/app/dashboard/job-match/page.tsx'), /"\/dashboard\/applications\/" \+ applicationId/);
  assert.match(read('src/app/dashboard/job-match/page.tsx'), /application-agent\?jobId=/);
  assert.match(read('src/app/dashboard/job-match/page.tsx'), /applicationCvId/);
});
test('new applications start from an analysed job description and reuse an existing workspace', () => {
  const page = read('src/app/dashboard/applications/page.tsx');
  const intake = read('src/components/career/application-intake.tsx');
  const api = read('src/app/api/applications/route.ts');
  assert.match(page, /ApplicationIntake/);
  assert.match(intake, /showResumeSelection=\{false\}/);
  assert.match(intake, /reopenExisting: true/);
  assert.match(intake, /Analyze this job|Analyser cette offre/);
  assert.match(api, /reopenExisting:z\.boolean\(\)\.optional/);
  assert.match(api, /reused: true/);
});
test('job-document intake accepts text, PDF and DOCX without trusting the file contents', () => {
  const input = read('src/lib/career/job-input.ts');
  const form = read('src/components/career/job-analysis-form.tsx');
  assert.match(input, /mammoth/);
  assert.match(input, /endsWith\("\.docx"\)/);
  assert.match(input, /endsWith\("\.txt"\)/);
  assert.match(form, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(form, /text\/plain/);
});
test('overview keeps advanced tools available but collapsed', () => {
  const content = read('src/app/page.tsx');
  assert.match(content, /<details/);
  assert.match(content, /JobAnalysisForm form=\{jobForm\}/);
  assert.match(content, /ResumeCards documents=/);
  assert.match(read('src/components/career/career-command-center.tsx'), /RecentApplications/);
});
test('no automatic employer submission from the workspace', () => {
  const content = read('src/app/dashboard/applications/[id]/page.tsx');
  assert.doesNotMatch(content, /fetch\([^\n]+\b(send-email|submit-application)\b/i);
  assert.match(read('src/app/dashboard/application-agent/page.tsx'), /seededContext/);
  assert.match(read('src/app/dashboard/interviews/page.tsx'), /applicationId/);
});

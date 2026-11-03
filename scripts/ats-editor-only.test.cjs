// ATS editor, two-mode, linked-application and partial-failure regression tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const panel = read('src/components/resumes/resume-ats-panel.tsx');
const picker = read('src/components/resumes/resume-ats-job-picker.tsx');
const api = read('src/app/api/ats/route.ts');
const application = read('src/app/api/applications/route.ts');
const applicationContext = read('src/lib/career/ats-application-context.ts');
const contextRoute = read('src/app/api/cvs/[id]/ats-context/route.ts');
const extraction = read('src/lib/career/ats-letter-input.ts');
const letterRoute = read('src/app/api/ats/letter/extract/route.ts');
const forms = read('src/components/career/application-intake.tsx');
const findJobs = read('src/app/dashboard/find-jobs/page.tsx');

test('ATS exists in the resume editor and no standalone sidebar/page link is reintroduced', () => {
  const nav = read('src/components/shell/navigation.ts');
  assert.doesNotMatch(nav, /\/dashboard\/ats/);
  assert.doesNotMatch(panel, /\/dashboard\/ats/);
  assert.match(panel, /studio-ats-panel/);
});

test('Two explicit ATS modes, general and job-specific, use the visible edited resume', () => {
  assert.match(panel, /useState<"general" \| "job">/);
  assert.match(panel, /ResumePDF resume=\{snapshot\.resume\}/);
  assert.match(panel, /mode: snapshot\.mode, draft: snapshot\.resume/);
  assert.match(api, /mode: z\.enum\(\["general", "job"\]\)/);
  assert.match(api, /General ATS assessment cannot include a job posting/);
  assert.match(api, /Choose exactly one application, saved posting or job description/);
});

test('An owned linked application resolves its CV, original JD and its cover letter server-side', () => {
  assert.match(applicationContext, /where: \{ userId, cvId/);
  assert.match(applicationContext, /candidate\.conversation\.userId === userId/);
  assert.match(applicationContext, /candidate\.cvId === cvId/);
  assert.match(applicationContext, /APPLICATION_JOB_DESCRIPTION_REQUIRED/);
  assert.match(contextRoute, /findResumeApplications\(user\.id, id\)/);
  assert.match(api, /resumeApplicationContext\(user\.id, cv\.id, body\.applicationId\)/);
  assert.doesNotMatch(contextRoute, /introduction:|body:.*letterText/);
});

test('Without application the user may paste a letter, import file or provide HTTPS URL', () => {
  assert.match(panel, /Cover letter \(optional\)/);
  assert.match(panel, /"text", "url", "upload"/);
  assert.match(panel, /\/api\/ats\/letter\/extract/);
  assert.match(letterRoute, /profileFormData\(/);
  assert.match(extraction, /assertPublicUrl\(raw\)/);
  assert.match(extraction, /destination\.url\.protocol !== "https:"/);
  assert.match(extraction, /lookup:/);
  assert.match(extraction, /MAX_BYTES/);
  assert.match(extraction, /extractPDFText/);
});

test('Letter is supplementary and never produces evidence or an inflated ATS score', () => {
  assert.match(api, /never becomes CV evidence/);
  assert.match(api, /report\.supportingLetter/);
  assert.match(api, /letterHash:/);
  assert.doesNotMatch(api, /input: \{[^}]*letterText/);
  assert.match(panel, /context; it does not prove resume skills/);
});

test('Graph or PDF errors may return partial deterministic analysis, not fake scores', () => {
  assert.match(api, /analyzeResume\(resume/);
  assert.match(api, /ATS_ENGINE_UNAVAILABLE/);
  assert.match(api, /PDF_UNAVAILABLE/);
  assert.match(api, /jobMatch: \{ status: "UNAVAILABLE", score: null/);
  assert.match(panel, /analysis\.diagnostics/);
  assert.match(panel, /DATABASE_UNAVAILABLE/);
});

test('New applications require an owned resume and full saved job description', () => {
  assert.match(application, /APPLICATION_CV_REQUIRED/);
  assert.match(application, /APPLICATION_JOB_DESCRIPTION_REQUIRED/);
  assert.match(application, /RESUME_NOT_FOUND/);
  assert.match(forms, /showResumeSelection=\{true\}/);
  assert.match(forms, /cvId: form\.cvId/);
  assert.match(findJobs, /setPendingPrepare/);
  assert.match(findJobs, /cvId,/);
});

test('Compact ATS result: only first 3 issues and extra detail on request', () => {
  assert.match(panel, /issues\.slice\(0, 3\)/);
  assert.match(panel, /issues\.slice\(3\)/);
  assert.match(panel, /View assessment details/);
  assert.match(panel, /analysis\.jobMatch\.status === "COMPLETE"/);
  assert.match(panel, /analysis\.technical\.status === "VERIFIED"/);
  assert.match(picker, /onSelect: \(_job: SavedJobSummary \| null\) => void/);
  assert.match(panel, /const chooseJob = \(job: SavedJobSummary \| null\)/);
});

test('All changed TS/TSX files have valid parser syntax', () => {
  let ts;
  try { ts = require('typescript'); }
  catch { try { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
    catch { return; /* npm run typecheck on installed Windows project */ } }
  const files = [
    'src/components/resumes/resume-ats-panel.tsx', 'src/app/api/ats/route.ts',
    'src/app/api/cvs/[id]/ats-context/route.ts', 'src/lib/career/ats-application-context.ts',
    'src/lib/career/ats-letter-input.ts', 'src/app/api/ats/letter/extract/route.ts',
    'src/lib/career/ats-types.ts', 'src/app/api/applications/route.ts',
    'src/components/career/application-intake.tsx', 'src/app/dashboard/find-jobs/page.tsx',
    'src/app/dashboard/job-match/page.tsx',
  ];
  for (const file of files) {
    const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.deepEqual(tree.parseDiagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, ' ')), [], file);
  }
});

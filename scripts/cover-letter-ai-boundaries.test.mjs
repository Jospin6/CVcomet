import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('letter assistant route creates proposal, never writes directly to letters',()=>{
  const s=read('src/app/api/cover-letters/[id]/assistant/route.ts');
  assert.match(s,/proposeCoverLetterAI\(/);
  assert.doesNotMatch(s,/coverLetter\.update\(|coverLetter\.updateMany\(/);
});
test('decision endpoint requires authenticated origin, explicit action and bounded body',()=>{
  const s=read('src/app/api/cover-letters/[id]/assistant/decision/route.ts');
  for (const p of [/assertTrustedWriteOrigin\(req\)/,/getSessionUser\(\)/,/profileJson\(req, 4 \* 1024\)/,/decideCoverLetterAI\(user\.id/]) assert.match(s,p);
});
test('approval is atomic, verifies ownership, revision and evidence still confirmed',()=>{
  const s=read('src/lib/cover-letter-ai/proposal-service.ts');
  for (const p of [/\$transaction\(/,/conversation: \{ userId \}/,/letterProposalIsApplicable\(/,/evidenceRevisions/,/status: "CONFIRMED"/,/revision: proposal\.baseRevision/,/coverLetter\.updateMany\(/]) assert.match(s,p);
});
test('generation uses the account profile and existing letter, without querying the old vault',()=>{
  const s=read('src/app/api/cover-letters/[id]/assistant/route.ts');
  assert.match(s,/getProfileFacts\(user\.id/);
  assert.doesNotMatch(s,/careerEvidence\.findMany/);
  assert.match(s,/lockLetterIdentity\(/);
});
test('studio compares and approves a proposal rather than committing model output',()=>{
  const s=read('src/components/resumes/cover-letter-studio.tsx');
  assert.match(s,/decideAI\("accept"\)/);
  assert.match(s,/decideAI\("discard"\)/);
  assert.match(s,/pendingAI\.diff\.map/);
  const ask = s.slice(s.indexOf('const ask = async'),s.indexOf('const decideAI = async'));
  assert.doesNotMatch(ask,/data\.document|setDocument\(next\)/);
});
test('existing cover letter SAVE increments revision to invalidate outstanding drafts',()=>{
  assert.match(read('src/lib/career/job-documents.ts'),/prisma\.coverLetter\.update\([\s\S]{0,150}revision: \{ increment: 1 \}/);
});
test('migration has both cascades and indexes',()=>{
  const m=read('prisma/migrations/20261024210000_cover_letter_ai_proposals/migration.sql');
  assert.match(m,/REFERENCES "CoverLetter"\("id"\) ON DELETE CASCADE/);
  assert.match(m,/REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  assert.match(m,/CREATE INDEX "CoverLetterAIProposal_userId_letterId_status_idx"/);
});

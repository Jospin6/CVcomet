import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = p => fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('assistant proposal route never directly mutates Cv or inserts resume version',()=>{
  const code=read('src/app/api/cvs/[id]/assistant/route.ts');
  assert.match(code,/proposeResumeAI/);
  assert.doesNotMatch(code,/\.cv\.updateMany|\.resumeVersion\.create/);
});
test('decision endpoint requires origin guard and session identity',()=>{
  const code=read('src/app/api/cvs/[id]/assistant/decision/route.ts');
  assert.match(code,/assertTrustedWriteOrigin\(req\)/);
  assert.match(code,/getSessionUser\(\)/);
  assert.match(code,/decideResumeAI\(user\.id/);
});
test('approval transaction checks owner, revision, expiry and evidence still confirmed',()=>{
  const code=read('src/lib/resume-ai/proposal-service.ts');
  for (const pattern of [/\$transaction\(/,/userId, cvId/,/proposalIsApplicable\(/,/evidenceRevisions/,/status: "CONFIRMED"/,/revision: proposal\.baseRevision/,/resumeVersion\.create/]) assert.match(code,pattern);
});
test('chat has explicit approval/discard instead of directly updating from AI preview',()=>{
  const code=read('src/components/resumes/resume-studio.tsx');
  assert.match(code,/decideConversation\("accept"\)/);
  assert.match(code,/decideConversation\("discard"\)/);
  assert.match(code,/pendingAI\.diff\.map/);
  const chatOnly = code.slice(code.indexOf('const sendConversation ='), code.indexOf('const decideConversation ='));
  assert.doesNotMatch(chatOnly, /data\.document/); // only a later explicit decision can persist
});
test('single-field generator consults the owner profile rather than the retired vault',()=>{
  const code=read('src/app/api/resume-ai/route.ts');
  assert.match(code,/getCareerProfile\(user\.id\)/);
  assert.match(code,/profileFacts\(profile\)/);
  assert.doesNotMatch(code,/careerEvidence\.findMany/);
  assert.match(code,/unsupportedNumericClaims/);
});

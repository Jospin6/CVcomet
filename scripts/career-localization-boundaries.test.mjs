import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('countries are schema-validated and stored in existing JSON design objects', () => {
  for (const path of ['src/lib/resume-editor.ts','src/lib/cover-letter-editor.ts']) {
    const s = read(path);
    assert.match(s,/targetMarket: z\.enum\(targetMarkets\)\.default\("GLOBAL"\)/);
    assert.match(s,/documentLanguage: z\.enum\(documentLanguages\)\.default\("auto"\)/);
  }
});
test('market policy is consumed by both conversational proposals and single-field AI', () => {
  for (const path of ['src/lib/resume-conversation-ai.ts','src/app/api/resume-ai/route.ts','src/app/api/cover-letters/[id]/assistant/route.ts']) assert.match(read(path),/marketPrompt\(/);
  assert.match(read('src/app/api/resume-ai/route.ts'),/storedCV\.design/);
  assert.match(read('src/app/api/cvs/[id]/assistant/route.ts'),/conversation: \{ userId: user\.id \}/);
});
test('user country and writing language controls exist in both studios and preserve owner choice', () => {
  for (const path of ['src/components/resumes/resume-studio.tsx','src/components/resumes/cover-letter-studio.tsx']) {
    const s = read(path);
    assert.match(s,/<CareerMarketPanel/);
    assert.match(s,/recommendedPaper\(targetMarket\)/);
    assert.match(s,/design\("documentLanguage", value\)/);
  }
  const letter = read('src/app/api/cover-letters/[id]/assistant/route.ts');
  assert.match(letter,/targetMarket: document\.design\.targetMarket/);
  assert.match(letter,/paper: document\.design\.paper/);
});
test('DOCX and both PDF exports respect selected paper and language', () => {
  const docx = read('src/lib/resume-export/docx.ts');
  assert.match(docx,/language: "fr" \| "en" \| "de"/);
  assert.match(docx,/language === "de"/);
  assert.match(read('src/app/api/cvs/[id]/export/docx/route.ts'),/resolveDocumentLanguage/);
  for (const path of ['src/components/resumes/resume-pdf.tsx','src/components/resumes/cover-letter-pdf.tsx']) {
    assert.match(read(path),/size=\{design\.paper\}/);
  }
  assert.match(read('src/lib/resume-editor.ts'),/resumePaperDimensions\(resume\.design\.paper\)/);
});
test('generation reads locale from owned CV context and does not use job requirements as candidate facts',()=>{
  assert.match(read('src/lib/career/job-documents.ts'),/resume\?\.design\.targetMarket/);
  assert.match(read('src/lib/career/job-documents.ts'),/fingerprint, localization/);
  assert.match(read('src/lib/career/job-documents.ts'),/assertDocumentFacts/);
  assert.match(read('src/app/api/cover-letters/[id]/assistant/route.ts'),/getProfileFacts\(user\.id/);
});

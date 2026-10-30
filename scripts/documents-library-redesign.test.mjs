import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const ui = read("src/components/resumes/documents-page.tsx");
const resume = read("src/components/resumes/resume-library.tsx");
const letters = read("src/app/api/cover-letters/route.ts");
const resignation = read("src/app/api/resignation-letters/route.ts");
const item = read("src/app/api/resignation-letters/[id]/route.ts");
const schema = read("prisma/schema.prisma");
const editor = read("src/app/dashboard/resignation-letters/[id]/page.tsx");

test("documents has three accessible tabs without unused website tab", () => {
  assert.match(ui, /id: "resumes"/);
  assert.match(ui, /id: "letters"/);
  assert.match(ui, /id: "resignations"/);
  assert.doesNotMatch(ui, /id: "websites"/);
  assert.match(ui, /aria-selected={tab === item.id}/);
});

test("document cards are compact, use real data, keep existing upload and context", () => {
  assert.match(ui, /<ResumeCards documents=\{documents\} loading=\{loading\} compact/);
  assert.match(resume, /if \(compact\) return \(/);
  assert.match(ui, /fetch\("\/api\/resume-documents"/);
  assert.match(ui, /fetch\("\/api\/cvs"/);
  assert.match(ui, /\/dashboard\/cover-letters/);
  assert.match(ui, /\/dashboard\/resignation-letters/);
  assert.match(ui, /setLinkedinOpen\(true\)/);
  assert.doesNotMatch(ui, /fakeCoverLetters|mockLetters|dummyLetters/);
});

test("letter listing authorizes ownership and returns only real data", () => {
  assert.match(letters, /getSessionUser\(\)/);
  assert.match(letters, /conversation: \{ userId: actor\.id \}/);
  assert.match(letters, /orderBy: \{ updatedAt: "desc" \}/);
  assert.match(letters, /export async function POST/);
  assert.match(letters, /assertTrustedWriteOrigin\(request\)/);
  assert.match(ui, /createBlankCoverLetter/);
});

test("resignation documents are owned by their user with safe create, update and delete", () => {
  assert.match(schema, /model ResignationLetter/);
  assert.match(schema, /userId\s+String/);
  assert.match(resignation, /userId: user\.id/);
  assert.match(resignation, /assertTrustedWriteOrigin\(request\)/);
  assert.match(item, /where: \{ id, userId: user\.id, revision \}/);
  assert.match(item, /assertTrustedWriteOrigin\(request\)/);
  assert.match(item, /deleteMany/);
  assert.match(editor, /Download text/);
  assert.match(editor, /Unsaved changes/);
});

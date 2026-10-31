import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(path.join(root, file), "utf8");
const modes = read("src/components/resumes/studio-ai-modes.tsx");
const resume = read("src/components/resumes/resume-studio.tsx");
const letter = read("src/components/resumes/cover-letter-studio.tsx");
const resumeAPI = read("src/app/api/cvs/[id]/assistant/route.ts");
const letterAPI = read("src/app/api/cover-letters/[id]/assistant/route.ts");
const styles = read("src/components/resumes/resume-editor.css");

test("small Chat / Selected text tabs remain within Open tools", () => {
  assert.match(modes, /StudioAIModes/);
  assert.match(modes, /studio-ai-mode-tabs/);
  assert.match(modes, /Selected text/);
  assert.match(modes, /role="tab"/);
  assert.match(resume, /<StudioAIModes/);
  assert.match(letter, /<StudioAIModes/);
  assert.match(styles, /\.studio-ai-mode-content/);
});

test("selected excerpt comes from actual document content, not a user-entered claim", () => {
  assert.match(modes, /window\.getSelection\(\)/);
  assert.match(modes, /start !== end/);
  assert.match(modes, /root\.contains\(start\)/);
  assert.match(resume, /fieldValue\(resume, selected\)/);
  assert.match(letter, /document\?\.\[selected\]/);
  assert.match(modes, /studio-selected-quote/);
});

test("CV and cover-letter focused edits use existing proposal/approval flow", () => {
  assert.match(resume, /targetField: field/);
  assert.match(letter, /targetField/);
  assert.match(resume, /decideConversation\("accept"\)/);
  assert.match(letter, /decideAI\("accept"\)/);
  assert.match(modes, /scopedEditInstruction/);
});

test("server refuses edits outside the targeted CV field", () => {
  assert.match(resumeAPI, /resumeConversationFields\(document\)/);
  assert.match(resumeAPI, /edit\.type === "setField" && edit\.path === input\.targetField/);
  assert.match(resumeAPI, /applyResumeConversationEdits\(document, focusedEdits\)/);
  assert.match(resumeAPI, /INVALID_FIELD/);
});

test("server locks targeted letter edits to one text paragraph", () => {
  assert.match(letterAPI, /targetField: z\.enum\(\["introduction", "body", "conclusion"\]\)/);
  assert.match(letterAPI, /\[body\.targetField\]: edited\[body\.targetField\]/);
  assert.match(letterAPI, /\.\.\.document,/);
  assert.match(letter, /cannotEditField/);
});

test("editing canvas remains unmodified by this patch", () => {
  assert.doesNotMatch(styles.slice(styles.indexOf("\/\* Assistant's inner tabs only")), /\.resume-editable/);
  assert.match(resume, /<EditableResumeCanvas/);
  assert.match(letter, /<LetterField/);
});


test("focused assistants retain the profile-only architecture", () => {
  assert.match(resumeAPI, /getProfileFacts/);
  assert.match(letterAPI, /getProfileFacts/);
  assert.doesNotMatch(resumeAPI, /careerEvidence\.findMany/);
  assert.doesNotMatch(letterAPI, /careerEvidence\.findMany/);
});

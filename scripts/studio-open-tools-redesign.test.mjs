import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const resume = read("src/components/resumes/resume-studio.tsx");
const letter = read("src/components/resumes/cover-letter-studio.tsx");
const picker = read("src/components/resumes/studio-template-picker.tsx");
const conversation = read("src/components/resumes/studio-conversation.tsx");
const ats = read("src/components/resumes/resume-ats-panel.tsx");
const market = read("src/components/resumes/career-market-panel.tsx");
const design = read("src/lib/cover-letter-editor.ts");

test("real template previews with inspect-before-apply, in-place see more", () => {
  assert.match(picker, /<TemplatePreview template=\{template\}/);
  assert.match(picker, /<TemplatePreview template=\{inspected\} large/);
  assert.match(picker, /setExpanded\(\(value\) => !value\)/);
  assert.match(picker, /onSelect\(inspected\)/);
  assert.match(picker, /\.slice\(0, limit\)/);
});

test("CV applies actual template metadata, section order and visual styles", () => {
  assert.match(resume, /templateId: template\.id/);
  assert.match(resume, /sectionOrder:/);
  assert.match(resume, /layout: template\.layout/);
  assert.match(resume, /font: template\.font/);
  assert.doesNotMatch(resume, /Studio catalogue/);
});

test("cover letter applies and persists the selected template", () => {
  assert.match(letter, /kind="COVER_LETTER"/);
  assert.match(letter, /templateId: template\.id/);
  assert.match(design, /templateId: z\.string\(\)/);
});

test("market settings are minimal and live at the end of the design controls", () => {
  assert.ok(resume.indexOf("<StudioTemplatePicker") < resume.indexOf("<CareerMarketPanel"));
  assert.ok(letter.indexOf("<StudioTemplatePicker") < letter.indexOf("<CareerMarketPanel"));
  assert.doesNotMatch(market, /Advisory guidance|Editorial guidance|policy\.guidance/);
});

test("only one AI conversation surface, fixed composer and explicit approval", () => {
  assert.match(conversation, /studio-chat-composer/);
  assert.match(conversation, /studio-chat-messages/);
  assert.match(resume, /decideConversation\("accept"\)/);
  assert.match(letter, /decideAI\("accept"\)/);
  assert.doesNotMatch(resume, /\{c\.notesHint\}|\{c\.action\}/);
});

test("ATS leads with visual metrics and prioritised recommendations", () => {
  assert.match(ats, /studio-ats-visual-scores/);
  assert.match(ats, /role="progressbar"/);
  assert.match(ats, /issues\.slice\(0, 3\)/);
  assert.match(ats, /studio-ats-details/);
  assert.match(ats, /item\.score === null/);
});

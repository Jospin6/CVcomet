import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applicationStatusLabel,
  applicationStageIndex,
} from "../src/lib/career/application-workspace.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workspace = read("src/app/dashboard/applications/[id]/page.tsx");
const agent = read("src/app/dashboard/application-agent/page.tsx");
const picker = read("src/components/applications/application-documents.tsx");
const match = read("src/app/dashboard/job-match/page.tsx");
const matchApi = read("src/app/api/job-match/route.ts");
const applicationsApi = read("src/app/api/applications/[id]/route.ts");

// Existing status mapping must remain intact after the new navigation.
test("application status chronology stays explicit", () => {
  assert.equal(applicationStatusLabel("SAVED"), "Enregistrée");
  assert.equal(applicationStatusLabel("TECHNICAL_INTERVIEW"), "Entretien technique");
  assert.equal(applicationStageIndex("TECHNICAL_INTERVIEW"), 2);
});

test("application has five small contextual tabs without the redundant overview blocks", () => {
  for (const id of ["overview", "documents", "analysis", "interviews", "activity"]) {
    assert.match(workspace, new RegExp(`id: "${id}"`));
  }
  assert.match(workspace, /role="tabpanel"/);
  assert.doesNotMatch(workspace, /À retenir|Prochaine étape<|Offre de référence/);
});

test("linked documents use a visual, owned-document picker instead of select dropdowns", () => {
  assert.match(workspace, /<ApplicationDocuments/);
  assert.match(agent, /<ApplicationDocuments/);
  assert.match(picker, /AtsResumePreview/);
  assert.match(picker, /LetterPaper/);
  assert.match(picker, /<Dialog/);
  assert.match(picker, /Sélectionner/);
  assert.doesNotMatch(workspace, /selectedCv|selectedLetter|<option value="">Aucun CV/);
  assert.doesNotMatch(agent, /Choisir une offre|Choisir un CV/);
});

test("application job identity is immutable and all links remain owner-scoped", () => {
  assert.match(applicationsApi, /APPLICATION_JOB_IMMUTABLE/);
  assert.match(applicationsApi, /userId: u\.id/);
  assert.match(applicationsApi, /CV_NOT_FOUND/);
  assert.match(applicationsApi, /LETTER_CONTEXT_MISMATCH/);
  assert.doesNotMatch(workspace, /jobId:selectedJob/);
});

test("job analysis entry preloads the application JD and selected CV, no wizard", () => {
  assert.match(workspace, /\/dashboard\/job-match\?\$\{context\}/);
  assert.match(workspace, /app\.job\.description\.trim\(\)\.length/);
  assert.match(match, /applicationId: appId/);
  assert.match(match, /text: app\.job\.description/);
  assert.match(match, /setWizardOpen\(false\)/);
  assert.match(matchApi, /applicationJobId:/);
  assert.match(matchApi, /application\?\.job\?\.description \?\? body\.text/);
  assert.match(matchApi, /tx\.jobOpportunity\.update/);
});

test("ATS uses the linked CV; user can run or rerun it", () => {
  assert.match(workspace, /\?ats=1&\$\{context\}/);
  assert.match(workspace, /Vérifier ou refaire l'analyse ATS/);
});

test("agent shows document, email and approval tabs, with controlled actions", () => {
  for (const name of ["documents", "email", "approval", "history"]) {
    assert.match(agent, new RegExp(`id: "${name}"`));
  }
  assert.match(agent, /active\.sourceChanged/);
  assert.match(agent, /reviewed/);
  assert.match(agent, /onClick=\{\(\) => void decide\("approve"\)\}/);
  assert.doesNotMatch(agent, /sendMail\(|resend\.emails|submit-application/);
});

test("notes don't start with source URLs and autosize when typed", () => {
  const findJobs = read("src/app/dashboard/find-jobs/page.tsx");
  assert.doesNotMatch(findJobs, /notes: `Original offer:/);
  assert.match(workspace, /Original offer:/);
  assert.match(workspace, /field\.scrollHeight/);
  assert.match(workspace, /setNotes\(userNotes\(value\.notes\)\)/);
});

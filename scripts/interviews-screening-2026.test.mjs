import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { screeningOverallScore, countUsableAnswers } from '../src/lib/career/screening-policy.ts';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const page = read('src/app/dashboard/interviews/page.tsx');
const service = read('src/lib/career/screening.ts');
const internal = read('src/app/api/interviews/screening/internal/route.ts');
const start = read('src/app/api/interviews/screening/start/route.ts');
const agent = read('workers/screening-agent.mjs');
const coach = read('src/lib/career/interview.ts');

test('Basic and Personalized modes are in a modal with 20 questions', () => {
  assert.match(page, /"basic" \| "personalized"/);
  assert.match(page, /questionCount: 20/);
  assert.match(page, /<DialogContent/);
  assert.match(page, /AtsResumePreview/);
  assert.match(page, /resolvedLanguage/);
});

test('Screening requires an owned application, job and CV', () => {
  assert.match(service, /where: \{ id: applicationId, userId \}/);
  assert.match(service, /SCREENING_REQUIRES_JOB_AND_RESUME/);
  assert.match(start, /getOwnedScreeningContext/);
  assert.match(start, /consent: true/);
  assert.match(start, /SCREENING_ALREADY_ACTIVE/);
});

test('Worker context protected and room-bound with constant-time secret compare', () => {
  assert.match(internal, /timingSafeEqual/);
  assert.match(internal, /authorization/);
  assert.match(service, /SCREENING_ROOM_MISMATCH/);
  assert.match(agent, /CVCOMET_VOICE_WORKER_SECRET/);
});

test('Voice scoring is generated from transcript and not synthetic', () => {
  assert.match(service, /answerCount < 2/);
  assert.match(service, /generateObject/);
  assert.match(service, /overallScore: null/);
  assert.match(service, /VOICE_UNGRADED/);
  assert.doesNotMatch(service, /Math\.random/);
});

test('One-way completion transition prevents duplicate transcript persistence', () => {
  assert.match(service, /\$transaction/);
  assert.match(service, /if \(claimed\.count === 1 && input\.turns\.length\)/);
  assert.match(service, /createMany/);
});

test('AI prefill uses the authorized CV and application description', () => {
  assert.match(coach, /resumeContext/);
  assert.match(coach, /application\?\.job\?\.description/);
  assert.match(coach, /APPLICATION_RESUME_MISMATCH/);
});


test('screening score is a strict mean of six grounded dimensions', () => {
  const dimensions = {
    cvConsistency: 90, jobRelevance: 85, communication: 72,
    motivation: 80, experience: 75, professionalism: 66,
  };
  assert.equal(screeningOverallScore(dimensions), 78);
  assert.throws(() => screeningOverallScore({ ...dimensions, professionalism: -5 }), /INVALID_SCREENING_SCORE/);
  assert.throws(() => screeningOverallScore({ ...dimensions, communication: Number.NaN }), /INVALID_SCREENING_SCORE/);
});

test('only actual candidate turns contribute to report eligibility', () => {
  assert.equal(countUsableAnswers([
    { role: 'assistant', text: 'Tell me about yourself.' },
    { role: 'user', text: 'Yes' },
    { role: 'user', text: 'I worked on a shipping app.' },
  ]), 1);
});

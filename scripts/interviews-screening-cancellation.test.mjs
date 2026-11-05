import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { countUsableAnswers } from '../src/lib/career/screening-policy.ts';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const api = read('src/app/api/interviews/screening/[id]/end/route.ts');
const service = read('src/lib/career/screening.ts');
const page = read('src/app/dashboard/interviews/page.tsx');
const call = read('src/components/interviews/screening-call.tsx');

test('Hang-up cancels the persisted call rather than requesting a screening report', () => {
  assert.match(api, /action = "action" in raw \? raw\.action : "cancel"/);
  assert.match(api, /"VOICE_CANCELLED"/);
  assert.match(api, /action === "cancel"/);
  assert.match(api, /status: "VOICE_ENDING"/);
  assert.match(api, /api\.room\.deleteRoom\(cfg\.roomName\)/);
  assert.match(api, /where: \{ id, userId: user\.id/);
});

test('Worker can evaluate only a user-finished interview with usable answers', () => {
  assert.match(service, /if \(session\.status === "VOICE_ACTIVE"\)/);
  assert.match(service, /status: "VOICE_CANCELLED"/);
  assert.match(service, /if \(status !== "VOICE_ENDING"\)/);
  assert.match(service, /if \(countUsableAnswers\(input\.turns\) < 2\)/);
  assert.match(service, /where: \{ id: session\.id, status: "VOICE_ENDING" \}/);
  assert.match(service, /where: \{ id: session\.id, status: "VOICE_EVALUATING" \}/);
  assert.equal(countUsableAnswers([]), 0);
  assert.equal(countUsableAnswers([{ role: 'assistant', text: 'Welcome' }]), 0);
  assert.equal(countUsableAnswers([{ role: 'user', text: 'Hello' }]), 1);
});

test('Connection errors and disconnects cancel and return to history without report polling', () => {
  assert.match(call, /onError=\{\(\) => cancel\("error"\)\}/);
  assert.match(call, /onDisconnected=\{\(\) => cancel\("disconnected"\)\}/);
  assert.match(call, /void room\.disconnect\(\)/);
  assert.match(page, /setConnection\(null\)/);
  assert.match(page, /action: "cancel"/);
  assert.match(page, /action: "finish"/);
  assert.doesNotMatch(page, /setEndingId|voiceReportDelayed|3500/);
});

test('FR/EN localized messages exist for both controls and failure cases', () => {
  for (const lang of ['fr', 'en']) {
    const catalog = JSON.parse(read(`public/locales/${lang}/common.json`));
    for (const key of ['finishVoiceCall', 'finishAndReport', 'voiceCallCancelled', 'voiceConnectionFailed', 'voiceDisconnected']) {
      assert.ok(catalog.interviews[key]?.length > 4, `${lang}.${key}`);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/app/dashboard/assistant/page.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/components/shell/app-shell.tsx', import.meta.url), 'utf8');

test('chat replaces dashboard cards with a fixed viewport and independent message scrolling', () => {
  assert.match(ui, /h-full min-h-0 min-w-0 w-full overflow-hidden/);
  assert.match(ui, /ref=\{scrollRef\}/);
  assert.match(ui, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(ui, /shrink-0 px-3 pb-3 pt-2/);
  assert.match(ui, /max-w-\[780px\]/);
  assert.match(shell, /assistantPage/);
  assert.match(shell, /"flex min-h-0 min-w-0 flex-1 overflow-hidden"/);
  assert.match(shell, /!border-b-0/);
  assert.match(shell, /!assistantPage && <footer/);
});

test('chat removes requested interface clutter without altering theme tokens', () => {
  for (const removed of [
    'Missions sauvegardées', 'Conversation temporaire', 'Au maximum 30 missions',
    'Cette réponse était-elle utile', 'Votre carrière, vos documents',
    'Your career, documents', 'ThumbsUp', 'ThumbsDown', 'Archiver',
    'Mettre en archive',
  ]) assert.ok(!ui.includes(removed), `Unexpected legacy text: ${removed}`);
  assert.match(ui, /bg-background/);
  assert.match(ui, /bg-card/);
  assert.ok(!ui.includes('#ffffff'));
});

test('new chat saves on first message and retains safe replay keys', () => {
  assert.match(ui, /title: question.slice\(0, 100\)/);
  assert.match(ui, /\/api\/career\/v1\/missions/);
  assert.match(ui, /crypto.randomUUID\(\)/);
  assert.match(ui, /openMission\(missionId\)/);
  assert.match(ui, /requestKey/);
  assert.match(ui, /newChat\(\)/);
});

test('chat composer supports enter, shift-enter, auto-sizing and disabling while busy', () => {
  assert.match(ui, /event.key === "Enter" && !event.shiftKey/);
  assert.match(ui, /event.nativeEvent.isComposing/);
  assert.match(ui, /Math.min\(textarea.scrollHeight, 176\)/);
  assert.match(ui, /disabled=\{!canSend\}/);
});

test('document write actions still require explicit approval', () => {
  assert.match(ui, /draftReviewed/);
  assert.match(ui, /decideDraft\("accept"\)/);
  assert.match(ui, /decideDraft\("discard"\)/);
  assert.match(ui, /decideApproval\(item.id, "approve"\)/);
  assert.doesNotMatch(ui, /submitApplication\(/);
  assert.doesNotMatch(ui, /sendEmail\(/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`, import.meta.url),'utf8');
const home=read('src/app/page.tsx');
const command=read('src/components/career/career-command-center.tsx');
const agent=read('src/app/dashboard/assistant/page.tsx');
const navigation=read('src/components/shell/navigation.ts');
const palette=read('src/components/shell/command-palette.tsx');
const sidebar=read('src/components/app-sidebar.tsx');

test('overview keeps real resume data, visible tools, and career actions',()=>{
  assert.match(home,/useResumeLibrary\(signedIn\)/);
  assert.match(home,/visibleSections/);
  assert.match(home,/dashboard\/resumes/);
  assert.match(command,/signedIn && resumesPending/);
  assert.match(command,/Promise\.allSettled/);
  assert.match(command,/AbortController/);
  assert.match(command,/credentials: "same-origin"/);
  assert.match(command,/\/dashboard\/application-agent/);
  assert.doesNotMatch(command,/dashboard\/evidence/);
});

test('agent has one unobstructed conversation and a persistent composer', () => {
  assert.match(agent,/newChat\(\)/);
  assert.match(agent,/setMessages\(\[\]\)/);
  assert.match(agent,/scrollRef/);
  assert.match(agent,/max-w-\[780px\]/);
  assert.match(agent,/ref=\{promptRef\}/);
  assert.match(agent,/aria-busy=\{loading \|\| pending\}/);
  assert.doesNotMatch(agent,/Conversation temporaire|Missions sauvegardées/);
  assert.doesNotMatch(agent,/ThumbsDown|ThumbsUp/);
});

test('navigation exposes agent and keyboard command list honors focused item',()=>{
  assert.equal((navigation.match(/key: "assistant", icon: Sparkles, href: "\/dashboard\/assistant"/g)||[]).length,2);
  assert.match(sidebar,/pathname\.startsWith\(item\.href \+ "\/"\)/);
  assert.match(palette,/focused instanceof HTMLButtonElement/);
  assert.match(palette,/normalize\("NFD"\)/);
});

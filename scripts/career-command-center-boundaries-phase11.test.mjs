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

test('command center retains working job analysis and existing document actions',()=>{
  assert.match(home,/CareerCommandCenter/);
  assert.match(home,/JobAnalysisForm form=\{jobForm\}/);
  assert.match(home,/ResumeCards documents=/);
  assert.match(home,/useResumeLibrary\(Boolean\(session\?\.id\)\)/);
  assert.match(command,/signedIn \&\& resumesPending/);
  assert.match(command,/Promise\.allSettled/);
  assert.match(command,/AbortController/);
  assert.match(command,/credentials: "same-origin"/);
  assert.match(command,/\/dashboard\/application-agent/);
  assert.match(command,/\/dashboard\/cover-letters/);
  assert.doesNotMatch(command,/score\s*:\s*100|readiness\s*:\s*\d+/i);
});

test('agent suggestions fill input only, never submit automatically',()=>{
  assert.match(agent,/setMessage\(prompt\); questionRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(agent,/setMessage\(prompt\);\s*send\(/);
  assert.match(agent,/read-only|Lecture seule/);
  assert.match(agent,/messages\.length === 0/);
  assert.match(agent,/aria-busy=\{loading \|\| pending\}/);
  assert.match(agent,/list_my_application_packets/);
});

test('navigation exposes agent and keyboard command list honors focused item',()=>{
  assert.equal((navigation.match(/key: "assistant", icon: Sparkles, href: "\/dashboard\/assistant"/g)||[]).length,2);
  assert.match(sidebar,/pathname\.startsWith\(item\.href \+ "\/"\)/);
  assert.match(palette,/focused instanceof HTMLButtonElement/);
  assert.match(palette,/normalize\("NFD"\)/);
});

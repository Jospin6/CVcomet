import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs', import.meta.url));

const { prepareResumeActions } = await import('../src/lib/agentic/agents/job-match/tools/resume-actions.tool.ts');
const requirement = (id,status,priority='REQUIRED',sources=[]) => ({
  id, title:id, category:'TECHNICAL',priority,status,evidenceSources:sources,
});
const profile = (path,quote='Used React') => ({path,label:'Skills',quote});
const snapshot = (requirements, source='PROFILE_AND_RESUME') => ({requirements,source});

test('stage10 real tool: source-free gaps are never marked as ready to insert', () => {
 const actions=prepareResumeActions(snapshot([requirement('Docker','NOT_DEMONSTRATED')]),'en');
 assert.equal(actions.length,1);
 assert.equal(actions[0].kind,'REVIEW_GAP');
 assert.deepEqual(actions[0].evidencePaths,[]);
 assert.equal(actions[0].requiresApproval,true);
});
test('stage10 real tool: only existing profile evidence can be brought to CV', () => {
 const actions=prepareResumeActions(snapshot([requirement('React','DEMONSTRATED','REQUIRED',[profile('profile.skills')])]),'fr');
 assert.equal(actions[0].kind,'BRING_PROFILE_EVIDENCE');
 assert.deepEqual(actions[0].evidencePaths,['profile.skills']);
 assert.match(actions[0].nextStep,/profil/i);
});
test('stage10 real tool: CV evidence is reinforced not invented', () => {
 const cv=profile('cv.experiences.0');
 const actions=prepareResumeActions(snapshot([
   requirement('React','PARTIAL','REQUIRED',[cv]),
   requirement('TypeScript','DEMONSTRATED','REQUIRED',[cv]),
 ]),'en');
 assert.equal(actions.length,1);
 assert.equal(actions[0].kind,'REINFORCE_CV');
});
test('stage10 real tool: ambiguous evidence is always manual verification', () => {
 const actions=prepareResumeActions(snapshot([requirement('5 years','VERIFY','REQUIRED',[profile('profile.experiences.0')])]),'en');
 assert.equal(actions[0].kind,'VERIFY_FACTS');
});
test('stage10 real tool: without a selected resume no automatic edit is possible', () => {
 const actions=prepareResumeActions(snapshot([requirement('React','DEMONSTRATED','PREFERRED',[profile('profile.skills')])],'PROFILE'),'en');
 assert.equal(actions[0].kind,'SELECT_RESUME');
});
test('stage10 real tool: required gaps first, bounded plan, original match untouched', () => {
 const requirements=[
   requirement('optional','PARTIAL','PREFERRED',[]),
   ...Array.from({length:30},(_,i)=>requirement(`req-${i}`,'NOT_DEMONSTRATED','REQUIRED',[])),
 ];
 const match=snapshot(requirements);
 const before=JSON.stringify(match);
 const actions=prepareResumeActions(match,'fr');
 assert.equal(actions.length,12);
 assert.ok(actions.every(a=>a.priority==='REQUIRED'));
 assert.equal(JSON.stringify(match),before);
});

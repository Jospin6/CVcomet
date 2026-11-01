/** Stage 07 dependency-free unit and architecture tests.
 * A real LangGraph integration test is required separately. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); } catch { ts = require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }
const root = path.resolve(__dirname,'..');
const read = rel => fs.readFileSync(path.join(root,rel),'utf8');
function loadTS(rel,mocks={}) {
  const code=ts.transpileModule(read(rel),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  const requireMock=key=>{
    if(Object.prototype.hasOwnProperty.call(mocks,key))return mocks[key];
    throw Error(`Unexpected import ${key} in ${rel}`);
  };
  new Function('require','module','exports',code)(requireMock,module,module.exports);
  return module.exports;
}
const planModule='src/lib/agentic/agents/resume/tools/plan-edit.tool.ts';
const plan=loadTS(planModule,{'@/lib/resume-conversation':{resumeConversationFields:()=>['title','summary.0','experiences.0.description']}}).planResumeEdit;
const sample=(overrides={})=>({document:{title:'Data Scientist'},instruction:'Improve my summary',language:'en',profileFacts:[],linkedJobAdvert:null,...overrides});

test('stage07: planning supports general editor chat',()=>assert.deepEqual(plan(sample()),{mode:'general'}));
test('stage07: Selected text targets ONLY an allowed editor field',()=>assert.deepEqual(plan(sample({targetField:'summary.0'})),{mode:'focused',targetField:'summary.0'}));
test('stage07: forged field selection is rejected before generation',()=>assert.throws(()=>plan(sample({targetField:'contact.ssn'})),/INVALID_RESUME_TARGET/));
test('stage07: job-specific tailoring without a linked job asks for context',()=>{
  const p=plan(sample({instruction:'Adapt my resume to this job posting'}));
  assert.equal(p.mode,'clarification');assert.match(p.message,/Link a job posting/);
});
test('stage07: linked job enables tailored resume generation',()=>{
  const p=plan(sample({instruction:'Adapter mon CV à cette offre',linkedJobAdvert:{title:'Engineer'}}));
  assert.equal(p.mode,'tailor');
});

const review=loadTS('src/lib/resume-ai/review.ts');
function mockApply(doc,edits){
  const next=structuredClone(doc);
  for(const edit of edits) {
    if(edit.type==='setField'&&edit.path==='summary.0')next.summary[0]=edit.value;
    if(edit.type==='setField'&&edit.path==='title')next.title=edit.value;
    if(edit.type==='updateDesign')next.design={...next.design,...edit.changes};
  }
  return next;
}
const verify=loadTS('src/lib/agentic/agents/resume/tools/verify-edit.tool.ts',{
  '@/lib/resume-editor':{resumeContentSchema:{parse:x=>x}},
  '@/lib/resume-conversation':{
    resumeConversationSchemaFor:()=>({parse:x=>x}),
    applyResumeConversationEdits:mockApply,
    resumeConversationChanges:edits=>edits.map(e=>'Updated '+(e.path||e.type)),
  },
  '@/lib/resume-ai/review':review,
}).verifyResumeEdit;
const doc={title:'Engineer',summary:['Built Python pipelines.'],design:{layout:'classic'}};
const applied=(edits)=>({object:{status:'applied',message:'Done',summary:['Changed'],edits},document:{...doc,summary:['Model supplied preview must be ignored']}});
const instruction='Improve my summary';
const source=()=>sample({document:doc,instruction});

test('stage07: model-supplied preview is never trusted; only validated operations are reapplied',()=>{
 const result=verify(source(),applied([{type:'setField',path:'summary.0',value:'Built reliable Python pipelines.'}]));
 assert.equal(result.object.status,'applied');assert.equal(result.document.summary[0],'Built reliable Python pipelines.');
});
test('stage07: targeted editing discards unrelated title and design edits',()=>{
 const result=verify(source(),applied([
   {type:'setField',path:'title',value:'Invented title'},
   {type:'updateDesign',changes:{layout:'modern'}},
   {type:'setField',path:'summary.0',value:'Built Python and SQL pipelines.'},
 ]));
 const targeted=verify({...source(),targetField:'summary.0'},applied([
   {type:'setField',path:'title',value:'Invented title'},
   {type:'updateDesign',changes:{layout:'modern'}},
   {type:'setField',path:'summary.0',value:'Built Python and SQL pipelines.'},
 ]));
 assert.equal(result.object.edits.length,3);
 assert.deepEqual(targeted.object.edits.map(e=>e.path),['summary.0']);
 assert.equal(targeted.document.title,'Engineer');assert.equal(targeted.document.design.layout,'classic');
});
test('stage07: model edits cannot escape a focused selection',()=>{
 const result=verify({...source(),targetField:'summary.0'},applied([{type:'setField',path:'title',value:'Hacker'}]));
 assert.equal(result.object.status,'clarification');assert.equal(result.document,null);
});
test('stage07: unsupported numeric achievements result in clarification, no proposal',()=>{
 const result=verify(source(),applied([{type:'setField',path:'summary.0',value:'Built 50 Python pipelines.'}]));
 assert.equal(result.object.status,'clarification');assert.equal(result.document,null);
});
test('stage07: user-provided numerical facts can be used in revisions',()=>{
 const result=verify({...source(),instruction:'Mention the 50 pipelines I built.'},applied([{type:'setField',path:'summary.0',value:'Built 50 Python pipelines.'}]));
 assert.equal(result.object.status,'applied');
});
test('stage07: no change returns clarification rather than a fake proposal',()=>{
 const result=verify(source(),applied([{type:'setField',path:'summary.0',value:'Built Python pipelines.'}]));
 assert.equal(result.object.status,'clarification');
});
test('stage07: existing clarification has no hidden edit',()=>{
 const result=verify(source(),{object:{status:'clarification',message:'Tell me more.',summary:[],edits:[]},document:doc});
 assert.equal(result.object.status,'clarification');assert.equal(result.document,null);
});

test('stage07: agent has separate prompts, tools, nodes and graph, with no checkpointer or direct write',()=>{
 const base='src/lib/agentic/agents/resume';
 for(const file of ['agent/state.ts','agent/graph.ts','agent/resume.agent.ts','nodes/plan.node.ts','nodes/generate.node.ts','nodes/verify.node.ts','nodes/review.node.ts','tools/plan-edit.tool.ts','tools/generate-edit.tool.ts','tools/verify-edit.tool.ts','prompts/resume-edit.prompt.ts']) {
   assert.ok(fs.existsSync(path.join(root,base,file)),file);
 }
 const graph=read(base+'/agent/graph.ts');
 assert.match(graph,/new StateGraph\(ResumeAgentState\)/);
 assert.match(graph,/\.addConditionalEdges\("plan"/);
 for(const node of ['plan','generate','verify','review'])assert.match(graph,new RegExp(`\\.addNode\\("${node}"`));
 assert.doesNotMatch(graph,/checkpointer|\.cv\.update|\.cv\.create/);
 const agent=read(base+'/agent/resume.agent.ts');
 assert.match(agent,/runAgentGraph/);assert.doesNotMatch(agent,/prisma|\.cv\.update/);
});
test('stage07: editor and application workflows use agent, approval endpoint unchanged',()=>{
 const route=read('src/app/api/cvs/[id]/assistant/route.ts');
 const app=read('src/lib/career-os/application-drafts.ts');
 const decision=read('src/app/api/cvs/[id]/assistant/decision/route.ts');
 assert.match(route,/runResumeAgent/);assert.match(route,/proposeResumeAI/);
 assert.match(route,/assertTrustedWriteOrigin/);assert.match(route,/revision !== input\.revision/);
 assert.match(route,/edit\.type === "setField" && edit\.path === input\.targetField/);
 assert.match(app,/runResumeAgent/);assert.match(app,/proposeResumeAI/);
 assert.match(decision,/decideResumeAI/);assert.match(decision,/getSessionUser/);
 assert.doesNotMatch(route,/\.cv\.update|\.resumeVersion\.create/);
});
test('stage07: quota is enforced in the model tool before generation',()=>{
 const src=read('src/lib/agentic/agents/resume/tools/generate-edit.tool.ts');
 assert.ok(src.indexOf('await reserve(identity.access.actorId)') < src.indexOf('await generate('));
 assert.match(src,/"RESUME_EDIT"/);assert.match(src,/identity\.agentId !== "resume"/);
});
const checkField=loadTS('src/lib/agentic/agents/resume/tools/field-review.tool.ts',{
  '@/lib/resume-ai/review':review,
}).checkGeneratedResumeField;
const fieldInput={action:'GENERATE',field:'summary.0',language:'en',systemPolicy:'Safe writing',facts:{},candidateSources:['Built 4 data pipelines.']};
test('stage07: short form generation accepts grounded content and strips code fences',()=>{
  assert.equal(checkField(fieldInput,'```text\nBuilt 4 data pipelines.\n```').proposal,'Built 4 data pipelines.');
});
test('stage07: short form generation rejects fabricated numbers',()=>{
  assert.equal(checkField(fieldInput,'Built 500 data pipelines.').issue,'UNSUPPORTED_FACTS');
});
test('stage07: short form empty response cannot be accepted',()=>{
  assert.equal(checkField(fieldInput,' \n').issue,'AI_INVALID_RESPONSE');
});
test('stage07: short form API now routes generation through real 4-node LangGraph',()=>{
 const graph=read('src/lib/agentic/agents/resume/agent/field-graph.ts');
 for(const node of ['plan','generate','verify','review']) assert.match(graph,new RegExp(`\\.addNode\\("${node}"`));
 assert.match(graph,/new StateGraph\(ResumeFieldState\)/);
 assert.doesNotMatch(graph,/checkpointer|\.cv\.update/);
 const route=read('src/app/api/resume-ai/route.ts');
 assert.match(route,/runResumeFieldAgent/);assert.match(route,/careerProfileContext\(profile\)/);
 assert.match(route,/marketPrompt\(/);assert.match(route,/unsupportedNumericClaims/);
 assert.match(route,/JSON\.stringify\(resumeFacts\)/);
 assert.doesNotMatch(route,/\.cv\.update|\.cv\.create/);
});
test('stage07: field provider uses common CVComet model gateway and quota feature',()=>{
 const tool=read('src/lib/agentic/agents/resume/tools/field-generation.tool.ts');
 assert.match(tool,/cvcometAgentModel\.text/);assert.match(tool,/"RESUME_EDIT"/);
 assert.match(tool,/identity\.agentId !== "resume"/);
});

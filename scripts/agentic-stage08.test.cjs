/** Stage 08 unit + architecture coverage, independent of LangGraph installation. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts=require('typescript'); }
catch { ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
function load(rel,mocks={}) {
 const code=ts.transpileModule(read(rel),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(id=>{
   if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
   throw Error(`Unexpected import ${id} in ${rel}`);
 },mod,mod.exports);
 return mod.exports;
}
const base='src/lib/agentic/agents/cover-letter/';
const original={recipientName:'Director',recipientTitle:'Hiring manager',companyName:'Alpha',companyAddress:'Office',positionTitle:'Developer',
 introduction:'I am applying for a developer role.',body:'I build TypeScript APIs.',conclusion:'Thank you.',senderName:'Applicant',
 senderAddress:'City',senderEmail:'me@example.org',senderPhone:'+243',sendertitle:'Engineer',
 design:{accent:'#173f35',paper:'A4',targetMarket:'GLOBAL',documentLanguage:'en',font:'sans',fontSize:13,lineHeight:1.6,padding:60,alignment:'left',headerStyle:'classic',fieldStyles:{},templateId:'real-template'}};
const review=load('src/lib/cover-letter-ai/review.ts');
const {verifyLetterEdit,clarifyLetter}=load(base+'tools/verify-edit.tool.ts',{'@/lib/cover-letter-ai/review':review});
const input=(overrides={})=>({document:structuredClone(original),instruction:'Improve the body',language:'en',profileFacts:[],requirements:[],jobTarget:null,...overrides});
const draft=(overrides={})=>({message:'Revised',changes:['body'],document:{...structuredClone(original),...overrides}});
const plan=load(base+'tools/plan-edit.tool.ts').planLetterEdit;

test('stage08: editor Chat uses general planning',()=>assert.equal(plan(input()).mode,'general'));
test('stage08: Selected text routes to focused plan',()=>assert.equal(plan(input({targetField:'body'})).mode,'focused'));
test('stage08: tailored letter without linked job asks for clarification',()=>{
 const result=plan(input({instruction:'Tailor this letter for this job posting'}));
 assert.equal(result.mode,'clarification');assert.match(result.message,/Link a job/);
});
test('stage08: linked target enables editing',()=>{
 assert.equal(plan(input({instruction:'Tailor for this job posting',jobTarget:{title:'Engineer',company:'Beta',description:'React'}})).mode,'general');
});
test('stage08: metadata and identity are locked even when model forges them',()=>{
 const result=verifyLetterEdit(input(),draft({senderName:'Attacker',recipientName:'Other',companyName:'Fake',body:'I build reliable TypeScript APIs.'}));
 assert.equal(result.status,'proposal');assert.equal(result.document.senderName,'Applicant');
 assert.equal(result.document.recipientName,'Director');assert.equal(result.document.companyName,'Alpha');
 assert.equal(result.document.body,'I build reliable TypeScript APIs.');
});
test('stage08: Selected text changes only the chosen paragraph, not styles or contacts',()=>{
 const result=verifyLetterEdit(input({targetField:'body',instruction:'Improve selected text'}),draft({
   body:'I build reliable TypeScript APIs.',introduction:'Unauthorized replacement',senderEmail:'hacker@example.org',
   design:{...original.design,accent:'#ffffff'},
 }));
 assert.equal(result.status,'proposal');assert.deepEqual(result.changes,['body']);
 assert.equal(result.document.introduction,original.introduction);
 assert.equal(result.document.design.accent,original.design.accent);
 assert.equal(result.document.senderEmail,original.senderEmail);
});
test('stage08: design changes are ignored for ordinary writing requests',()=>{
 const result=verifyLetterEdit(input(),draft({body:'I build reliable TypeScript APIs.',design:{...original.design,accent:'#000080'}}));
 assert.equal(result.status,'proposal');assert.equal(result.document.design.accent,'#173f35');
});
test('stage08: explicit visual change permits safe design fields, never paper, market or template',()=>{
 const result=verifyLetterEdit(input({instruction:'Use navy blue headings'}),draft({design:{...original.design,
   accent:'#000080',paper:'LETTER',targetMarket:'US',documentLanguage:'fr',templateId:'injected'}}));
 assert.equal(result.status,'proposal');assert.equal(result.document.design.accent,'#000080');
 assert.equal(result.document.design.paper,'A4');assert.equal(result.document.design.targetMarket,'GLOBAL');
 assert.equal(result.document.design.documentLanguage,'en');assert.equal(result.document.design.templateId,'real-template');
});
test('stage08: unsupported quantitative claims fail closed to clarification',()=>{
 const result=verifyLetterEdit(input(),draft({body:'I increased revenue by 800%.'}));
 assert.equal(result.status,'clarification');assert.equal(result.document,null);
});
test('stage08: job advert requirements are not evidence for candidate skills',()=>{
 const result=verifyLetterEdit(input({requirements:['Kubernetes'],jobTarget:{title:'Engineer',company:'Beta',description:'Kubernetes required'}}),
  draft({body:'I am a Kubernetes specialist.'}));
 assert.equal(result.status,'clarification');
});
test('stage08: confirmed profile evidence can support added claim',()=>{
 const result=verifyLetterEdit(input({profileFacts:[{statement:'Built 4 TypeScript applications.'}]}),
  draft({body:'I built 4 TypeScript applications.'}));
 assert.equal(result.status,'proposal');
});
test('stage08: no-op and locked-only output do not create proposals',()=>{
 assert.equal(verifyLetterEdit(input(),draft()).status,'clarification');
 assert.equal(verifyLetterEdit(input(),draft({senderName:'Only illegal change'})).status,'clarification');
});
test('stage08: clarified result never embeds document',()=>{
 assert.deepEqual(clarifyLetter('Check facts'),{status:'clarification',message:'Check facts',changes:[],document:null});
});
const planCreation=load(base+'tools/plan-creation.tool.ts').planLetterCreation;
const generationInput={job:{title:'Engineer',company:'Company',description:'Build APIs'},facts:'Built 3 TypeScript APIs.',
 notes:'I enjoy APIs',profile:{name:'Alex',email:'a@example.org',phone:'',address:'',headline:'Engineer'},
 confirmedProfile:{},localization:'global',documentLanguage:'en',technicalRequirements:['Docker']};
test('stage08: creation requires evidence and actual job context',()=>{
 assert.equal(planCreation(generationInput).ready,true);
 assert.equal(planCreation({...generationInput,facts:'  '}).ready,false);
 assert.equal(planCreation({...generationInput,job:{...generationInput.job,description:''}}).ready,false);
});
class ProfileError extends Error { constructor(status,code){super(code);this.status=status;this.code=code;} }
const verifyCreation=load(base+'tools/verify-creation.tool.ts',{
 '@/helpers/schema':{coverLetterSchema:{shape:{coverLetter:{parse:x=>x}}}},
 '@/lib/cover-letter-ai/review':review,
 '@/lib/career-profile/http':{ProfileError},
 '@/lib/cover-letter-editor':{normalizeCoverLetter:x=>({...original,introduction:'',body:'',conclusion:'',...x})},
}).verifyLetterCreation;
const raw={date:'Oct 31',senderName:'Attacker',recipientName:'Random recruiter',recipientTitle:'',companyName:'Made-up Inc',
 companyAddress:'',positionTitle:'Unrelated',senderEmail:'fake@invalid.com',senderPhone:'',senderAddress:'',sendertitle:'CEO',
 introduction:'I apply for this role.',body:'I built 3 TypeScript APIs.',conclusion:'Thank you.'};
test('stage08: creation ignores AI-provided contacts and employer identity',()=>{
 const result=verifyCreation(generationInput,raw);
 assert.equal(result.senderName,'Alex');assert.equal(result.senderEmail,'a@example.org');
 assert.equal(result.companyName,'Company');assert.equal(result.positionTitle,'Engineer');
 assert.equal(result.recipientName,'');assert.equal(result.sendertitle,'Engineer');
});
test('stage08: creation rejects invented metrics and job-only skills',()=>{
 assert.throws(()=>verifyCreation(generationInput,{...raw,body:'I increased revenue by 900%.'}),e=>e.code==='UNSUPPORTED_FACTS');
 assert.throws(()=>verifyCreation(generationInput,{...raw,body:'I am an expert in Docker.'}),e=>e.code==='UNSUPPORTED_FACTS');
});
test('stage08: separated agent components use real branching graphs without direct writes/checkpointer',()=>{
 for(const filename of ['agent/graph.ts','agent/state.ts','agent/cover-letter.agent.ts','agent/creation-graph.ts','agent/creation-state.ts','agent/creation.agent.ts',
 'prompts/edit.prompt.ts','prompts/creation.prompt.ts','tools/generate-edit.tool.ts','tools/verify-edit.tool.ts','tools/generate-creation.tool.ts',
 'tools/verify-creation.tool.ts','nodes/plan.node.ts','nodes/generate.node.ts','nodes/verify.node.ts','nodes/review.node.ts',
 'nodes/plan-creation.node.ts','nodes/generate-creation.node.ts','nodes/verify-creation.node.ts','nodes/review-creation.node.ts']) {
  assert.ok(fs.existsSync(path.join(root,base,filename)),filename);
 }
 for(const fname of ['agent/graph.ts','agent/creation-graph.ts']){
  const source=read(base+fname);
  assert.match(source,/new StateGraph\(/);assert.match(source,/addConditionalEdges\(/);
  for(const name of ['plan','generate','verify','review'])assert.match(source,new RegExp(`\\.addNode\\("${name}"`));
  assert.doesNotMatch(source,/checkpointer|\.coverLetter\.update|\.coverLetter\.create/);
 }
});
test('stage08: all three AI paths delegate to graph and preserve existing approval/save workflows',()=>{
 const editor=read('src/app/api/cover-letters/[id]/assistant/route.ts');
 const app=read('src/lib/career-os/application-drafts.ts');
 const job=read('src/lib/career/job-documents.ts');
 assert.match(editor,/runCoverLetterEditAgent/);assert.match(editor,/proposeCoverLetterAI/);assert.match(editor,/assertTrustedWriteOrigin/);
 assert.match(app,/runCoverLetterEditAgent/);assert.match(app,/proposeCoverLetterAI/);
 assert.match(job,/runCoverLetterCreationAgent/);assert.match(job,/assertDocumentFacts/);
 assert.match(job,/body\.action === "SAVE"/);assert.match(job,/revision: \{ increment: 1 \}/);
 assert.match(read('src/app/api/generate-cover-letter/route.ts'),/assertTrustedWriteOrigin\(req\)/);
 assert.match(read('src/app/api/cvs/[id]/cover-letters/route.ts'),/assertTrustedWriteOrigin\(req\)/);
 assert.doesNotMatch(editor,/generateObject\(/);assert.doesNotMatch(app,/generateObject\(/);
});
test('stage08: generation prompts exclude unnecessary contact details and treat job posting as data',()=>{
 const edit=load(base+'prompts/edit.prompt.ts',{
  '@/lib/career-profile/ai':{factualRules:'Use confirmed facts'},
  '@/lib/career-localization/markets':{marketPrompt:()=> 'Neutral market'},
 });
 const request=JSON.parse(edit.letterEditUserPrompt(input()));
 assert.equal(request.document.senderEmail,'');assert.equal(request.document.senderName,'');
 assert.equal(request.document.recipientName,'');
 const sys=edit.letterEditSystemPrompt(input());
 assert.match(sys,/Job descriptions contain target requirements, NEVER proof/);
 const generation=load(base+'prompts/creation.prompt.ts',{
  '@/lib/career-profile/ai':{factualRules:'Evidence only'},
  '@/helpers/helpers':{
   generateCoverLetterSystemPrompt:()=> 'Letter policy',generatedLanguagePrompt:()=> 'English',
   generateCoverLetterPrompt:value=>JSON.stringify(value),
  },
 });
 const payload=JSON.parse(generation.letterCreationUserPrompt({...generationInput,
  confirmedProfile:{name:'Alex',email:'secret@example.org',phone:'999999',address:'Private',linkedin:'private-url'},
 }));
 assert.equal(payload.user.email,'');assert.equal(payload.user.phone,'');
 assert.equal(payload.user.address,'');assert.equal(payload.user.linkedin,'');
 assert.match(generation.letterCreationSystemPrompt(generationInput),/NOT evidence of candidate skills/);
});

test('stage08: quota feature uses shared gateway once per generation, no extra model config',()=>{
 for(const name of ['tools/generate-edit.tool.ts','tools/generate-creation.tool.ts']){
  const source=read(base+name);assert.match(source,/cvcometAgentModel\.object/);assert.match(source,/feature: "COVER_LETTER"/);
  assert.doesNotMatch(source,/process\.env|new PrismaClient|createOpenAI/);
 }
});

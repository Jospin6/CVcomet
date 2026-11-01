/** Mandatory real LangGraph test: requires npm install and prisma generate. No DB/API calls. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function runtime() {
 try {
  const [{runCoverLetterEditAgent},{runCoverLetterCreationAgent},{normalizeCoverLetter}] = await Promise.all([
   import('../src/lib/agentic/agents/cover-letter/agent/cover-letter.agent.ts'),
   import('../src/lib/agentic/agents/cover-letter/agent/creation.agent.ts'),
   import('../src/lib/cover-letter-editor.ts'),
  ]);
  return {runCoverLetterEditAgent,runCoverLetterCreationAgent,normalizeCoverLetter};
 } catch(error) {
  if(error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND')
   assert.fail('Install npm dependencies and run prisma generate; real LangGraph tests are mandatory.');
  throw error;
 }
}
const sample = async () => {
 const {normalizeCoverLetter,...agent}=await runtime();
 return { ...agent, document:normalizeCoverLetter({recipientName:'Hiring Manager',companyName:'Acme',
  positionTitle:'Engineer',senderName:'Alex',senderEmail:'alex@example.org',
  introduction:'I am applying for this job.',body:'I build TypeScript APIs.',conclusion:'Thank you.'}) };
};
const input=(document,other={})=>({document,instruction:'Improve the body',language:'en',profileFacts:[],requirements:[],jobTarget:null,...other});
const modelResult=(document,patch={})=>({message:'Updated',changes:['body'],document:{...document,...patch}});
test('stage08 REAL graph: editor chat yields reviewable proposal only',async()=>{
 const {runCoverLetterEditAgent,document}=await sample();let calls=0;
 const result=await runCoverLetterEditAgent({actorId:randomUUID(),input:input(document),model:async(_id,request)=>{
  calls++;assert.equal(request.feature,'COVER_LETTER');return modelResult(document,{body:'I build reliable TypeScript APIs.'});}});
 assert.equal(result.status,'proposal');assert.equal(result.document.body,'I build reliable TypeScript APIs.');
 assert.equal(calls,1);assert.equal('proposalId' in result,false);
});
test('stage08 REAL graph: Selected text discards unrelated paragraphs and design',async()=>{
 const {runCoverLetterEditAgent,document}=await sample();
 const result=await runCoverLetterEditAgent({actorId:randomUUID(),input:input(document,{targetField:'body'}),
  model:async()=>modelResult(document,{body:'I build reliable TypeScript APIs.',introduction:'Attack',design:{...document.design,accent:'#ff00ff'}})});
 assert.equal(result.status,'proposal');assert.equal(result.document.introduction,document.introduction);
 assert.equal(result.document.design.accent,document.design.accent);
});
test('stage08 REAL graph: tailoring without job skips model call',async()=>{
 const {runCoverLetterEditAgent,document}=await sample();let called=false;
 const result=await runCoverLetterEditAgent({actorId:randomUUID(),input:input(document,{instruction:'Tailor this letter for this job posting'}),
  model:async()=>{called=true;throw Error('must not run');}});
 assert.equal(called,false);assert.equal(result.status,'clarification');
});
test('stage08 REAL graph: unsupported achievement never reaches a proposal',async()=>{
 const {runCoverLetterEditAgent,document}=await sample();
 const result=await runCoverLetterEditAgent({actorId:randomUUID(),input:input(document),
  model:async()=>modelResult(document,{body:'I shipped 700 projects.'})});
 assert.equal(result.status,'clarification');assert.equal(result.document,null);
});
test('stage08 REAL graph: job-based generation yields draft without saving',async()=>{
 const {runCoverLetterCreationAgent}=await sample();let calls=0;
 const result=await runCoverLetterCreationAgent({actorId:randomUUID(),input:{
  job:{title:'Engineer',company:'Acme',description:'Build TypeScript apps.'},
  profile:{name:'Alex',email:'alex@example.org',phone:'',address:'',headline:'Engineer'},
  confirmedProfile:{name:'Alex',skills:'TypeScript'},
  notes:'Interested in building APIs.',localization:'International, English',documentLanguage:'en',
  facts:'Built 3 TypeScript APIs.',technicalRequirements:[],
 },model:async(_id,request)=>{calls++;assert.equal(request.feature,'COVER_LETTER');return {coverLetter:{
  date:'October 31',recipientName:'Fake manager',companyName:'Hacker Inc',positionTitle:'Wrong',
  sendertitle:'Fake',senderName:'Wrong',introduction:'I am applying.',body:'I built 3 TypeScript APIs.',conclusion:'Thank you.'}};}});
 assert.equal(calls,1);assert.equal(result.companyName,'Acme');assert.equal(result.senderName,'Alex');
 assert.equal('saved' in result,false);
});

test('stage08 REAL graph: unsupported creation facts return 422 rather than provider failure',async()=>{
 const {runCoverLetterCreationAgent}=await sample();
 await assert.rejects(runCoverLetterCreationAgent({actorId:randomUUID(),input:{
  job:{title:'Engineer',company:'Acme',description:'Build applications'},
  profile:{name:'Alex',email:'alex@example.org',phone:'',address:'',headline:'Engineer'},
  confirmedProfile:{name:'Alex'},notes:'',localization:'International',documentLanguage:'en',
  facts:'Builds TypeScript applications.',technicalRequirements:[],
 },model:async()=>({coverLetter:{date:'October 31',recipientName:'',companyName:'Acme',positionTitle:'Engineer',
  sendertitle:'Engineer',senderName:'Alex',introduction:'I am applying.',body:'I shipped 800 products.',conclusion:'Thank you.'}})}),
  error=>error.code==='UNSUPPORTED_FACTS' && error.status===422);
});

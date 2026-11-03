/** Real Resume Agent generation/validation logic with an isolated provider adapter.
 * Does not need credentials, Prisma, Zod or a LangGraph installation.
 * Production runtime and provider calls must still be smoke-tested in staging. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); } catch {
  ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript'));
}
const root = path.resolve(__dirname, '..');
const source = rel => fs.readFileSync(path.join(root, rel), 'utf8');
function load(rel, mocks) {
  const code = ts.transpileModule(source(rel), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const mod = { exports: {} };
  new Function('require','module','exports',code)((key)=>{
    if (Object.prototype.hasOwnProperty.call(mocks, key)) return mocks[key];
    throw Error(`Unexpected import ${key} in ${rel}`);
  }, mod, mod.exports);
  return mod.exports;
}
class ZodError extends Error { constructor(issues) { super('invalid schema'); this.issues=issues; } }
class ProfileError extends Error { constructor(status,code) {super(code);this.status=status;this.code=code;} }
let completions=[];
let calls=[];
let getModelCalls=0;
const model={provider:'test-text'};
const document={ title:'Software Engineer', summary:['Built Node.js systems.'],
  contact:{name:'Case Test'}, experiences:[], design:{targetMarket:'GLOBAL',documentLanguage:'en',layout:'classic'} };
const allowedFields=['title','summary.0','contact.name'];
const mocks={
  'ai': {generateText:async options =>{
    calls.push(options);
    const next=completions.shift();
    if (next instanceof Error) throw next;
    if (next===undefined) throw Error('No fake model response configured');
    return {text:next};
  }},
  'zod': { ZodError },
  '@/lib/agentic/agents/resume/prompts/resume-edit.prompt': {resumeEditingInstructions:'No unsupported facts.'},
  '@/lib/career-localization/markets': {marketPrompt:()=> 'Market format rules.'},
  '@/lib/ai/model': {getAIModel:async()=>{getModelCalls++;return model;}},
  '@/lib/career-profile/ai': {factualRules:'No invented skills.'},
  '@/lib/career-profile/http': {ProfileError,profileAIError:error=> error instanceof ProfileError ? error : new ProfileError(502,'AI_PROVIDER_UNAVAILABLE')},
  '@/lib/resume-editor': {fieldValue:(doc,p)=>p==='summary.0'?doc.summary[0]:p==='title'?doc.title:doc.contact.name},
  '@/lib/resume-conversation': {
    resumeConversationFields:()=>allowedFields,
    resumeConversationSchemaFor:()=>({ parse:value=>{
      const issues=[];
      if (!value || !['applied','clarification'].includes(value.status))issues.push({code:'invalid_enum_value'});
      if (typeof value.message!=='string' || !value.message.trim())issues.push({code:'invalid_type'});
      if (!Array.isArray(value.summary))issues.push({code:'invalid_type'});
      if (!Array.isArray(value.edits))issues.push({code:'invalid_type'});
      else {
        for(const edit of value.edits){
          if(!edit || edit.type!=='setField' || !allowedFields.includes(edit.path) || typeof edit.value!=='string')issues.push({code:'invalid_edit'});
          else if (Object.keys(edit).some(key=>!['type','path','value'].includes(key)))issues.push({code:'unrecognized_keys'});
        }
        if(value.status==='applied' && !value.edits.length)issues.push({code:'custom'});
        if(value.status==='clarification' && value.edits.length)issues.push({code:'custom'});
      }
      if(issues.length)throw new ZodError(issues);
      return value;
    }}),
    resumeConversationChanges:edits=>edits.map(e=>'Updated '+e.path),
    ResumeConversationEditError:class ResumeConversationEditError extends Error{},
    applyResumeConversationEdits:(original,edits)=>{
      const doc=structuredClone(original);
      for(const edit of edits){
        if(edit.path==='title')doc.title=edit.value;
        else if(edit.path==='summary.0')doc.summary[0]=edit.value;
        else if(edit.path==='contact.name')doc.contact.name=edit.value;
      }
      return doc;
    },
  },
};
const engine=load('src/lib/resume-conversation-ai.ts',mocks);
const baseline={document,instruction:'Change my title to AI Engineer',language:'en',profileFacts:[],linkedJobAdvert:null};
const valid=JSON.stringify({ status:'applied',message:'Updated professional title.',summary:[],edits:[{type:'setField',path:'title',value:'AI Engineer'}] });
const reset=(responses)=>{completions=[...responses];calls=[];getModelCalls=0;};

test('provider-independent text JSON reaches a validated edit and preview',async()=>{
  reset([valid]);
  const result=await engine.generateResumeConversation(baseline);
  assert.equal(result.object.status,'applied');
  assert.equal(result.document.title,'AI Engineer');
  assert.equal(result.object.summary[0],'Updated title');
  assert.equal(document.title,'Software Engineer');
  assert.equal(calls.length,1);
  assert.equal(calls[0].model,model);
  assert.equal(calls[0].maxRetries,0);
  assert.equal(calls[0].schema,undefined);
  assert.equal(calls[0].temperature,undefined);
  assert.match(calls[0].system,/allowedFields/);
});
test('provider JSON code fence and harmless preamble are parsed',async()=>{
  reset(['```json\n'+valid+'\n```']);
  assert.equal((await engine.generateResumeConversation(baseline)).document.title,'AI Engineer');
  reset(['Result:\n'+valid+'\nCompleted.']);
  assert.equal((await engine.generateResumeConversation(baseline)).document.title,'AI Engineer');
});
test('optional unused fields rendered null do not prevent valid operations',async()=>{
  reset([JSON.stringify({ status:'applied', message:'Done', edits:[{type:'setField',path:'title',value:'AI Engineer',section:null,position:null,changes:null}] })]);
  const result=await engine.generateResumeConversation(baseline);
  assert.deepEqual(result.object.edits,[{type:'setField',path:'title',value:'AI Engineer'}]);
  assert.equal(result.document.title,'AI Engineer');
});
test('an invalid first JSON response is repaired with at most one more request',async()=>{
  reset(['not JSON',valid]);
  const result=await engine.generateResumeConversation(baseline);
  assert.equal(result.document.title,'AI Engineer');
  assert.equal(calls.length,2);
  assert.match(calls[1].prompt,/previous response was invalid/);
});
test('an unapproved path cannot mutate CV and cannot become a proposal',async()=>{
  const bad=JSON.stringify({status:'applied',message:'Done',summary:['Done'],edits:[{type:'setField',path:'owner.admin',value:'true'}]});
  reset([bad,bad]);
  await assert.rejects(engine.generateResumeConversation(baseline),e=>e.code==='AI_INVALID_RESPONSE');
  assert.equal(document.title,'Software Engineer');
  assert.equal(calls.length,2);
});
test('unknown tool actions cannot execute',async()=>{
  const bad=JSON.stringify({status:'applied',message:'Done',summary:['Done'],edits:[{type:'executeCommand',command:'rm -rf /'}]});
  reset([bad,bad]);
  await assert.rejects(engine.generateResumeConversation(baseline),e=>e.code==='AI_INVALID_RESPONSE');
});
test('provider errors are not retried as JSON errors or blamed on user facts',async()=>{
  reset([new ProfileError(503,'AI_AUTH_ERROR')]);
  await assert.rejects(engine.generateResumeConversation(baseline),e=>e.code==='AI_AUTH_ERROR');
  assert.equal(calls.length,1);
});
test('focused editing sends one permitted field and never edits unrelated data',async()=>{
  reset([JSON.stringify({status:'applied',message:'Edited',summary:[],edits:[{type:'setField',path:'summary.0',value:'Improved Node.js systems.'}]})]);
  const result=await engine.generateResumeConversation({...baseline,targetField:'summary.0'});
  assert.equal(result.document.summary[0],'Improved Node.js systems.');
  assert.equal(result.document.title,'Software Engineer');
  const payload=JSON.parse(calls[0].prompt);
  assert.deepEqual(payload.allowedFields,['summary.0']);
  assert.equal(payload.document.currentValue,'Built Node.js systems.');
});
test('oversized context is refused before the provider call',async()=>{
  reset([valid]);
  await assert.rejects(engine.generateResumeConversation({...baseline,profileFacts:['x'.repeat(145000)]}),e=>e.code==='AI_CONTEXT_TOO_LARGE');
  assert.equal(calls.length,0);
});
test('unsupported requests can yield clarification without any document mutation',async()=>{
  reset([JSON.stringify({status:'clarification',message:'Provide your actual achievements.',summary:[],edits:[]})]);
  const result=await engine.generateResumeConversation(baseline);
  assert.equal(result.object.status,'clarification');
  assert.equal(result.document,null);
});
test('quoted braces are not mistaken for the end of a JSON result',()=>{
  assert.equal(engine.parseResumeModelJSON('Here is JSON: {"message":"say } and \\"quoted\\"", "ok":true}').ok,true);
});
test('all provider instructions explicitly treat memory as untrusted context',()=>{
  const src=source('src/lib/resume-conversation-ai.ts');
  assert.match(src,/untrusted user context/);
  assert.match(src,/schema\.parse\(normalizeResumeModelObject\(raw\)\)/);
  assert.doesNotMatch(src,/generateObject\(/);
});

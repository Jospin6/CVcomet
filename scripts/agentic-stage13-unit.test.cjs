const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const prefix='src/lib/agentic/agents/interview-text/';
function load(file,imports={}) {
  const src=fs.readFileSync(path.join(root,file),'utf8');
  const js=ts.transpileModule(src,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{console,AbortController,AbortSignal,Date,Map,Set,Promise,Error,Number,Array,RegExp})((id)=>{
    if(Object.hasOwn(imports,id))return imports[id];throw new Error(`unexpected dependency ${id} in ${file}`);
  },m,m.exports);
  return m.exports;
}
const policy=load('src/lib/career/interview-coach-policy.ts');
class AgenticError extends Error {constructor(code,status=500){super(code);this.code=code;this.status=status}}
const validation=load(prefix+'tools/validation.tool.ts',{
  '../../../core/errors.ts':{AgenticError},'@/lib/career/interview-coach-policy':policy,
});
const validPreparation={role:'Software Engineer',level:'Senior',language:'en',questionCount:5,jobDescription:'A role requiring backend work',resumeContext:'',profile:'{}',factsFromProfile:[]};
const validEvaluation={role:'Developer',language:'en',question:'Describe a difficult bug you fixed.',answer:'I fixed a race by using locks and measuring impact.'};
const draft={relevance:4,specificity:3,structure:4,clarity:3,
  strength:'Concrete example',improvement:'Explain the user impact',nextExercise:'Practice stating the result',evidenceQuote:'fixed a race'};
const text=x=>JSON.parse(JSON.stringify(x));

test('stage13 identity-free payload validation prevents prompt, answer and count overflow',()=>{
  assert.doesNotThrow(()=>validation.assertPreparationInput(validPreparation));
  assert.doesNotThrow(()=>validation.assertEvaluationInput(validEvaluation));
  for(const field of ['role','jobDescription','profile','resumeContext']){
    const bad={...validPreparation,[field]:'X'.repeat(13000)};
    assert.throws(()=>validation.assertPreparationInput(bad),{code:'AGENT_MODEL_INPUT_INVALID'});
  }
  assert.throws(()=>validation.assertPreparationInput({...validPreparation,questionCount:21}),{code:'AGENT_MODEL_INPUT_INVALID'});
  assert.throws(()=>validation.assertEvaluationInput({...validEvaluation,answer:'x'.repeat(8001)}),{code:'AGENT_MODEL_INPUT_INVALID'});
  assert.throws(()=>validation.assertEvaluationInput({...validEvaluation,language:'de'}),{code:'AGENT_MODEL_INPUT_INVALID'});
});

test('stage13 fallback questions are diverse and the requested count is exact',()=>{
  for(const language of ['fr','en']) for(const count of [5,10,15,20]) {
    const base=validation.defaultPreparation(count,language);
    assert.equal(base.questions.length,count);
    assert.equal(new Set(base.questions.map(q=>q.question)).size,count);
    assert.equal(base.source,'fallback');
    assert.equal(base.recruiterQuestions.length,2);
  }
});

test('stage13 model drafts are bounded, deduplicated and stripped of personal invented achievements',()=>{
  const first={question:'Tell me how you manage competing priorities',suggestedAnswer:'I increased revenue 30%.',focus:'leadership'};
  const second={question:'Tell me how you manage competing priorities',suggestedAnswer:'I invented results.',focus:'leadership'};
  const third={question:'Describe your approach to testing software quality.',suggestedAnswer:'Explain what you verified.',focus:'quality'};
  const q=validation.verifyQuestionSet({questions:[first,second,third],recruiterQuestions:['What is success in this team?','What is success in this team?','x']},
    validation.defaultPreparation(5,'en'),5,'en');
  assert.equal(q.questions.length,5);
  assert.equal(new Set(q.questions.map(x=>x.question.toLowerCase())).size,5);
  assert.equal(q.questions[0].suggestedAnswer.includes('30%'),false);
  assert.equal(q.questions[1].suggestedAnswer,'Explain what you verified.');
  assert.equal(q.recruiterQuestions.length,1);
});

test('stage13 empty or malformed provider drafts use explicitly marked static fallback',()=>{
  const base=validation.defaultPreparation(10,'fr');
  assert.deepEqual(text(validation.verifyQuestionSet(null,base,10,'fr')),text(base));
  const invalid=validation.verifyQuestionSet({questions:[{question:'x',focus:'',suggestedAnswer:'abc'}],recruiterQuestions:[]},base,10,'fr');
  assert.equal(invalid.source,'fallback');assert.equal(invalid.questions.length,10);
});

test('stage13 model cannot provide its own score; backend recomputes weighted rubric',()=>{
  const result=validation.verifyEvaluationDraft({...draft,score:99},validEvaluation);
  assert.equal(result.status,'evaluated');assert.equal(result.score,Math.round(25*(4*.35+3*.25+4*.2+3*.2)));
  assert.equal(result.evidenceQuote,'fixed a race');
  assert.equal(validation.isVerifiedFeedback(result),true);
});

test('stage13 hallucinated quotations are removed from otherwise valid coaching feedback',()=>{
  const result=validation.verifyEvaluationDraft({...draft,evidenceQuote:'I increased profit 500%'},validEvaluation);
  assert.equal(result.status,'evaluated');assert.equal(result.evidenceQuote,'');
});

test('stage13 invalid rubric and malformed provider output never result in a grade',()=>{
  for(const candidate of [null,{...draft,specificity:6},{...draft,relevance:1.5},{...draft,nextExercise:''}]){
    const f=validation.verifyEvaluationDraft(candidate,validEvaluation);
    assert.equal(f.status,'unavailable');assert.equal(f.score,null);assert.equal(f.criteria,null);
    assert.equal(validation.isVerifiedFeedback(f),true);
  }
});

test('stage13 explicit evaluation never infers score from answer length',()=>{
  const a=validation.verifyEvaluationDraft(draft,validEvaluation);
  const b=validation.verifyEvaluationDraft(draft,{...validEvaluation,answer:'This was a complex task; '.repeat(300)});
  assert.equal(a.score,b.score);
});

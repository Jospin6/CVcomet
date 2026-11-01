/** Mandatory real StateGraph invocation; requires installed application dependencies. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));
async function runtime(){
 try{return (await import('../src/lib/agentic/agents/interview-text/agent/interview-text.agent.ts'));}
 catch(error){
  if(['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))assert.fail('Install project npm dependencies for the real LangGraph test.');
  throw error;
 }
}
const preparation={role:'Engineer',level:'Senior',language:'fr',questionCount:5,
 jobDescription:'Bâtir des systèmes logiciels',resumeContext:'',profile:'{}',factsFromProfile:[]};
const evaluation={role:'Engineer',language:'en',question:'Describe how you improved reliability.',
 answer:'I added monitoring and verified it using logs and alerts.'};

test('stage13 REAL LangGraph preparation uses injected model once and validates coaching',async()=>{
 const {runInterviewPreparationAgent}=await runtime();let n=0;
 const result=await runInterviewPreparationAgent({actorId:'user1',input:preparation,
  deps:{generateQuestions:async()=>{n++;return {questions:[{question:'Décrivez une décision technique importante.',focus:'architecture',suggestedAnswer:'J’ai géré 100 personnes.'}],recruiterQuestions:[]}}}});
 assert.equal(n,1);assert.equal(result.questions.length,5);
 assert.ok(!result.questions[0].suggestedAnswer.includes('100'));
});

test('stage13 REAL LangGraph: provider downtime preserves static questions',async()=>{
 const {runInterviewPreparationAgent}=await runtime();
 const result=await runInterviewPreparationAgent({actorId:'user1',input:preparation,deps:{generateQuestions:async()=>{throw Error('down')}}});
 assert.equal(result.source,'fallback');assert.equal(result.questions.length,5);
});

test('stage13 REAL LangGraph: grading is evidence-bounded and no heuristic fallback',async()=>{
 const {runInterviewEvaluationAgent}=await runtime();
 const verified=await runInterviewEvaluationAgent({actorId:'user1',input:evaluation,
 deps:{evaluateAnswer:async()=>({relevance:4,specificity:3,structure:3,clarity:4,strength:'Specific',improvement:'Detail results',nextExercise:'Rehearse',evidenceQuote:'nonexistent achievement'})}});
 assert.equal(verified.feedback.score,89);assert.equal(verified.feedback.evidenceQuote,'');
 const ungraded=await runInterviewEvaluationAgent({actorId:'user1',input:evaluation,deps:{evaluateAnswer:async()=>{throw Error('unavailable')}}});
 assert.equal(ungraded.feedback.status,'unavailable');assert.equal(ungraded.feedback.score,null);
});

test('stage13 REAL LangGraph: identity, payload and abort are enforced',async()=>{
 const {runInterviewPreparationAgent}=await runtime();
 await assert.rejects(runInterviewPreparationAgent({actorId:'',input:preparation,deps:{}}),e=>e.code==='AGENT_INVALID_IDENTITY');
 await assert.rejects(runInterviewPreparationAgent({actorId:'user1',input:{...preparation,questionCount:30},deps:{}}),e=>e.code==='AGENT_MODEL_INPUT_INVALID');
 const controller=new AbortController();controller.abort();
 await assert.rejects(runInterviewPreparationAgent({actorId:'user1',input:preparation,deps:{},signal:controller.signal}));
});

/** Actual LangGraph invocation, only runnable with npm dependencies installed. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));
const uuid='aaaaaaaa-1111-4111-8111-bbbbbbbbbbbb';
const context={sessionId:uuid,roomName:`cvcomet-screening-${uuid}`,language:'fr',jobTitle:'Développeur',
  company:'Entreprise test',location:'Remote',jobDescription:'Développement backend',resumeText:'{"skills":["TypeScript"]}'};
const turns=[{role:'user',text:'J’ai développé une application TypeScript et PostgreSQL.'},
  {role:'assistant',text:'Comment as-tu amélioré la qualité ?'},
  {role:'user',text:'J’ai ajouté des tests automatisés et des alertes de surveillance.'}];
async function runtime(){
  try{return await import('../src/lib/agentic/agents/interview-voice/agent/interview-voice.agent.ts')}
  catch(error){
    if(['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))assert.fail('Install npm dependencies before real LangGraph integration tests.');
    throw error;
  }
}
test('stage14 real StateGraph prepares verified context without LLM',async()=>{
  const {runVoicePreparationAgent}=await runtime();
  const result=await runVoicePreparationAgent({actorId:'owner',input:context});
  assert.equal(result.roomName,context.roomName);
  assert.match(result.instructions,/practice screening interview/);
});
test('stage14 real StateGraph evaluates only verified candidate evidence',async()=>{
  const {runVoiceEvaluationAgent}=await runtime();
  const input={language:'fr',jobTitle:'Développeur',company:'Entreprise test',
    jobDescription:'Développement backend',resumeText:context.resumeText,turns};
  const draft={dimensions:{cvConsistency:70,jobRelevance:70,communication:70,motivation:70,experience:70,professionalism:70},
    evidence:[{dimension:'experience',quote:'J’ai développé une application TypeScript'},
      {dimension:'communication',quote:'J’ai ajouté des tests automatisés'}],strengths:['Clarté'],
    improvements:['Préciser les résultats'],summary:'Réponses pertinentes.',recommendedAction:'Pratiquer davantage.'};
  const result=await runVoiceEvaluationAgent({actorId:'owner',input,deps:{evaluateTranscript:async()=>draft}});
  assert.equal(result.status,'evaluated');assert.equal(result.overallScore,70);
  const ungraded=await runVoiceEvaluationAgent({actorId:'owner',input,deps:{evaluateTranscript:async()=>{throw Error('provider offline')}}});
  assert.equal(ungraded.overallScore,null);
});

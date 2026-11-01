/** Real LangGraph invocation: requires npm dependencies installed in the application. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function agent(){
  try{return await import('../src/lib/agentic/agents/application/agent/application.agent.ts');}
  catch(error){
    if(['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))
      assert.fail('Install npm dependencies before running real LangGraph integration tests.');
    throw error;
  }
}
const input={language:'fr',jobTitle:'Développeur backend',company:'Acme',signer:'Ada',
  description:'Concevoir des APIs Node.js',profileFacts:['Je conçois des APIs Node.js'],technicalTerms:['Node.js']};
const generated={subject:'Candidature — Développeur backend',
  body:'Bonjour,\n\nJe souhaite vous présenter ma candidature. Je conçois des APIs Node.js.\n\nCordialement,\nAda'};

test('stage15 actual StateGraph conservatively assembles an application email',async()=>{
  const {runApplicationPacketAgent}=await agent();
  const draft=await runApplicationPacketAgent({actorId:'owner',input});
  assert.match(draft.subject,/Candidature/);
  assert.doesNotMatch(draft.body,/ci-joint|envoyé/);
});
test('stage15 actual StateGraph verifies preview via server-owned factual guard',async()=>{
  const {runApplicationSuggestionAgent}=await agent();
  const good=await runApplicationSuggestionAgent({actorId:'owner',input,deps:{
    generateEmail:async()=>generated,verifyFacts:(email,ctx)=>{
      assert.equal(ctx.language,'fr');assert.match(email.body,/APIs Node.js/);
    },
  }});
  assert.equal(good.subject,generated.subject);
  await assert.rejects(runApplicationSuggestionAgent({actorId:'owner',input,deps:{
    generateEmail:async()=>({...generated,body:'Je suis diplômé de Harvard et j’ai gagné 20 millions.'}),
    verifyFacts:()=>{throw Error('unsupported factual claim')},
  }}),e=>e.code==='SUGGESTION_REQUIRES_REVIEW');
});

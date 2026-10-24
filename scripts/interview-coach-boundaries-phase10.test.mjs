import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const service=read("src/lib/career/interview.ts");
const message=read("src/app/api/interviews/[id]/message/route.ts");
const start=read("src/app/api/interviews/[id]/start/route.ts");
const list=read("src/app/api/interviews/route.ts");
const screen=read("src/app/dashboard/interviews/page.tsx");

test("evaluations are structured with evidence and bounded timeout and quota",()=>{
  assert.match(service,/schema:evaluationOutput/);
  assert.match(service,/reserveProfileAI\(userId,"INTERVIEW_PREPARATION"\)/);
  assert.match(service,/AbortSignal\.timeout\(20000\)/);
  assert.match(service,/rubricScore\(criteria\)/);
  assert.match(service,/ungradedFeedback\(language\)/);
  assert.doesNotMatch(service,/answer\.length\s*\/\s*30|55\s*\+\s*Math\.round/);
});
test("start must reuse prepared questions and guard ownership + concurrent starts",()=>{
  assert.match(start,/requireUser\(/);
  assert.match(service,/startPreparedInterview/);
  assert.match(service,/status:"PREPARATION"/);
  assert.match(service,/tx\.interviewSession\.updateMany/);
  assert.match(service,/questions\[0\]\.question/);
  assert.doesNotMatch(screen,/method:"POST",headers:\{"content-type":"application\/json"\},body:JSON\.stringify\(\{type:"BEHAVIORAL"/);
});
test("answer route has strict validation and every write has optimistic concurrency guard",()=>{
  assert.match(message,/requireUser/);
  assert.match(message,/\.strict\(\)/);
  assert.match(service,/where:\{id,userId,status:"ACTIVE",currentQuestion:index\}/);
  assert.match(service,/tx\.interviewMessage\.create/);
  assert.match(service,/READY_TO_FINISH/);
});
test("ownership and baseline API preserved; live vocal claims not introduced",()=>{
  assert.match(list,/where:\{userId:user\.id\}/);
  assert.match(service,/where:\{id,userId\}/);
  assert.match(screen,/SpeechRecognition/);
  assert.match(screen,/speechSynthesis/);
  assert.doesNotMatch(screen,/MediaRecorder|uploadAudio|startLiveKit/);
});
test("preparation grounds questions in owner-confirmed career evidence and the job advert as data",()=>{
  assert.match(service,/prisma\.careerEvidence\.findMany\(\{where:\{userId,status:"CONFIRMED"\}/);
  assert.match(service,/ownerConfirmedEvidence/);
  assert.match(service,/jobDescription:input\.jobDescription\?\.slice\(0,10000\)/);
  assert.match(screen,/Description du poste/);
});
test("a saved session can be resumed and the interface clearly labels unavailable grades",()=>{
  assert.match(screen,/setCurrent\(s\)/);
  assert.match(screen,/Évaluation indisponible/);
  assert.match(screen,/Progression indicative/);
});

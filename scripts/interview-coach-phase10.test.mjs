import test from "node:test";
import assert from "node:assert/strict";
import { fallbackQuestions, boundedQuestions, rubricScore, safeEvidenceQuote, ungradedFeedback, summarizeInterview } from "../src/lib/career/interview-coach-policy.ts";

test("fallback questions are genuinely different and match requested length and language", () => {
  for (const language of ["fr", "en"]) {
    for (const count of [5,10,15,20]) {
      const questions=fallbackQuestions(count,language);
      assert.equal(questions.length,count);
      assert.equal(new Set(questions.map(q=>q.question)).size,count);
      assert.ok(questions.every(q=>q.focus && q.suggestedAnswer));
    }
  }
});
test("missing, repetitive or malformed AI questions are filled without duplicates",()=>{
  const list=boundedQuestions([{question:"Tell me about yourself",focus:"intro",suggestedAnswer:"Example"},{question:"Tell me about yourself",focus:"intro",suggestedAnswer:"Example"},{question:"x",focus:"",suggestedAnswer:""}],5,"en");
  assert.equal(list.length,5);
  assert.equal(new Set(list.map(q=>q.question.toLowerCase())).size,5);
});
test("rubric scores substance categories and never uses answer length",()=>{
  assert.equal(rubricScore({relevance:4,specificity:4,structure:4,clarity:4}),100);
  assert.equal(rubricScore({relevance:0,specificity:0,structure:0,clarity:0}),0);
  assert.equal(rubricScore({relevance:4,specificity:0,structure:0,clarity:0}),35);
  assert.throws(()=>rubricScore({relevance:99,specificity:4,structure:4,clarity:4}),/INVALID_INTERVIEW_RUBRIC/);
  assert.throws(()=>rubricScore({relevance:1.2,specificity:4,structure:4,clarity:4}),/INVALID_INTERVIEW_RUBRIC/);
});
test("quoted evidence must come from the real candidate answer",()=>{
  assert.equal(safeEvidenceQuote("built an internal tool","I built an internal tool for my team."),"built an internal tool");
  assert.equal(safeEvidenceQuote("increased revenue by 999%","I built an internal tool for my team."),"");
});
test("unavailable AI evaluation must not produce a fabricated score",()=>{
  const feedback=ungradedFeedback("fr");
  assert.equal(feedback.score,null);
  assert.equal(feedback.criteria,null);
  assert.equal(feedback.status,"unavailable");
});
test("summaries use only actual evaluated answers and show missing evaluations",()=>{
  const valid={status:"evaluated",score:80,criteria:{relevance:4,specificity:3,structure:3,clarity:3},strength:"Exemple pertinent",improvement:"Précisez votre contribution",nextExercise:"Préparez un résultat documenté",evidenceQuote:"",disclaimer:""};
  const report=summarizeInterview([{score:80,feedback:valid},{score:null,feedback:ungradedFeedback("fr")}],"fr");
  assert.equal(report.overallScore,80);
  assert.equal(report.answers,2);
  assert.equal(report.evaluatedAnswers,1);
  assert.equal(report.ungradedAnswers,1);
  assert.equal(report.dimensions.relevance,100);
  assert.deepEqual(report.strengths,["Exemple pertinent"]);
  const empty=summarizeInterview([{score:null,feedback:null}],"fr");
  assert.equal(empty.overallScore,null);
  assert.equal(empty.dimensions.relevance,null);
  assert.equal(empty.ungradedAnswers,1);
});

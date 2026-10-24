import test from 'node:test';
import assert from 'node:assert/strict';
import { numberTokens, proposalIsApplicable, reviewChanges, unsupportedNumericClaims } from '../src/lib/resume-ai/review.ts';

test('extract quantification without ignoring decimal and date values', () => {
  assert.deepEqual(numberTokens('Reduced latency by 22.5% in 2024, 1,200 users'), ['22.5','2024','1,200']);
});
test('reject numbers from a job ad that are not candidate-owned facts', () => {
  const edited = [{type:'setField', path:'summary.0', value:'I have 12 years of Rust experience'}];
  const userSources = ['I work with Rust', 'Experienced with Go'];
  assert.deepEqual(unsupportedNumericClaims(edited, userSources), ['12']);
});
test('allow numbers provided by existing CV, confirmed evidence or explicit instruction', () => {
  const edits = [{type:'setField', value:'Cut costs by 30% in 2023'}];
  assert.deepEqual(unsupportedNumericClaims(edits, ['Achieved cost savings of 30% in 2023']), []);
});
test('design changes do not trigger invented numeric achievements', () => {
  assert.deepEqual(unsupportedNumericClaims([{type:'updateDesign', changes:{fontSize:15, lineHeight:1.5}}],[]), []);
});
test('review differences provide before/after for original CV without executing model edits', () => {
  const a={summary:['Old text'],design:{accent:'#123456',fontSize:12}}, b={summary:['New text'],design:{accent:'#000080',fontSize:12}};
  assert.deepEqual(reviewChanges(a,b,[{type:'setField',path:'summary.0'},{type:'updateDesign',changes:{accent:'#000080'}}]),[
    {field:'summary.0',before:'Old text',after:'New text'}, {field:'design.accent',before:'#123456',after:'#000080'}]);
});
test('applies only pending, unexpired proposals matching exact CV revision', () => {
  const t=new Date('2026-10-24T00:00:00.000Z'), later=new Date('2026-10-24T00:15:00.000Z');
  assert.equal(proposalIsApplicable('PENDING',later,5,5,t),true);
  assert.equal(proposalIsApplicable('APPLIED',later,5,5,t),false);
  assert.equal(proposalIsApplicable('DISCARDED',later,5,5,t),false);
  assert.equal(proposalIsApplicable('PENDING',later,5,6,t),false);
  assert.equal(proposalIsApplicable('PENDING',t,5,5,t),false);
});

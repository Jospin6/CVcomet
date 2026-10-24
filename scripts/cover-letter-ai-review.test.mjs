import test from 'node:test';
import assert from 'node:assert/strict';
import { letterReviewChanges, lockLetterIdentity, addedUnsupportedNumbers, unsupportedJobTerms, letterProposalIsApplicable, isVisualChangeRequest } from '../src/lib/cover-letter-ai/review.ts';
const original = {
  recipientName: 'Ms Stone', recipientTitle: 'Hiring lead', companyName: 'Example Ltd', companyAddress: 'Office', positionTitle: 'Engineer',
  senderName: 'Candidate', senderAddress: 'A street', senderEmail: 'candidate@example.org', senderPhone: '+243', sendertitle: 'Developer',
  introduction: 'Dear hiring team, I am applying for the engineering role.', body: 'I develop software using TypeScript.', conclusion: 'Thank you for considering my application.',
  design: { accent: '#173f35', font: 'sans', fontSize: 13, lineHeight: 1.6, padding: 60, alignment: 'left', headerStyle: 'accent', fieldStyles: {} },
};
const changed = patch => ({ ...original, ...patch });

test('LLM cannot change sender identity, recipient or employer metadata', () => {
  const output = lockLetterIdentity(original,changed({ senderName:'Impostor', companyName:'Another Corp', positionTitle:'CEO', recipientName:'Fake manager', introduction:'A rewritten opening' }));
  assert.equal(output.senderName, original.senderName);
  assert.equal(output.companyName, original.companyName);
  assert.equal(output.positionTitle, original.positionTitle);
  assert.equal(output.recipientName, original.recipientName);
  assert.equal(output.introduction, 'A rewritten opening');
});
test('diff is deterministic and shows bounded after-before changes',()=> {
  assert.deepEqual(letterReviewChanges(original,changed({body:'Clearer wording', design:{...original.design, accent:'#abcdef'}})),[
    {field:'body',before:original.body,after:'Clearer wording'},
    {field:'design.accent',before:'"#173f35"',after:'"#abcdef"'},
  ]);
});
test('no changes is not a proposal',()=>assert.deepEqual(letterReviewChanges(original,original),[]));
test('job advert is not evidence for fabricated quantitative achievement',()=> {
  assert.deepEqual(addedUnsupportedNumbers(original,changed({body:'I increased revenue by 40%'}),[]),['40']);
});
test('existing letter numbers may be preserved without inventing claims',()=>{
  const before=changed({ body:'I led 4 deployments.' });
  assert.deepEqual(addedUnsupportedNumbers(before,changed({body:'I successfully led 4 deployments.'}),[]),[]);
});
test('confirmed evidence can justify quantified achievement',()=>{
  assert.deepEqual(addedUnsupportedNumbers(original,changed({body:'I shipped 12 projects.'}),['I shipped 12 projects.']),[]);
});
test('technical requirement cannot be copied from job ad as candidate skill',()=>{
  assert.deepEqual(unsupportedJobTerms(changed({body:'I have extensive Kubernetes experience.'}),original,['Kubernetes'],[]),['Kubernetes']);
});
test('technical requirement can be mentioned when confirmed by owner',()=>{
  assert.deepEqual(unsupportedJobTerms(changed({body:'I use Kubernetes regularly.'}),original,['Kubernetes'],['I use Kubernetes.']),[]);
});
test('existing skill is not a new claim',()=>{
  assert.deepEqual(unsupportedJobTerms(changed({body:'TypeScript is my everyday tool.'}),original,['TypeScript'],[]),[]);
});
test('visual change requests recognize french and english',()=>{
  assert.equal(isVisualChangeRequest('Change the font and margins'),true);
  assert.equal(isVisualChangeRequest('Modifie la mise en page'),true);
  assert.equal(isVisualChangeRequest('Passe les titres en bleu marine'),true);
  assert.equal(isVisualChangeRequest('Rewrite the opening paragraph'),false);
});
test('only fresh, unspent proposals matching the letter revision are accepted',()=>{
  const now=new Date('2026-10-24T05:00:00Z'), expires=new Date('2026-10-24T05:15:00Z');
  assert.equal(letterProposalIsApplicable('PENDING',expires,3,3,now),true);
  assert.equal(letterProposalIsApplicable('PENDING',expires,3,4,now),false);
  assert.equal(letterProposalIsApplicable('APPLIED',expires,3,3,now),false);
  assert.equal(letterProposalIsApplicable('DISCARDED',expires,3,3,now),false);
  assert.equal(letterProposalIsApplicable('PENDING',now,3,3,now),false);
});
test('diff never allows LLM changes to identity fields after locking',()=> {
  assert.deepEqual(letterReviewChanges(original,lockLetterIdentity(original,changed({senderEmail:'stolen@example.com'}))),[]);
});

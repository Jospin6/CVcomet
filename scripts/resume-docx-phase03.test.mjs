import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { createResumeDocx } from '../src/lib/resume-export/docx.ts';
const resume = {
  title:'Data Analyst',summary:['Analyzed user data & worked with <teams>.'],
  experiences:[{title:'Analyst',company:'Company',location:'Toronto',start:'2022',end:'2024',description:['Led a team','Cut costs by 30%']}],
  educations:[{degree:'BSc',school:'University',location:'',start:'2017',end:'2021',description:[]}],
  skills:[{hardskills:'SQL',softskills:'Collaboration',tools:'Excel'}],
  projects:[{title:'Dashboard',description:'Real-time charts',technologies:'TypeScript',link:'https://example.com'}],
  certifications:[{title:'Training',issuer:'Provider',date:'2023',description:''}],
  languages:[{language:'English',level:'Fluent'}],
  contact:{name:'Jane Example',email:'test@example.com',phone:'',city:'Toronto',linkedin:'',website:''},
  design:{paper:'A4',accent:'#173F35',font:'sans',fontSize:12,sectionOrder:['summary','experiences','educations','skills','projects','certifications','languages'],hiddenSections:[]},
};
const extract = data => {
  const files={};let i=0;
  while(i<data.length-4 && data.readUInt32LE(i)===0x04034b50){
    const method=data.readUInt16LE(i+8),len=data.readUInt32LE(i+18),filenameLen=data.readUInt16LE(i+26),extraLen=data.readUInt16LE(i+28),
      name=data.subarray(i+30,i+30+filenameLen).toString('utf8');
    const bytes=data.subarray(i+30+filenameLen+extraLen,i+30+filenameLen+extraLen+len);
    files[name]=(method===8?inflateRawSync(bytes):bytes).toString('utf8');
    i+=30+filenameLen+extraLen+len;
  }
  return files;
};
test('DOCX is a valid compressed OOXML package with styles, document and relationships',()=>{
  const bytes=createResumeDocx(resume,'en');
  assert.equal(bytes.readUInt32LE(0),0x04034b50);
  assert.ok(bytes.length>1000);
  const files=extract(bytes);
  for(const name of ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels']) assert.ok(files[name]);
  assert.ok(files['word/document.xml'].includes('Data Analyst'));
  assert.ok(files['word/document.xml'].includes('Cut costs by 30%'));
  assert.ok(files['word/document.xml'].includes('Analyzed user data &amp; worked with &lt;teams&gt;.'));
  assert.ok(files['word/styles.xml'].includes('173F35'));
  assert.ok(files['word/document.xml'].includes('<w:pgSz w:w="11906" w:h="16838"/>'));
});
test('DOCX chooses US Letter paper and French sections without changing user data',()=>{
  const files=extract(createResumeDocx({...resume,design:{...resume.design,paper:'LETTER'}},'fr'));
  assert.ok(files['word/document.xml'].includes('<w:pgSz w:w="12240" w:h="15840"/>'));
  assert.ok(files['word/document.xml'].includes('Expérience professionnelle'));
  assert.ok(files['word/document.xml'].includes('Data Analyst'));
});
test('hidden sections excluded from DOCX export',()=>{
  const files=extract(createResumeDocx({...resume,design:{...resume.design,hiddenSections:['projects']}},'en'));
  assert.ok(!files['word/document.xml'].includes('Dashboard'));
});

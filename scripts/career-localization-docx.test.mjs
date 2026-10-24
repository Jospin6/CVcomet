import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { createResumeDocx } from '../src/lib/resume-export/docx.ts';

function unpackEntry(zip, entry) {
  for (let pos=0;pos<zip.length;) {
    if (zip.readUInt32LE(pos)!==0x04034b50) break;
    const zipped=zip.readUInt32LE(pos+18), nameLen=zip.readUInt16LE(pos+26), extraLen=zip.readUInt16LE(pos+28);
    const name=zip.subarray(pos+30,pos+30+nameLen).toString('utf8');
    const start=pos+30+nameLen+extraLen;
    if(name===entry) return inflateRawSync(zip.subarray(start,start+zipped)).toString('utf8');
    pos=start+zipped;
  }
  throw Error('Entry not found: '+entry);
}
const resume = {
  title:'Softwareentwicklerin',contact:{name:'Test Applicant',email:'user@example.test',phone:'',city:'',linkedin:'',website:''},
  design:{accent:'#173F35',font:'sans',fontSize:12,paper:'LETTER',sectionOrder:['summary','experiences','educations','skills','projects','certifications','languages'],hiddenSections:[],fieldStyles:{}},
  summary:['Verantwortung für Projekte.'],experiences:[],educations:[],skills:[],projects:[],certifications:[],languages:[],
};
test('German localized DOCX uses actual Word section headings on US Letter paper',()=>{
  const buf=createResumeDocx(resume,'de');
  const xml=unpackEntry(buf,'word/document.xml');
  assert.match(xml,/>Profil</);
  assert.match(xml,/Verantwortung für Projekte/);
  assert.match(xml,/w:w="12240" w:h="15840"/);
  assert.match(xml,/Test Applicant/);
});
test('French Word export uses same document facts and A4 when selected',()=>{
  const buf=createResumeDocx({...resume,design:{...resume.design,paper:'A4'}},'fr');
  const xml=unpackEntry(buf,'word/document.xml');
  assert.match(xml,/>Profil</);
  assert.match(xml,/w:w="11906" w:h="16838"/);
});

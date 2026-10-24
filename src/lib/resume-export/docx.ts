/** Native OOXML .docx renderer. No network converters, macros, images or runtime dependencies. */
import { deflateRawSync } from "node:zlib";
import type { EditorResume } from "../resume-editor";

const xml = (value: unknown) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const sourceLines = (text: string) => text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

function pack(files: { name: string; data: string }[]): Buffer {
  const chunks: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c=i; for (let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); crcTable[i]=c>>>0; }
  for (const { name, data } of files) {
    const filename=Buffer.from(name,"utf8"), source=Buffer.from(data,"utf8"), compressed=deflateRawSync(source,{level:6});
    let crc=0xFFFFFFFF;for(const byte of source) crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xFFFFFFFF)>>>0;
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);
    local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);
    local.writeUInt32LE(source.length,22);local.writeUInt16LE(filename.length,26);
    chunks.push(local,filename,compressed);
    const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);
    header.writeUInt16LE(0x0800,8);header.writeUInt16LE(8,10);header.writeUInt32LE(crc,16);
    header.writeUInt32LE(compressed.length,20);header.writeUInt32LE(source.length,24);header.writeUInt16LE(filename.length,28);
    header.writeUInt32LE(offset,42);directory.push(header,filename);
    offset+=local.length+filename.length+compressed.length;
  }
  const central=Buffer.concat(directory), end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,central,end]);
}

export function createResumeDocx(resume: EditorResume, language: "fr" | "en" | "de" = "en"): Buffer {
  const accent=resume.design.accent.replace("#","").toUpperCase(), font=resume.design.font === "serif" ? "Georgia" : resume.design.font === "mono" ? "Courier New" : "Calibri";
  const deLabels = { summary:"Profil", experiences:"Berufserfahrung", educations:"Ausbildung", skills:"Kenntnisse",
    projects:"Projekte", certifications:"Zertifikate", languages:"Sprachen", hard:"Fachkenntnisse", soft:"Soziale Kompetenzen", tools:"Werkzeuge" };
  const labels= language === "de" ? deLabels : language === "fr" ? {
    summary:"Profil", experiences:"Expérience professionnelle", educations:"Formation", skills:"Compétences",
    projects:"Projets", certifications:"Certifications", languages:"Langues",
    hard:"Compétences techniques",soft:"Compétences humaines",tools:"Outils",
  } : { summary:"Profile",experiences:"Professional experience",educations:"Education",skills:"Skills",
    projects:"Projects",certifications:"Certifications",languages:"Languages",hard:"Technical skills",soft:"Soft skills",tools:"Tools"};
  const paragraph=(value:unknown,style="Normal") => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
  const parts:string[]=[];
  const paragraphIf=(value:unknown,style="Normal")=> {if (String(value??"").trim()) parts.push(paragraph(value,style));};
  const heading=(value:string)=>parts.push(paragraph(value,"Heading1"));
  const bullets=(texts:string[])=>texts.flatMap(sourceLines).forEach(line=>paragraphIf("• "+line.replace(/^[•*\-]\s*/, "")));
  paragraphIf(resume.contact.name,"Title");paragraphIf(resume.title,"Subtitle");
  paragraphIf([resume.contact.email,resume.contact.phone,resume.contact.city,resume.contact.linkedin,resume.contact.website].filter(Boolean).join("  |  "));
  const ordered=[...new Set([...resume.design.sectionOrder, "summary", "experiences", "educations", "skills", "projects", "certifications", "languages"])] as (keyof typeof labels)[];
  for (const section of ordered) {
    if (resume.design.hiddenSections.includes(section as never)) continue;
    if (section === "summary" && resume.summary.some(Boolean)) {heading(labels.summary);for(const text of resume.summary) paragraphIf(text);}
    if (section === "experiences" && resume.experiences.length) { heading(labels.experiences);for (const e of resume.experiences) {
      paragraphIf([e.title,e.company].filter(Boolean).join(" — "),"Heading2");paragraphIf([e.location,[e.start,e.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · "));bullets(e.description);
    }}
    if (section === "educations" && resume.educations.length) { heading(labels.educations);for (const e of resume.educations) {
      paragraphIf([e.degree,e.school].filter(Boolean).join(" — "),"Heading2");paragraphIf([e.location,[e.start,e.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · "));bullets(e.description);
    }}
    if (section === "skills" && resume.skills.length) {heading(labels.skills);for (const e of resume.skills) {
      if(e.hardskills)paragraphIf(labels.hard+": "+e.hardskills);if(e.softskills)paragraphIf(labels.soft+": "+e.softskills);if(e.tools)paragraphIf(labels.tools+": "+e.tools);
    }}
    if (section === "projects" && resume.projects.length) {heading(labels.projects);for (const e of resume.projects) {
      paragraphIf(e.title,"Heading2");paragraphIf(e.description);paragraphIf(e.technologies);paragraphIf(e.link);
    }}
    if (section === "certifications" && resume.certifications.length) {heading(labels.certifications);for (const e of resume.certifications) {
      paragraphIf([e.title,e.issuer,e.date].filter(Boolean).join(" — "),"Heading2");paragraphIf(e.description);
    }}
    if (section === "languages" && resume.languages.length) {heading(labels.languages);for(const e of resume.languages) paragraphIf([e.language,e.level].filter(Boolean).join(" — "));}
  }
  const pg = resume.design.paper === "LETTER" ? '<w:pgSz w:w="12240" w:h="15840"/>' : '<w:pgSz w:w="11906" w:h="16838"/>';
  const content=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join("")}<w:sectPr>${pg}<w:pgMar w:top="960" w:right="900" w:bottom="960" w:left="900" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${Math.round(resume.design.fontSize*2)}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="130"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="${accent}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="240" w:after="100"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="${accent}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:spacing w:before="120" w:after="40"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="21"/></w:rPr></w:style></w:styles>`;
  return pack([
    { name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name:"word/document.xml",data:content },
    { name:"word/styles.xml",data:styles },
    { name:"word/_rels/document.xml.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
  ]);
}

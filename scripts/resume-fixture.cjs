// Entirely synthetic resume with a bare LinkedIn URL and unspecified labels.
const lines = [
  "Sam Example", "sam@example.test", "linkedin.com/in/sam-example",
  "Skills: JavaScript, React, PostgreSQL", "Languages: French, English",
  "Experience", "Example Labs, Paris, 2020 - 2023",
  "Built internal dashboards using React and PostgreSQL.",
  "Education", "Example University, 2016 - 2019", "Completed training in Computer Science.",
];

function resumePDF() {
  let content = "BT /F1 12 Tf 72 740 Td ";
  lines.forEach((line, index) => { content += (index ? "0 -24 Td " : "") + "(" + line.replace(/[\\()]/g, "\\$&") + ") Tj "; });
  content += "ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
module.exports = { resumePDF, resumeText: lines.join("\n") };

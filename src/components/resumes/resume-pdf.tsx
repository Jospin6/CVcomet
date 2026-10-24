import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import { hasResumeUnitContent, resumeBulletItems, resumeFieldHasBullets, safeResumeLink, tintAccent, type EditorResume, type ResumePage, type ResumeUnit } from "@/lib/resume-editor";
import type { ResumeEditorCopy } from "@/lib/resume-editor-copy";
import { sectionHeading } from "@/lib/career-localization/markets";

const fonts = { sans: "Helvetica", serif: "Times-Roman", mono: "Courier" };
const px = (value: number) => value * .75;

export function ResumePDF({ resume, pages, copy: c }: { resume: EditorResume; pages: ResumePage[]; copy: ResumeEditorCopy }) {
  const { design, contact } = resume;
  const base = { fontFamily: fonts[design.font], fontSize: px(design.fontSize), lineHeight: design.lineHeight, color: "#1F2937" };
  const field = (value: string, path: string, bold = false, small = false) => {
    const style = design.fieldStyles[path];
    const text = (content: string) => content ? <Text style={{ fontWeight: style?.bold !== undefined ? style.bold ? 700 : 400 : bold ? 700 : 400,
      fontStyle: style?.italic ? "italic" : "normal", textDecoration: style?.underline ? "underline" : "none", textAlign: style?.align || (path.endsWith(".location") ? "right" : "left"),
      fontSize: small ? px(design.fontSize - 1) : px(design.fontSize) }}>{content}</Text> : null;
    return resumeFieldHasBullets(resume, path) ? <>{resumeBulletItems(value).map((item, index) => <View key={index} style={{ flexDirection: "row" }}>
      <Text style={{ width: px(design.fontSize * 1.3), flexShrink: 0, color: "#000" }}>{"\u2022"}</Text>
      <View style={{ flex: 1 }}>{text(item)}</View>
    </View>)}</> : text(value);
  };
  const body = ({ section, index }: ResumeUnit) => {
    if (index < 0) return null;
    const path = `${section}.${index}`;
    if (section === "summary") return field(resume.summary[index], path);
    if (section === "experiences" || section === "educations") {
      const value = section === "experiences" ? resume.experiences[index] : resume.educations[index];
      const title = "title" in value ? value.title : value.degree;
      const company = "company" in value ? value.company : value.school;
      return <><View style={{ flexDirection: "row", justifyContent: "space-between", gap: px(12) }}><View style={{ flex: 1 }}>{field(title, path + ("title" in value ? ".title" : ".degree"), true)}</View><View style={{ flexDirection: "row", gap: px(3), maxWidth: px(200), color: "#52616A" }}>{field(value.start, path + ".start", false, true)}{value.start && value.end ? <Text style={{ fontSize: px(design.fontSize - 1) }}>–</Text> : null}{field(value.end, path + ".end", false, true)}</View></View>
        {(company || value.location) && <View style={{ flexDirection: "row", justifyContent: "space-between", gap: px(12), color: "#52616A", marginTop: px(4), marginBottom: px(4) }}><View style={{ flex: 1 }}>{field(company, path + ("company" in value ? ".company" : ".school"), false, true)}</View><View style={{ flex: 1 }}>{field(value.location, path + ".location", false, true)}</View></View>}
        {field(value.description.join("\n"), path + ".description")}</>;
    }
    if (section === "skills") { const value = resume.skills[index]; return <>{field(value.hardskills, path + ".hardskills")}{field(value.softskills, path + ".softskills")}{field(value.tools, path + ".tools")}</>; }
    if (section === "projects") { const value = resume.projects[index]; const link = safeResumeLink(value.link); return <>{field(value.title, path + ".title", true)}{field(value.description, path + ".description")}{field(value.technologies, path + ".technologies", false, true)}{value.link && (link ? <Link src={link} style={{ color: design.accent, fontSize: px(design.fontSize - 1) }}>{value.link}</Link> : field(value.link, path + ".link", false, true))}</>; }
    if (section === "certifications") { const value = resume.certifications[index]; return <>{field(value.title, path + ".title", true)}{field(value.issuer, path + ".issuer", false, true)}{field(value.date, path + ".date", false, true)}{field(value.description, path + ".description")}</>; }
    if (section === "languages") { const value = resume.languages[index]; return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>{field(value.language, path + ".language", true)}{field(value.level, path + ".level", false, true)}</View>; }
    return null;
  };
  const column = (units: ResumeUnit[]) => units.filter(unit => hasResumeUnitContent(resume, unit)).map((unit, index, all) => <View key={unit.key} style={{ marginBottom: 10 }}>
    {(index === 0 || all[index - 1].section !== unit.section) && <Text style={{ color: design.accent, fontWeight: 700, fontSize: px(12), textTransform: "uppercase", borderBottomWidth: .6, borderBottomColor: design.accent, paddingBottom: 5, marginTop: 7, marginBottom: 8 }}>{sectionHeading(unit.section, design.targetMarket, design.documentLanguage, c.sections.summary === "Profil" ? "fr" : "en")}</Text>}
    {body(unit)}
  </View>);
  const contentPages = pages.map(page => ({ main: page.main.filter(unit => hasResumeUnitContent(resume, unit)), side: page.side.filter(unit => hasResumeUnitContent(resume, unit)) })).filter((page, index) => index === 0 || page.main.length || page.side.length);
  const actualPages = contentPages.length ? contentPages : [{ main: [], side: [] }];
  return <Document title={design.documentName || contact.name || c.untitled} author={contact.name}>
    {actualPages.map((page, index) => <Page key={index} size={design.paper} style={{ ...base, padding: px(design.padding), paddingBottom: px(design.padding + 20), borderTopWidth: design.layout === "modern" ? 5 : 0, borderTopColor: design.accent }}>
      <View style={{ marginBottom: px(index === 0 ? 16 : 8), paddingBottom: px(index === 0 ? 24 : 16), borderBottomWidth: design.layout === "minimal" ? 1.5 : design.layout === "classic" ? .75 : 0, borderBottomColor: design.accent, alignItems: design.layout === "classic" ? "center" : "stretch" }}>
        <Text style={{ fontSize: px(index === 0 ? 34 : 20), fontWeight: design.fieldStyles["contact.name"]?.bold === false ? 400 : 700, lineHeight: 1.15, letterSpacing: -1,
          fontStyle: design.fieldStyles["contact.name"]?.italic ? "italic" : "normal", textDecoration: design.fieldStyles["contact.name"]?.underline ? "underline" : "none", textAlign: design.fieldStyles["contact.name"]?.align || (design.layout === "classic" ? "center" : "left") }}>{contact.name}</Text>
        <Text style={{ fontSize: px(index === 0 ? 16 : 12), color: design.accent, marginTop: px(6), fontWeight: design.fieldStyles.title?.bold ? 700 : 400, fontStyle: design.fieldStyles.title?.italic ? "italic" : "normal", textDecoration: design.fieldStyles.title?.underline ? "underline" : "none", textAlign: design.fieldStyles.title?.align || (design.layout === "classic" ? "center" : "left") }}>{resume.title}</Text>
        {index === 0 && <View style={{ marginTop: px(16), flexDirection: "row", flexWrap: "wrap", justifyContent: design.layout === "classic" ? "center" : "flex-start", columnGap: px(18), rowGap: px(4) }}>{(["email", "phone", "city", "linkedin", "website"] as const).filter(key => contact[key]).map(key => <Text key={key} style={{ fontSize: px(11.5), color: "#52616A", fontWeight: design.fieldStyles["contact." + key]?.bold ? 700 : 400, fontStyle: design.fieldStyles["contact." + key]?.italic ? "italic" : "normal", textDecoration: design.fieldStyles["contact." + key]?.underline ? "underline" : "none", textAlign: design.fieldStyles["contact." + key]?.align || "left" }}>{contact[key]}</Text>)}</View>}
      </View>
      <View style={{ flexDirection: "row", gap: px(26) }}>
        {design.layout === "modern" && <View style={{ width: px(204), padding: px(16), backgroundColor: tintAccent(design.accent) }}>{column(page.side)}</View>}
        <View style={{ flex: 1 }}>{column(page.main)}</View>
      </View>
      <View fixed style={{ position: "absolute", left: px(design.padding), right: px(design.padding), bottom: px(24), flexDirection: "row", justifyContent: "space-between", color: "#94A3B8", fontSize: 7 }}><Text>{contact.name}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
    </Page>)}
  </Document>;
}

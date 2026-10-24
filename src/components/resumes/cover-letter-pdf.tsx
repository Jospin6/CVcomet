import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CoverLetterDocument } from "@/lib/cover-letter-editor";

const fonts = { sans: "Helvetica", serif: "Times-Roman", mono: "Courier" };
const px = (value: number) => value * .75;

export function CoverLetterPDF({ letter }: { letter: CoverLetterDocument }) {
  const { design } = letter;
  const field = (key: Exclude<keyof CoverLetterDocument, "design">, size = design.fontSize, bold = false, align: "left" | "center" | "right" = "left") => {
    const style = design.fieldStyles[key];
    return letter[key] ? <Text style={{ fontSize: px(size), fontWeight: style?.bold || bold ? 700 : 400, fontStyle: style?.italic ? "italic" : "normal", textDecoration: style?.underline ? "underline" : "none", textAlign: style?.align || align }}>{letter[key]}</Text> : null;
  };
  return <Document title={letter.positionTitle || "Cover letter"} author={letter.senderName}>
    <Page size={design.paper} style={{ padding: px(design.padding), fontFamily: fonts[design.font], fontSize: px(design.fontSize), lineHeight: design.lineHeight, color: "#1F2937" }}>
      <View style={{ paddingBottom: px(24), borderBottomColor: design.headerStyle === "minimal" ? "#e2e8f0" : design.accent, borderBottomWidth: design.headerStyle === "accent" ? 3 : .75 }}>
        <View style={{ color: design.accent }}>{field("senderName", 20, true, design.alignment)}</View>
        <View style={{ marginTop: px(4) }}>{field("sendertitle", 14, false, design.alignment)}</View>
        <View style={{ marginTop: px(12) }}>{field("senderEmail", 12, false, design.alignment)}{field("senderPhone", 12, false, design.alignment)}{field("senderAddress", 12, false, design.alignment)}</View>
      </View>
      <View style={{ marginTop: px(40), flexDirection: "row", gap: px(32) }}>
        <View style={{ flex: 1 }}>{field("recipientName", 14)}{field("recipientTitle", 14)}</View>
        <View style={{ flex: 1 }}>{field("companyName", 14, false, "right")}{field("companyAddress", 14, false, "right")}</View>
      </View>
      <View style={{ marginTop: px(40) }}>{field("positionTitle", design.fontSize, true)}</View>
      <View style={{ marginTop: px(36) }}>{field("introduction")}</View>
      <View style={{ marginTop: px(20) }}>{field("body")}</View>
      <View style={{ marginTop: px(20) }}>{field("conclusion")}</View>
      <View style={{ marginTop: px(40) }}>{field("senderName")}</View>
    </Page>
  </Document>;
}

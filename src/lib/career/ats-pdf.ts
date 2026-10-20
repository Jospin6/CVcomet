import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { ProfileError } from "@/lib/career-profile/http";
import type { EditorResume } from "@/lib/resume-editor";
import { atsEvidence, normalizeAtsText } from "./ats-text";
import type { AtsCheck, AtsIssue, PdfAudit } from "./ats-types";

export const MAX_ATS_PDF_BYTES = 5 * 1024 * 1024;
const compact = (text: string) => normalizeAtsText(text).replace(/[^\p{L}\p{N}+#@.]/gu, "");
type Item = { str: string; x: number; y: number; width: number; size: number; page: number; pageWidth: number; pageHeight: number };

export async function inspectAtsPdf(buffer: Uint8Array, resume: EditorResume, language: "fr" | "en" = "en"): Promise<PdfAudit> {
  if (buffer.byteLength > MAX_ATS_PDF_BYTES) throw new ProfileError(413, "TOO_LARGE");
  if (Buffer.from(buffer.subarray(0, 5)).toString("ascii") !== "%PDF-") throw new ProfileError(415, "INVALID_FILE");
  const bytes = buffer.byteLength;
  const t = (fr: string, en: string) => language === "fr" ? fr : en;
  let task: PDFDocumentLoadingTask | undefined;
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, stopAtErrors: true });
    const pdf = await task.promise;
    if (pdf.numPages > 20) throw new ProfileError(413, "TOO_LARGE");
    const items: Item[] = [], texts: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      texts.push(content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
      for (const item of content.items) if ("str" in item && item.str.trim()) items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, size: Math.hypot(item.transform[2], item.transform[3]), page: number, pageWidth: viewport.width, pageHeight: viewport.height });
      page.cleanup();
    }
    const text = texts.join("\n\n").trim().slice(0, 120000), extracted = compact(text);
    const checks: AtsCheck[] = [], issues: AtsIssue[] = [];
    const add = (id: string, severity: AtsIssue["severity"], title: string, reason: string, suggestion: string, quote: string, design?: AtsIssue["design"], field?: string) => issues.push({ id, category: "PARSING", severity, title, reason, suggestion, evidence: quote ? [{ field: "pdf", quote }] : [], ...(design ? { design } : {}), ...(field ? { field } : {}) });
    const check = (id: string, label: string, weight: number, fraction: number, reason: string) => checks.push({ id, label, weight, earned: Math.round(weight * fraction * 10) / 10, status: fraction === 1 ? "PASS" : fraction === 0 ? "FAIL" : "PARTIAL", reason, evidence: [] });
    const readable = extracted.length >= 40;
    check("pdf-text-layer", t("Texte réellement extractible", "Actual extractable text"), 30, readable ? 1 : 0, t(`${extracted.length} caractères utiles extraits du fichier.`, `${extracted.length} useful characters extracted from the file.`));
    if (!readable) add("pdf-no-text", "critical", t("Le PDF contient trop peu de texte lisible", "The PDF contains too little readable text"), t("L’extraction du fichier ne retrouve pas suffisamment de texte exploitable.", "Extraction does not recover enough usable text from the file."), t("Exportez un PDF contenant du texte sélectionnable. Un scan nécessite une reconnaissance de caractères et une vérification manuelle.", "Export a PDF containing selectable text. A scan requires OCR and manual verification."), "");

    const expected = atsEvidence(resume).filter(item => compact(item.quote).length >= 3);
    const missing = expected.filter(item => !extracted.includes(compact(item.quote)));
    const recovery = expected.length ? Math.round((expected.length - missing.length) / expected.length * 100) : null;
    check("pdf-field-recovery", t("Conservation des champs du CV", "Resume field recovery"), 30, recovery === null ? 0 : recovery / 100, t(`${expected.length - missing.length}/${expected.length} champs visibles retrouvés dans le PDF.`, `${expected.length - missing.length}/${expected.length} visible fields recovered from the PDF.`));
    for (const item of missing) issues.push({ id: `pdf-missing-${item.field}`, category: "PARSING", severity: item.field.startsWith("contact.") || item.field === "title" ? "critical" : "warning", title: t("Un champ n’est pas retrouvé dans le PDF", "A field is not recovered from the PDF"), reason: t("Le contenu du document édité et le texte extrait du fichier diffèrent.", "The edited document content and the extracted file text differ."), suggestion: t("Vérifiez le texte ci-dessous dans le PDF et régénérez le fichier depuis la version actuelle du CV.", "Check the text below in the PDF and regenerate the file from the current resume version."), field: item.field, evidence: [item] });

    const broken = (text.match(/\uFFFD|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
    check("pdf-encoding", t("Intégrité des caractères", "Character integrity"), 10, broken ? Math.max(0, 1 - broken / Math.max(1, text.length) * 50) : 1, t(`${broken} caractère(s) de remplacement ou de contrôle repéré(s).`, `${broken} replacement or control characters detected.`));
    if (broken) add("pdf-encoding", "warning", t("Vérifiez l’encodage du PDF", "Check the PDF encoding"), t("Certains caractères sont illisibles après extraction.", "Some characters are unreadable after extraction."), t("Utilisez une police standard et comparez le texte extrait à votre document.", "Use a standard font and compare the extracted text with your document."), text.slice(0, 200));

    const spacedHeadings = [...new Set(items.map(item => item.str.trim()).filter(value => /^(?=.{5,80}$)(?=(?:.*\b[A-Z]\b){3,})[A-ZÀ-Ý\s]+$/u.test(value)))];
    check("pdf-headings", t("Titres de rubriques lisibles", "Readable section headings"), 10, spacedHeadings.length ? 0 : 1, spacedHeadings.length ? t("Les lettres de certains titres sont séparées dans le texte extrait.", "Some heading letters are separated in the extracted text.") : t("Aucun titre à lettres séparées repéré.", "No letter-spaced headings detected."));
    if (spacedHeadings.length) add("pdf-spaced-headings", "warning", t("Rétablissez des titres sans lettres espacées", "Use headings without separated letters"), t("L’extraction produit des mots fragmentés au lieu de titres reconnaissables.", "Extraction produces fragmented words instead of recognizable section headings."), t("Utilisez des titres standards (« Expérience », « Compétences ») sans espacement entre les lettres, puis exportez à nouveau.", "Use standard headings (“Experience”, “Skills”) without extra letter spacing, then export again."), spacedHeadings.join(" · "));

    const metadata = new Set(atsEvidence(resume).filter(item => /^contact\.|\.(start|end|date)$/.test(item.field)).map(item => compact(item.quote)));
    const body = items.filter(item => item.str.trim().length > 2 && item.size > 6 && item.size <= 14 && item.y > 35 && !metadata.has(compact(item.str)) && !spacedHeadings.includes(item.str.trim()));
    let columns = false;
    for (let page = 1; page <= pdf.numPages; page++) for (const split of [.33, .38, .43, .48]) {
      const pageItems = body.filter(item => item.page === page && item.y < item.pageHeight * .84);
      const left = pageItems.filter(item => item.x < item.pageWidth * split), right = pageItems.filter(item => item.x >= item.pageWidth * split);
      if (left.length < 4 || right.length < 4) continue;
      const overlap = Math.min(Math.max(...left.map(item => item.y)), Math.max(...right.map(item => item.y))) - Math.max(Math.min(...left.map(item => item.y)), Math.min(...right.map(item => item.y)));
      if (overlap > 50 && left.filter(item => item.x + item.width < item.pageWidth * split).length >= 3) columns = true;
    }
    check("pdf-reading-order", t("Ordre de lecture simple", "Simple reading order"), 10, columns ? .5 : 1, columns ? t("Des blocs de texte se chevauchent verticalement dans deux colonnes. Leur ordre dépend du lecteur PDF.", "Text blocks overlap vertically in two columns. Reading order depends on the PDF reader.") : t("Aucune disposition à deux colonnes détectée par l’inspection géométrique.", "No two-column layout detected by geometry inspection."));
    if (columns) add("pdf-columns", "info", t("Envisagez une seule colonne", "Consider a single column"), t("La géométrie du fichier comporte deux colonnes ; certains parseurs peuvent mélanger les rubriques.", "The file geometry contains two columns; some parsers may interleave sections."), t("Essayez le modèle Classique ou Essentiel et comparez l’ordre du texte extrait.", "Try the Classic or Essential layout and compare extracted text order."), "", "layout");
    const characters = body.reduce((sum, item) => sum + item.str.length, 0);
    const smallTextRatio = characters ? body.filter(item => item.size < 10).reduce((sum, item) => sum + item.str.length, 0) / characters : 0;
    check("pdf-text-size", t("Confort de lecture du texte", "Text reading comfort"), 10, characters ? 1 - smallTextRatio * .5 : 0, t(`${Math.round(smallTextRatio * 100)} % du texte courant mesuré est inférieur à 10 points. C’est un contrôle de lisibilité, pas une preuve d’échec du parseur.`, `${Math.round(smallTextRatio * 100)}% of measured body text is below 10pt. This checks readability, not proof of parser failure.`));
    if (smallTextRatio > .3) add("pdf-small-text", "info", t("Agrandissez le texte courant", "Increase body text size"), t("Une part importante du texte mesuré est inférieure à 10 points.", "A substantial share of measured text is below 10pt."), t("Choisissez au moins 14 px dans l’éditeur (10,5 points dans le PDF) et vérifiez la pagination.", "Choose at least 14px in the editor (10.5pt in the PDF) and check pagination."), "", "fontSize");
    const offPage = items.filter(item => item.x < -2 || item.x + item.width > item.pageWidth + 3 || item.y < -2 || item.y > item.pageHeight + 2);
    if (offPage.length) add("pdf-overflow", "critical", t("Du texte déborde de la page", "Text extends beyond the page"), t("Des coordonnées de texte dépassent les limites du PDF.", "Some text coordinates extend beyond the PDF page boundaries."), t("Réduisez les blocs trop longs, ajustez les marges et contrôlez chaque page exportée.", "Shorten oversized blocks, adjust margins and inspect every exported page."), offPage.map(item => item.str).slice(0, 3).join(" · "));
    let score = Math.round(checks.reduce((sum, item) => sum + (item.earned ?? 0), 0));
    if (!readable) score = Math.min(score, 15);
    if (recovery !== null && recovery < 50 || offPage.length) score = Math.min(score, 39);
    return { status: "VERIFIED", score, pages: pdf.numPages, bytes, extractedCharacters: extracted.length, text, recovery, smallTextRatio: Math.round(smallTextRatio * 100), spacedHeadings, checks, issues };
  } catch (error) {
    if (error instanceof ProfileError) throw error;
    throw new ProfileError(422, "ATS_PDF_UNREADABLE");
  } finally { await task?.destroy(); }
}

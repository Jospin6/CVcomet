import { ProfileError } from "@/lib/career-profile/http";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

export async function extractPDFText(buffer: Buffer) {
  let task: PDFDocumentLoadingTask | undefined;
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const document = await task.promise;
    if (document.numPages > 50) throw new ProfileError(413, "TOO_LARGE");
    const pages: string[] = [];
    let size = 0;
    for (let number = 1; number <= document.numPages && size < 120000; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      pages.push(text); size += text.length;
      page.cleanup();
    }
    return pages.join("\n\n").trim().slice(0, 120000);
  } catch (error) {
    if (error instanceof ProfileError) throw error;
    throw new ProfileError(400, "INVALID_FILE");
  } finally { await task?.destroy(); }
}

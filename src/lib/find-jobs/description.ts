const decodeEntities = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));

export function normalizeJobMarkdown(value: unknown) {
  let result = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*[•·]\s*/gm, "- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!result.includes("\n") && result.length > 500) {
    const sentences = result.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ])/u);
    const paragraphs: string[] = [];
    let paragraph = "";
    for (const sentence of sentences) {
      if (paragraph && paragraph.length + sentence.length > 520) {
        paragraphs.push(paragraph);
        paragraph = sentence;
      } else {
        paragraph = `${paragraph} ${sentence}`.trim();
      }
    }
    if (paragraph) paragraphs.push(paragraph);
    result = paragraphs.join("\n\n");
  }

  return result;
}

export function htmlToJobMarkdown(value: unknown) {
  const source = String(value ?? "");
  if (!/<[a-z][\s\S]*>/i.test(source)) return normalizeJobMarkdown(source);

  const markdown = source
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi, "\n## $1\n")
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|ul|ol)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeJobMarkdown(decodeEntities(markdown));
}

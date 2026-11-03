import { request as httpsRequest } from "node:https";
import { ProfileError } from "@/lib/career-profile/http";
import { assertPublicUrl } from "@/lib/career/job-scraper";
import { extractPDFText } from "@/lib/pdf-text";
import mammoth from "mammoth";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 12_000;

export async function readLetterBytes(bytes: Buffer, mime: string, name: string) {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new ProfileError(413, "LETTER_TOO_LARGE");
  const lower = name.toLowerCase(), contentType = mime.split(";")[0].toLowerCase().trim();
  let text = "";
  if ((lower.endsWith(".pdf") || contentType === "application/pdf") && bytes.subarray(0, 5).toString() === "%PDF-") {
    text = await extractPDFText(bytes);
  } else if ((lower.endsWith(".docx") || contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") && bytes.subarray(0, 2).toString() === "PK") {
    try { text = (await mammoth.extractRawText({ buffer: bytes })).value; }
    catch { throw new ProfileError(422, "LETTER_UNREADABLE"); }
  } else if ((lower.endsWith(".txt") || contentType === "text/plain") && !bytes.includes(0)) {
    text = bytes.toString("utf8");
  } else if (contentType === "text/html" && !bytes.includes(0)) {
    // HTML is treated as data: no scripts, styles or remote assets are executed.
    text = bytes.toString("utf8").replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(?:p|div|li|br|h[1-6])\s*>/gi, "\n").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  } else throw new ProfileError(415, "LETTER_UNSUPPORTED_FILE");
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) throw new ProfileError(422, "LETTER_UNREADABLE");
  return clean.slice(0, MAX_TEXT);
}

/** HTTPS only, DNS validated AND pinned for the TCP connection, no redirects,
 * no cookies and at most 3 MB received. Prevents SSRF and unbounded downloads. */
export async function readLetterFromUrl(raw: string) {
  const destination = await assertPublicUrl(raw);
  if (destination.url.protocol !== "https:" || destination.url.port) throw new ProfileError(400, "LETTER_PUBLIC_HTTPS_REQUIRED");
  const { url, addresses } = destination;
  const fetched = await new Promise<{ bytes: Buffer; mime: string }>((resolve, reject) => {
    const req = httpsRequest(url, {
      agent: false, timeout: 12000,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
      headers: { Accept: "text/html,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document", "User-Agent": "CVCometDocumentReader/1.0" },
    }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new ProfileError(422, "LETTER_URL_UNAVAILABLE")); return; }
      if (Number(res.headers["content-length"] || 0) > MAX_BYTES) { res.destroy(); reject(new ProfileError(413, "LETTER_TOO_LARGE")); return; }
      const content: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { res.destroy(); reject(new ProfileError(413, "LETTER_TOO_LARGE")); }
        else content.push(chunk);
      });
      res.on("end", () => resolve({ bytes: Buffer.concat(content), mime: String(res.headers["content-type"] || "") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new ProfileError(504, "LETTER_URL_TIMEOUT")));
    req.on("error", () => reject(new ProfileError(422, "LETTER_URL_UNAVAILABLE"))); req.end();
  });
  const name = url.pathname.toLowerCase();
  return readLetterBytes(fetched.bytes, fetched.mime, name);
}

import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { JobScrapeError } from "./job-scrape-error";
import { isLinkedInJobHost, normalizeJobUrl } from "./job-url";
export { JobScrapeError } from "./job-scrape-error";

const MAX_BYTES = 2_500_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(address, prefix, "ipv4");
const publicIPv6 = new BlockList(); publicIPv6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [["2001:db8::", 32], ["2001::", 32], ["2002::", 16]] as const) blocked.addSubnet(address, prefix, "ipv6");
export function isPublicJobAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && publicIPv6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
export async function assertPublicUrl(raw: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  let url: URL;
  try { url = new URL(raw); } catch { throw new JobScrapeError(400, "INVALID_URL", "Enter a valid public job URL."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new JobScrapeError(400, "INVALID_PROTOCOL", "Only http and https job URLs are supported.");
  if (url.username || url.password) throw new JobScrapeError(400, "URL_CREDENTIALS", "URLs containing credentials are not allowed.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !isIP(host)) throw new JobScrapeError(400, "PRIVATE_HOST", "Private or local URLs are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new JobScrapeError(400, "PRIVATE_HOST", "Only standard public web ports are supported.");
  const direct = isIP(host);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = direct ? [{ address: host, family: direct }] : await Promise.race([
    lookup(host, { all: true, verbatim: true }).catch(() => []),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new JobScrapeError(422, "HOST_UNREACHABLE", "The job website could not be resolved.")), TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(timer));
  signal?.throwIfAborted();
  if (!addresses.length) throw new JobScrapeError(422, "HOST_UNREACHABLE", "The job website could not be resolved.");
  if (addresses.some(({ address }) => !isPublicJobAddress(address))) throw new JobScrapeError(400, "PRIVATE_ADDRESS", "Private network addresses are not allowed.");
  return { url, addresses };
}

// Pin the validated DNS result to the connection: a second resolution must
// never be able to redirect this server request to an internal address.
async function readPublicPage(destination: Awaited<ReturnType<typeof assertPublicUrl>>, headers: Record<string, string> = {}, signal?: AbortSignal) {
  const { url, addresses } = destination;
  const forwarded = Object.fromEntries(Object.entries(headers).filter(([key]) => !["host", "connection", "content-length", "accept-encoding", "proxy-authorization"].includes(key.toLowerCase())));
  return new Promise<{ status: number; location?: string; contentType: string; html: string; headers: Record<string, string> }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      agent: false,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
      headers: { "user-agent": "CVcometJobReader/1.0", accept: "text/html,application/xhtml+xml;q=0.9", ...forwarded, "accept-encoding": "identity" },
    }, response => {
      const status = response.statusCode || 0;
      const responseHeaders = Object.fromEntries(Object.entries(response.headers)
        .filter(([key, value]) => value !== undefined && !["content-length", "content-encoding", "transfer-encoding", "connection", "set-cookie"].includes(key))
        .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]));
      if ([301, 302, 303, 307, 308].includes(status)) { response.destroy(); resolve({ status, location: response.headers.location, contentType: "", html: "", headers: responseHeaders }); return; }
      if (Number(response.headers["content-length"] || 0) > MAX_BYTES) { response.destroy(); reject(new JobScrapeError(413, "PAGE_TOO_LARGE", "The job page is too large.")); return; }
      const encoding = String(response.headers["content-encoding"] || "").toLowerCase();
      const decoder = encoding === "gzip" ? createGunzip() : encoding === "br" ? createBrotliDecompress() : encoding === "deflate" ? createInflate() : null;
      if (decoder) {
        let compressedSize = 0;
        response.on("data", (chunk: Buffer) => {
          compressedSize += chunk.length;
          if (compressedSize > MAX_BYTES) { response.destroy(); decoder.destroy(); reject(new JobScrapeError(413, "PAGE_TOO_LARGE", "The job page is too large.")); }
        });
      }
      const content = decoder ? response.pipe(decoder) : response;
      const chunks: Buffer[] = []; let size = 0;
      content.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { response.destroy(); decoder?.destroy(); reject(new JobScrapeError(413, "PAGE_TOO_LARGE", "The job page is too large.")); }
        else chunks.push(chunk);
      });
      content.on("end", () => resolve({ status, contentType: String(response.headers["content-type"] || ""), html: Buffer.concat(chunks).toString("utf8"), headers: responseHeaders }));
      content.on("error", reject);
      response.on("error", reject);
    });
    request.on("error", () => reject(new JobScrapeError(422, "FETCH_FAILED", "The job website is unavailable or the request timed out. Paste the text or import a PDF.")));
    request.end();
  });
}

function decodeEntities(s: string) {
  return s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function textFromHtml(html: string) {
  return decodeEntities(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi," ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ")
    .replace(/<(nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<\/(p|div|li|section|article|h[1-6]|tr|br)>/gi,"\n")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<[^>]+>/g," "))
    .replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").trim();
}
function collectJobPosting(node: unknown, out: Record<string, unknown>[]) {
  if (!node) return;
  if (Array.isArray(node)) { node.forEach(x=>collectJobPosting(x,out)); return; }
  if (typeof node !== "object") return;
  const o=node as Record<string,unknown>; const t=o["@type"];
  if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) out.push(o);
  if (o["@graph"]) collectJobPosting(o["@graph"],out);
}
function jsonLdJob(html: string) {
  const jobs: Record<string,unknown>[]=[];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectJobPosting(JSON.parse(m[1].trim()),jobs); } catch { /* malformed publisher data */ }
  }
  return jobs[0] || null;
}
function orgName(v: unknown) { if (typeof v === "string") return v; if(v&&typeof v==="object") return String((v as Record<string,unknown>).name||""); return ""; }
function locationName(v: unknown): string {
  if (!v) return ""; if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(locationName).filter(Boolean).join(", ");
  if (typeof v === "object") { const o=v as Record<string,unknown>; const a=o.address as Record<string,unknown>|undefined; return [a?.addressLocality,a?.addressRegion,a?.addressCountry].filter(Boolean).join(", ") || String(o.name||""); }
  return "";
}
function meta(html:string, key:string) {
  const esc=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const a=new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["'][^>]*>`,`i`).exec(html);
  const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["'][^>]*>`,`i`).exec(html);
  return decodeEntities((a?.[1]||b?.[1]||"").trim());
}

export type ScrapedJob = { url:string; title:string; company:string; location:string; description:string; source:"json-ld"|"html"|"rendered-html" };

function elementHtmlByClass(html: string, className: string) {
  const openingTags = /<([a-z][a-z\d:-]*)\b[^>]*\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;
  for (const opening of html.matchAll(openingTags)) {
    if (!(opening[2] || opening[3] || "").split(/\s+/).includes(className)) continue;
    const tags = new RegExp(`<(/?)${opening[1]}\\b[^>]*>`, "gi");
    const start = opening.index! + opening[0].length;
    tags.lastIndex = start;
    let depth = 1;
    for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
      depth += tag[1] ? -1 : /\/\s*>$/.test(tag[0]) ? 0 : 1;
      if (!depth) return html.slice(start, tag.index);
    }
  }
  return "";
}

function parseJobPage(html: string, url: string, rendered = false): ScrapedJob {
  const structured=jsonLdJob(html);
  const linkedIn = isLinkedInJobHost(new URL(url).hostname);
  let title="",company="",location="",description="",source:ScrapedJob["source"]=rendered ? "rendered-html" : "html";
  if(structured){source="json-ld";title=String(structured.title||"");company=orgName(structured.hiringOrganization);location=locationName(structured.jobLocation)||String(structured.jobLocationType||"");description=textFromHtml(String(structured.description||structured.responsibilities||""));}
  if(!title) title=textFromHtml(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]||"") || meta(html,"og:title") || textFromHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]||"");
  if (linkedIn) {
    if (!description) description = textFromHtml(elementHtmlByClass(html, "show-more-less-html__markup"));
    if (!company) company = textFromHtml(elementHtmlByClass(html, "topcard__org-name-link"));
    if (!location) location = textFromHtml(elementHtmlByClass(html, "topcard__flavor--bullet"));
    // LinkedIn's surrounding page contains unrelated recommendations and sign-in
    // controls. Never pass that entire page off as the selected job description.
  }
  if(!description && !linkedIn){const main=/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i.exec(html)?.[1];description=textFromHtml(main||html);}
  return {url,title:title.slice(0,180),company:company.slice(0,180),location:location.slice(0,180),description:description.trim(),source};
}

function readableDescription(description: string) {
  const lower = description.toLowerCase();
  return description.length >= 180 && !((lower.includes("sign in") || lower.includes("log in")) && description.length < 1200);
}

export async function scrapeJobUrl(rawUrl: string): Promise<ScrapedJob> {
  const signal = AbortSignal.timeout(50_000);
  let current=await assertPublicUrl(normalizeJobUrl(rawUrl), signal); let response:Awaited<ReturnType<typeof readPublicPage>>|null=null;
  for(let i=0;i<=MAX_REDIRECTS;i++){
    response=await readPublicPage(current, {}, signal);
    if(!response) throw new JobScrapeError(422,"FETCH_FAILED","CVcomet could not reach this job page.");
    if([301,302,303,307,308].includes(response.status)){
      const loc=response.location; if(!loc) throw new JobScrapeError(422,"BAD_REDIRECT","The job website returned an invalid redirect.");
      current=await assertPublicUrl(normalizeJobUrl(new URL(loc,current.url).toString()), signal); continue;
    }
    break;
  }
  if(!response || [301,302,303,307,308].includes(response.status)) throw new JobScrapeError(422,"TOO_MANY_REDIRECTS","The job URL redirected too many times.");
  if(response.status<200||response.status>=300) throw new JobScrapeError(422,"BLOCKED_OR_UNAVAILABLE",`The job website returned HTTP ${response.status}. Paste the job text or import a PDF.`);
  const ct=response.contentType.toLowerCase();
  if(!ct.includes("text/html")&&!ct.includes("application/xhtml")) throw new JobScrapeError(422,"UNSUPPORTED_CONTENT","The URL does not point to a readable job web page.");
  let job = parseJobPage(response.html, current.url.toString());
  if (!readableDescription(job.description) && /<script\b[^>]*\bsrc\s*=/i.test(response.html)) {
    const { renderJobPage } = await import("@/lib/career/job-renderer");
    const rendered = await renderJobPage(current.url.toString(), async (url, headers, renderSignal) => {
      const resource = await readPublicPage(await assertPublicUrl(url, renderSignal), headers, renderSignal);
      return { status: resource.status, headers: resource.headers, body: resource.html };
    }, signal);
    current = await assertPublicUrl(rendered.url, signal);
    job = parseJobPage(rendered.html, current.url.toString(), true);
  }
  if(job.description.length>50000) throw new JobScrapeError(413,"JOB_TOO_LONG","The extracted text exceeds 50,000 characters. Paste only the job description.");
  if(!readableDescription(job.description)) throw new JobScrapeError(422,"CONTENT_NOT_ACCESSIBLE","This job posting is not publicly readable. It may require sign-in or block automated access. Paste the job text or import a PDF.");
  return job;
}

import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2_500_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 12_000;

export class JobScrapeError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

function isPrivateIPv4(ip: string) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some(Number.isNaN)) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 192 && p[1] === 168) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}
function isPrivateIPv6(ip: string) {
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}
async function assertPublicUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new JobScrapeError(400, "INVALID_URL", "Enter a valid public job URL."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new JobScrapeError(400, "INVALID_PROTOCOL", "Only http and https job URLs are supported.");
  if (url.username || url.password) throw new JobScrapeError(400, "URL_CREDENTIALS", "URLs containing credentials are not allowed.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new JobScrapeError(400, "PRIVATE_HOST", "Private or local URLs are not allowed.");
  const direct = isIP(host);
  const addresses = direct ? [{ address: host, family: direct }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) throw new JobScrapeError(422, "HOST_UNREACHABLE", "The job website could not be resolved.");
  if (addresses.some(({address, family}) => family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address))) throw new JobScrapeError(400, "PRIVATE_ADDRESS", "Private network addresses are not allowed.");
  return url;
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

export type ScrapedJob = { url:string; title:string; company:string; location:string; description:string; source:"json-ld"|"html" };

export async function scrapeJobUrl(rawUrl: string): Promise<ScrapedJob> {
  let current=await assertPublicUrl(rawUrl.trim()); let response:Response|null=null;
  for(let i=0;i<=MAX_REDIRECTS;i++){
    response=await fetch(current,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(TIMEOUT_MS),headers:{"user-agent":"Mozilla/5.0 (compatible; CVcometJobReader/1.0; +https://cvcomet.app)",accept:"text/html,application/xhtml+xml;q=0.9"}}).catch(()=>null);
    if(!response) throw new JobScrapeError(422,"FETCH_FAILED","CVcomet could not reach this job page.");
    if([301,302,303,307,308].includes(response.status)){
      const loc=response.headers.get("location"); if(!loc) throw new JobScrapeError(422,"BAD_REDIRECT","The job website returned an invalid redirect.");
      current=await assertPublicUrl(new URL(loc,current).toString()); continue;
    }
    break;
  }
  if(!response || [301,302,303,307,308].includes(response.status)) throw new JobScrapeError(422,"TOO_MANY_REDIRECTS","The job URL redirected too many times.");
  if(!response.ok) throw new JobScrapeError(422,"BLOCKED_OR_UNAVAILABLE",`The job website returned HTTP ${response.status}. Try the employer's public careers page.`);
  const ct=(response.headers.get("content-type")||"").toLowerCase();
  if(!ct.includes("text/html")&&!ct.includes("application/xhtml")) throw new JobScrapeError(422,"UNSUPPORTED_CONTENT","The URL does not point to a readable job web page.");
  const declared=Number(response.headers.get("content-length")||0); if(declared>MAX_BYTES) throw new JobScrapeError(413,"PAGE_TOO_LARGE","The job page is too large to analyze safely.");
  const reader=response.body?.getReader(); if(!reader) throw new JobScrapeError(422,"EMPTY_RESPONSE","The job page returned no readable content.");
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>MAX_BYTES){reader.cancel();throw new JobScrapeError(413,"PAGE_TOO_LARGE","The job page is too large to analyze safely.");}chunks.push(value)}}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length} const html=new TextDecoder().decode(bytes);
  const structured=jsonLdJob(html);
  let title="",company="",location="",description="",source:ScrapedJob["source"]="html";
  if(structured){source="json-ld";title=String(structured.title||"");company=orgName(structured.hiringOrganization);location=locationName(structured.jobLocation)||String(structured.jobLocationType||"");description=textFromHtml(String(structured.description||structured.responsibilities||""));}
  if(!title) title=meta(html,"og:title") || textFromHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]||"");
  if(!description){const main=/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i.exec(html)?.[1];description=textFromHtml(main||html);}
  description=description.slice(0,50000).trim();
  const lower=description.toLowerCase();
  if(description.length<180 || ((lower.includes("sign in")||lower.includes("log in"))&&description.length<1200)) throw new JobScrapeError(422,"CONTENT_NOT_ACCESSIBLE","We couldn't read this job posting. It may require sign-in, JavaScript, or block automated access. Try the employer's public careers page.");
  return {url:current.toString(),title:title.slice(0,180),company:company.slice(0,180),location:location.slice(0,180),description,source};
}

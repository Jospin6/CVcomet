// Live analysis of a public posting with the configured provider. This can be
// billable. No analysis, profile, application or quota record is written.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
require('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { PrismaClient } = require('@prisma/client');
const ai = require('ai');
const client = new PrismaClient({ log: [] });
const sourceLoader = require('./source-loader.cjs');
const textFile = process.argv[2] === '--text' ? process.argv[3] : undefined;
const publicUrl = textFile ? undefined : process.argv[2];
assert.ok(textFile || publicUrl && /^https?:\/\//.test(publicUrl), 'Pass a public job URL or --text <file>');
let generation;
let lastObject, checkedSource;
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  if (new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname === 'api.openai.com' && response.ok) {
    const body = await response.clone().json();
    generation = { finishReason: body.choices?.[0]?.finish_reason, inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
  }
  return response;
};
const load = sourceLoader({
  'server-only': {},
  [path.resolve(__dirname, '../prisma/prisma.ts')]: client,
  ai: { ...ai, generateObject: async options => {
    try { const result = await ai.generateObject(options); lastObject = result.object; return result; }
    catch (error) {
      const causes = [], validation = [];
      let current = error;
      for (let i = 0; i < 6 && current && typeof current === 'object'; i++, current = current.cause) {
        if (current.name) causes.push(current.name);
        if (Array.isArray(current.issues)) validation.push(...current.issues.map(issue => ({
          code: issue.code,
          path: issue.path.filter(part => typeof part === 'number' || /^[a-zA-Z]{1,40}$/.test(part)),
          ...(typeof issue.expected === 'string' ? { expected: issue.expected } : {}),
          ...(typeof issue.received === 'string' && ['null', 'undefined', 'string', 'array', 'number', 'object'].includes(issue.received) ? { received: issue.received } : {}),
        })));
      }
      let jsonValid = false;
      try { JSON.parse(error.text); jsonValid = true; } catch {}
      // Never print generated text, prompts, HTTP bodies, headers or API keys.
      console.error(JSON.stringify({ causes, jsonValid, responseCharacters: typeof error.text === 'string' ? error.text.length : 0, validation: validation.slice(0, 15), generation }));
      throw error;
    }
  } },
});
(async () => {
  const { getActiveAIProvider, getAIProviderConfig } = load('src/lib/ai/config.ts');
  const config = await getAIProviderConfig(await getActiveAIProvider());
  console.log(JSON.stringify({ provider: config.provider, model: config.model }));
  const job = publicUrl ? await load('src/lib/career/job-scraper.ts').scrapeJobUrl(publicUrl) : null;
  const source = textFile ? fs.readFileSync(textFile, 'utf8') : [job.title, job.company, job.location, job.description].filter(Boolean).join('\n\n');
  const text = load('src/lib/career/job-input.ts').normalizeJobText(source);
  checkedSource = text;
  const result = await load('src/lib/career/job-match.ts').analyzeJobDescription(text, undefined, 'en');
  console.log(JSON.stringify({ success: true, title: result.title, company: result.company, requirements: result.requirements.length, generation, saved: false }));
})().catch(error => {
  if (error.code === 'AI_UNSUPPORTED_EVIDENCE' && lastObject?.requirements) {
    const { canonicalTerm } = load('src/lib/career/job-match.ts');
    const contains = (text, term) => (' ' + canonicalTerm(text) + ' ').includes(' ' + canonicalTerm(term) + ' ');
    const quote = text => text.replace(/\s+/g, ' ').trim().toLowerCase();
    console.error(JSON.stringify({ evidenceChecks: lastObject.requirements.map((item, index) => ({
      index, quoteInSource: quote(checkedSource).includes(quote(item.evidence)), normalizedQuoteInSource: contains(checkedSource, item.evidence),
      titleInQuote: contains(item.evidence, item.title), terms: item.terms.map(term => ({ inTitle: contains(item.title, term), inQuote: contains(item.evidence, term) })),
    })).filter(item => !item.quoteInSource || !item.titleInQuote || item.terms.some(term => !term.inTitle || !term.inQuote)) }));
  }
  console.error(JSON.stringify({ success: false, code: error.code || 'ANALYSIS_CHECK_FAILED', errorName: error.name, generation }));
  process.exitCode = 1;
}).finally(async () => { global.fetch = originalFetch; await client.$disconnect(); });

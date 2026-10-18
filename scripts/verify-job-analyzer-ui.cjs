// Actual React page and project styles; intercepted local API fixtures only.
// Backend behavior, real PDF parsing and access checks are tested separately.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const http = require('node:http'), { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.resolve('docs/job-analyzer');
fs.mkdirSync(output, { recursive: true });
let server, browser, socket, profile, evaluate, command;
const checks = [], errors = [];

async function main() {
  const id = '11111111-1111-4111-8111-111111111111', cvId = '22222222-2222-4222-8222-222222222222', adaptedId = '55555555-5555-4555-8555-555555555555';
  const text = 'Frontend Developer\nReact is required.\nTypeScript is required.\nDocker is preferred.\nBuild accessible interfaces and dashboards together with the product team.';
  const load = require('./source-loader.cjs')({ '@/lib/career-profile/ai': { factualRules: '' }, '@/lib/ai/model': { getAIModel: async () => null } });
  const { jobAnalysisSchema } = load('src/lib/career/job-schema.ts'), { emptyProfile } = load('src/lib/career-profile/schema.ts'), { matchJob } = load('src/lib/career/job-match.ts');
  const analysis = jobAnalysisSchema.parse({ title: 'Frontend Developer', company: 'Example', summary: 'Build accessible React interfaces.', responsibilities: ['Build accessible interfaces and dashboards.'], requirements: ['React', 'TypeScript', 'Docker'].map((title, index) => ({ id: String(index), title, category: 'TECHNICAL', priority: index === 2 ? 'PREFERRED' : 'REQUIRED', description: title, terms: [title], evidence: title + (index === 2 ? ' is preferred.' : ' is required.'), ambiguity: '' })) });
  const result = { id, cvId, tailoredCvId: null, result: matchJob({ ...emptyProfile(), summary: 'Built React interfaces.', skills: 'React, TypeScript' }, analysis), job: { id, title: analysis.title, company: 'Example', description: text, originalText: text, sourceType: 'TEXT', analysis, documentDrafts: {}, applications: [], coverLetters: [] } };
  const letter = { sendertitle: 'Developer', recipientName: '', recipientTitle: '', companyName: 'Example', date: '2026-10-17', positionTitle: 'Frontend Developer', introduction: 'I build React interfaces.', body: 'My skills include React and TypeScript.', conclusion: 'Thank you for your time.', senderName: 'Example Candidate' };
  const fixture = JSON.stringify({ text, result, id, cvId, adaptedId, letter });
  const bundle = await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import JobMatch from './src/app/dashboard/job-match/page';
    window.fixture=${fixture};window.calls=[];window.language='fr';window.failURL=false;window.failAnalysis=false;
    window.fetch=async(url,options={})=>{
      const f=window.fixture;const body=options.body instanceof FormData?null:options.body?JSON.parse(options.body):null;
      window.calls.push({url,body});
      if(url==='/api/cvs?mine=1')return Response.json([{id:f.cvId,title:'Source resume'}]);
      if(url==='/api/job-match'&&!body)return Response.json(window.analyzed?[{id:f.id,overallScore:f.result.result.overallScore,job:f.result.job}]:[]);
      if(url.startsWith('/api/job-match?id='))return Response.json(f.result);
      if(url==='/api/job-match/extract'){
        if(window.failURL&&body)return Response.json({error:'FETCH_FAILED',message:'Public page unavailable. Paste text or import a PDF.'},{status:422});
        return Response.json({text:f.text,source:body?{type:'URL',url:body.url,originalText:f.text}:{type:'PDF',name:'job.pdf',originalText:f.text}});
      }
      if(url==='/api/job-match'&&body){if(!body.confirmed)throw Error('Unreviewed analysis');if(window.failAnalysis)return Response.json({error:'FEATURE_NOT_AVAILABLE'},{status:403});window.analyzed=true;f.result.job.description=body.text;f.result.job.originalText=body.source.originalText;f.result.job.sourceType=body.source.type;return Response.json(f.result,{status:201})}
      if(url==='/api/tailor-resume'){
        if(body.action==='ACCEPT'){f.result.tailoredCvId=f.adaptedId;return Response.json({cvId:f.adaptedId})}
        if(body.action==='REJECT')return Response.json({discarded:true});
        return Response.json({id:f.id,cvId:f.cvId,mode:body.mode,sourceSignature:'fixture',rejectedCount:0,changes:[{path:'experiences.0.description',current:'Built React interfaces. Improved accessibility.',proposed:'Improved accessibility. Built React interfaces.',reason:'Order existing accomplishments by relevance.',evidence:'React is required.'}]});
      }
      if(url==='/api/generate-cover-letter')return Response.json(body.action==='SAVE'?{draft:body.draft,conversationId:f.id,saved:true}:{draft:f.letter});
      if(url==='/api/application-email')return Response.json(body.action==='SAVE'?{...body.draft,saved:true}:{subject:'Frontend Developer application',body:'Hello, I build React interfaces.'});
      if(url==='/api/applications')return Response.json({id:f.id});
      throw Error('Unexpected API request: '+url);
    };
    let root=createRoot(document.getElementById('root'));root.render(<JobMatch/>);
    window.reloadPage=()=>{root.unmount();root=createRoot(document.getElementById('root'));root.render(<JobMatch/>)};
  ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': path.resolve('src') }, define: { 'process.env.NODE_ENV': JSON.stringify('development') }, plugins: [{ name: 'local-ui', setup(build) {
    build.onResolve({ filter: /^(next\/link|react-i18next)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link({children,...props}){return <a {...props}>{children}</a>}' : "export const useTranslation=()=>({i18n:{resolvedLanguage:window.language||'fr'}});" }));
  } }] });
  const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') });
  server = http.createServer((req, res) => { res.setHeader('Content-Type', req.url === '/app.js' ? 'application/javascript' : req.url === '/app.css' ? 'text/css' : 'text/html'); res.end(req.url === '/app.js' ? bundle.outputFiles[0].text : req.url === '/app.css' ? css.css : '<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body class="bg-background text-foreground"><main class="mx-auto max-w-6xl p-4 sm:p-8"><div id="root"></div></main><script src="/app.js"></script></body></html>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = 'http://127.0.0.1:' + server.address().port;
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cvcomet-job-ui-'));
  const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  assert.ok(executable, 'Chrome or Edge required');
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => console.error(error.message));
  const portFile = path.join(profile, 'DevToolsActivePort'); for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
  assert.ok(fs.existsSync(portFile), 'Browser debugging started'); const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  socket = new WebSocket('ws://127.0.0.1:' + port + endpoint); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  socket.onmessage = event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text); if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  command = (method, params) => send(method, params, sessionId);
  evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(100); } throw Error('UI timeout: ' + expression); };
  const button = async label => { await evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e||e.disabled)throw Error('Missing or disabled: '+${JSON.stringify(label)});e.click()})()`); await delay(100); };
  const fill = async (selector, value) => { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`); await delay(100); };
  const confirm = async () => { await evaluate("document.querySelector('label input[type=checkbox]').click()"); await delay(100); };
  const screenshot = async name => { const { data } = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(data, 'base64')); };
  await command('Page.enable'); await command('Runtime.enable'); await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: base }); await until("!!document.querySelector('#job-text')");
  await fill('#job-text', text); assert.equal(await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='Analyser l’offre').disabled"), true);
  await confirm(); await button('Analyser l’offre'); await until("document.querySelectorAll('article').length===3");
  assert.equal(await evaluate("document.querySelector('[role=meter]').getAttribute('aria-valuenow')"), '86');
  await evaluate("document.querySelector('select#job-cv').value='" + cvId + "';document.querySelector('select#job-cv').dispatchEvent(new Event('change',{bubbles:true}))"); await delay(100);
  await button('Adapter mon CV'); await until("document.body.textContent.includes('Modifications proposées')");
  assert.equal(await evaluate("window.calls.filter(c=>c.body?.action==='ACCEPT').length"), 0);
  await button('Refuser les modifications'); await button('Améliorer mon CV avec l’IA'); await until("document.body.textContent.includes('Modifications proposées')");
  await button('Créer la version avec les modifications sélectionnées'); await until("!!document.querySelector('a[href=\"/dashboard/resumes/" + adaptedId + "\"]')");
  await button('Générer une lettre de motivation'); await until("!!document.querySelector('#job-letter-body')"); await fill('#job-letter-body', 'Edited letter.'); await button('Enregistrer la lettre');
  assert.equal(await evaluate("window.calls.find(c=>c.url==='/api/generate-cover-letter'&&c.body.action==='SAVE').body.draft.body"), 'Edited letter.');
  await button('Préparer un email'); await until("!!document.querySelector('#job-email-body')"); await fill('#job-email-body', 'Edited email.'); await button('Enregistrer l’email');
  assert.equal(await evaluate("window.calls.find(c=>c.url==='/api/application-email'&&c.body.action==='SAVE').body.draft.body"), 'Edited email.');
  await button('Enregistrer la candidature'); await until("!!document.querySelector('a[href^=\"/dashboard/applications?application=\"]')");
  await evaluate('window.scrollTo(0,0)'); await screenshot('desktop');
  checks.push('Reviewed text, evidenced score, requirements, reject/accept resume proposals, editable saved letter/email and application link.');
  await button('Importer une URL'); await fill('#job-url', 'https://example.com/job'); await button('Récupérer le texte');
  assert.equal(await evaluate("document.querySelector('label input[type=checkbox]').checked"), false); assert.equal(await evaluate("document.querySelector('#job-text').value"), text);
  await evaluate('window.failURL=true'); await button('Récupérer le texte'); assert.ok(await evaluate("document.querySelector('[role=alert]').textContent.includes('Paste text')"));
  await button('Importer un PDF'); await evaluate("(()=>{const dt=new DataTransfer();dt.items.add(new File(['%PDF-fixture'],'job.pdf',{type:'application/pdf'}));const e=document.querySelector('#job-pdf');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}))})()"); await delay(150);
  assert.equal(await evaluate("document.querySelector('#job-text').value"), text); await confirm(); await button('Analyser l’offre'); await until("document.querySelectorAll('article').length===3");
  checks.push('URL and PDF preview, mandatory review, URL failure and working alternative import.');
  const layouts = [];
  for (const language of ['fr', 'en']) for (const dark of [false, true]) for (const width of [375, 768, 1440]) {
    await evaluate(`window.language=${JSON.stringify(language)};document.documentElement.classList.toggle('dark',${dark});window.reloadPage()`); await delay(200);
    await command('Emulation.setDeviceMetricsOverride', { width, height: width === 375 ? 850 : 1100, deviceScaleFactor: 1, mobile: false }); await delay(150);
    const bounds = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})'); assert.ok(bounds.scroll <= bounds.width + 1, JSON.stringify({ language, dark, width, bounds }));
    const unnamed = await evaluate("[...document.querySelectorAll('input,textarea,select')].filter(e=>!e.getAttribute('aria-label')&&![...(e.labels||[])].some(l=>l.textContent.trim())).map(e=>e.id)"); assert.deepEqual(unnamed, []);
    layouts.push({ language, dark, width }); if (width === 375) await screenshot('mobile-' + language + (dark ? '-dark' : '-light'));
  }
  checks.push('12 responsive layouts: FR/EN, light/dark, 375/768/1440 pixels; all inputs labelled.');
  await evaluate("window.fixture.result.result.overallScore=null;window.fixture.result.result.unverifiedCount=3;window.reloadPage()"); await delay(250);
  assert.ok(await evaluate("document.body.textContent.includes('Score unavailable')")); assert.equal(await evaluate("document.querySelector('[role=meter]')"), null);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ scope: 'Actual React page and compiled project styles; API fixtures, no database or billable AI calls.', checks, layouts, runtimeErrors: errors }, null, 2) + '\n');
  console.log(JSON.stringify({ checks, layouts: layouts.length, runtimeErrors: errors }, null, 2)); await send('Browser.close');
}
main().catch(async error => { console.error(error.stack || error.message); if (evaluate) { try { console.error(await evaluate('document.body.innerText.slice(-1500)')); } catch {} } process.exitCode = 1; }).finally(async () => {
  socket?.close(); browser?.kill(); if (server) await new Promise(resolve => server.close(resolve));
  if (profile) { const actual = path.resolve(profile), temporary = path.resolve(os.tmpdir()) + path.sep; if (actual.startsWith(temporary) && path.basename(actual).startsWith('cvcomet-job-ui-')) { try { fs.rmSync(actual, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {} } }
});

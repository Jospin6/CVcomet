/* UI acceptance: real Next.js UI, synthetic session and intercepted API fixtures. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { jsPDF } = require('jspdf');
const base = process.argv[2] || 'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output = path.resolve('docs/resume-library'); fs.mkdirSync(output,{recursive:true});
const checks=[], errors=[], apiCalls=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser, ws, command, evaluate;
const user={id:'11111111-1111-4111-8111-111111111111',name:'Camille Martin',email:'camille@example.test',role:'USER',isSubscribed:false};
const profile={name:user.name,email:user.email,phone:'',address:'Paris',headline:'Frontend Developer',summary:'Frontend developer building accessible products with React and TypeScript.',skills:'React, TypeScript',languages:'French, English',targetMarket:'EUROPE',experiences:[],education:[],projects:[],onboardingCompletedAt:'2026-10-12T10:00:00.000Z'};
const pdf = new jsPDF(); pdf.setFontSize(22); pdf.text(user.name,22,25); pdf.setFontSize(12); pdf.text('Frontend Developer',22,36); pdf.line(22,42,185,42); pdf.text('Professional summary',22,53); pdf.setFontSize(10); pdf.text('Building accessible products with React and TypeScript.',22,65); pdf.text('Experience',22,85); pdf.text('Frontend Developer - Example Company',22,97); pdf.text('2023 - Present | Paris',22,108); pdf.text('Created accessible user interfaces and shared components.',22,120);
const pdfBody=Buffer.from(pdf.output('arraybuffer'));
let uploads=[{id:'pdf-fixture',name:'Camille - Resume.pdf',mimeType:'application/pdf',size:pdfBody.length,previewText:null,createdAt:'2026-10-12T11:00:00.000Z'}];
const resumes=[{id:'created-fixture',title:'Frontend Developer',summary:[profile.summary],experiences:[{title:'Frontend Developer',company:'Example Company',description:['Created accessible products.']}],educations:[{degree:'Computer science',school:'Example University'}],createdAt:'2026-10-12T09:00:00.000Z'}];
let failUpload=false,failLoad=false; const writes=[];
async function respond(requestId,status,body){await command('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json; charset=utf-8'}],body:Buffer.from(JSON.stringify(body)).toString('base64')})}
async function intercept({requestId,request}){
 const url=new URL(request.url); apiCalls.push({path:url.pathname,method:request.method});
 if(url.pathname==='/api/me')return respond(requestId,200,user);
 if(url.pathname.startsWith('/api/users/'))return respond(requestId,200,{...user,...profile,Experience:profile.experiences,Education:profile.education,Project:profile.projects});
 if(url.pathname==='/api/conversations')return respond(requestId,200,[]);
 if(url.pathname.startsWith('/api/conversations/'))return respond(requestId,200,{id:'legacy',title:'Saved documents',content:'Stored context',userId:user.id,Cv:[],CoverLetter:[]});
 if(url.pathname==='/api/resume-documents'){
  if(request.method==='GET')return respond(requestId,failLoad?500:200,failLoad?{error:'UNAVAILABLE'}:uploads);
  if(failUpload)return respond(requestId,500,{error:'UNAVAILABLE'});
  const names=[...(request.postData||'').matchAll(/filename="([^"]+)"/g)].map(match=>match[1]); assert.ok(names.length,'multipart filenames');
  const added=names.map((name,index)=>({id:'upload-'+writes.length+'-'+index,name,mimeType:'text/plain',size:70,previewText:'Camille Martin\nDeveloper\nReact, TypeScript',createdAt:'2026-10-12T12:00:00.000Z'}));
  uploads=[...added,...uploads]; writes.push({action:'upload',names}); return respond(requestId,201,added);
 }
 if(url.pathname.startsWith('/api/resume-documents/')){
  const id=url.pathname.split('/').pop();
  if(request.method==='DELETE'){uploads=uploads.filter(row=>row.id!==id);writes.push({action:'delete',id});return respond(requestId,204,null)}
  return command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/pdf'}],body:pdfBody.toString('base64')});
 }
 if(url.pathname==='/api/cvs'){
  if(request.method==='GET')return respond(requestId,200,resumes);
  const body=JSON.parse(request.postData);assert.ok(['PROFILE','SCRATCH'].includes(body.source));const resume={...resumes[0],id:'new-fixture'};writes.push({action:'create',source:body.source});return respond(requestId,201,resume);
 }
 if(url.pathname.startsWith('/api/cvs/'))return respond(requestId,200,resumes[0]);
 if(url.pathname==='/api/coverLetter')return respond(requestId,200,[]);
 if(url.pathname==='/api/application-email'){const body=JSON.parse(request.postData);assert.equal(body.url,'https://example.test/careers/developer');assert.equal('jobDescription' in body,false);return respond(requestId,200,{subject:'Application - Developer',body:'Dear hiring team,\nI would like to apply for this role.'})}
 return respond(requestId,200,[]);
}
async function select(id, value) {
  await evaluate("(()=>{const e=document.getElementById(" + JSON.stringify(id) + ");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e," + JSON.stringify(value) + ");e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await delay(150);
}
async function button(text) {
  await evaluate("(()=>{const e=[...document.querySelectorAll('main button')].find(e=>e.textContent.trim()===" + JSON.stringify(text) + ");if(!e)throw Error('Missing button');if(e.disabled)throw Error('Disabled button: '+" + JSON.stringify(text) + ");e.click();})()");
  await delay(200);
}
async function until(expression, label) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      if (await evaluate("Boolean(" + expression + ")")) return;
    } catch {}
    await delay(100);
  }
  throw Error("Timeout: " + label);
}
async function click(selector) {
  const point = await evaluate(
    "(()=>{const e=document.querySelector(" +
      JSON.stringify(selector) +
      ');if(!e)throw Error("Missing: "+' +
      JSON.stringify(selector) +
      ');e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
  );
  await command("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await command("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await delay(220);
}
async function fill(selector, value) {
  await evaluate(
    "(()=>{const e=document.querySelector(" +
      JSON.stringify(selector) +
      ');const proto=e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,' +
      JSON.stringify(value) +
      ');e.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
  await delay(150);
}
async function key(key, code, windowsVirtualKeyCode, modifiers = 0) {
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode,
    modifiers,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode,
    modifiers,
  });
  await delay(350);
}
async function navigate(route) {
  await command("Page.navigate", { url: base + route });
  await until(
    'document.readyState==="complete" && !!document.querySelector("main h1")',
    "render " + route,
  );
  await delay(400);
}
async function size(width) {
  await command("Emulation.setDeviceMetricsOverride", {
    width,
    height: width === 375 ? 850 : 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await delay(200);
}
async function screenshot(name) {
  await evaluate("window.scrollTo(0,0);document.activeElement?.blur()");
  await delay(150);
  const { data } = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(
    path.join(output, name + ".png"),
    Buffer.from(data, "base64"),
  );
}
(async () => {
  require("@next/env").loadEnvConfig(process.cwd(), true, {
    info() {},
    error() {},
  });
  const { SignJWT } = await import("jose");
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: "USER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const executable =
    process.argv[3] ||
    [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].find((p) => fs.existsSync(p));
  assert.ok(executable, "Chrome or Edge must be installed");
  const browserProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), "cvcomet-phase2-"));
  browser = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-extensions",
      "--remote-debugging-port=0",
      "--user-data-dir=" + browserProfileDir,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let endpoint;
  for (let i = 0; i < 150; i++) {
    const file = path.join(browserProfileDir, "DevToolsActivePort");
    if (fs.existsSync(file)) {
      endpoint = fs.readFileSync(file, "utf8").trim().split("\n");
      break;
    }
    await delay(100);
  }
  assert.ok(endpoint, "Chrome debugging endpoint");
  ws = new WebSocket("ws://127.0.0.1:" + endpoint[0] + endpoint[1]);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let counter = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++counter;
      pending.set(id, { resolve, reject });
      ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const item = pending.get(msg.id);
      if (item) {
        pending.delete(msg.id);
        msg.error
          ? item.reject(Error(JSON.stringify(msg.error)))
          : item.resolve(msg.result);
      }
    }
    if (msg.method === "Fetch.requestPaused")
      void intercept(msg.params).catch((e) => errors.push(e.message));
    if (msg.method === "Runtime.exceptionThrown")
      errors.push(
        msg.params.exceptionDetails.exception?.description ||
          msg.params.exceptionDetails.text,
      );
    if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    ) {
      const message = msg.params.args
        .map((a) => a.value || a.description || "")
        .join(" ");
      if (/hydrat|Minified React|uncaught/i.test(message)) errors.push(message);
    }
  };
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  command = (method, params = {}) => send(method, params, sessionId);
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", {
    urls: [
      "*googletagmanager.com*",
      "*google-analytics.com*",
      "*js.stripe.com*",
    ],
  });
  await command("Fetch.enable", {
    patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }],
  });
  evaluate = async (expression) => {
    const r = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result.value;
  };
  await command("Network.setCookie", {
    name: "token_cv",
    value: token,
    url: base,
    httpOnly: true,
    path: "/",
  });
  await command("Network.setCookie", {
    name: "i18next",
    value: "en",
    url: base,
    path: "/",
  });
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: 'if(!localStorage.getItem("i18nextLng"))localStorage.setItem("i18nextLng","en");',
  });

  await size(1440); await navigate('/dashboard/resumes');
  await until('document.querySelector("main").textContent.includes("Camille - Resume.pdf")','library loaded');
  assert.equal(await evaluate('!!document.querySelector("main textarea")'),false);
  const selectFiles=async(names)=>{await evaluate('(()=>{const dt=new DataTransfer();'+JSON.stringify(names)+'.forEach(name=>dt.items.add(new File(["Camille Martin - Developer"],name,{type:"text/plain"})));const input=document.querySelector("#resume-documents-input");input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()')};
  await selectFiles(['CV - English.txt','CV - French.txt']);
  await until('document.querySelector("main").textContent.includes("2 document(s) uploaded.")','multiple upload');
  assert.equal(writes[0].names.length,2);
  await navigate('/dashboard/resumes'); await until('document.querySelector("main").textContent.includes("CV - English.txt")','reload persisted');
  checks.push('Multiple-file picker uploads, previews and persistence after page reload.');
  await until('document.querySelector("main canvas[data-rendered=true]")', 'PDF thumbnail rendered');
  await screenshot('documents-desktop');
  await button('View'); await until('!!document.querySelector("[role=dialog]")','preview');
  assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Camille Martin")'));
  assert.ok(await evaluate('!!document.querySelector("[role=dialog] a[href*=download]")'));
  await key('Escape','Escape',27); await until('!document.querySelector("[role=dialog]")','close preview');
  checks.push('Text preview, original download link and keyboard dismissal.');
  await evaluate('[...document.querySelectorAll("main button")].find(b=>b.getAttribute("aria-label")==="Open Camille - Resume.pdf").click()');
  await until('!!document.querySelector("[role=dialog] canvas[data-rendered=true]")','PDF viewer rendered');
  await key('Escape','Escape',27);await until('!document.querySelector("[role=dialog]")','close PDF viewer');
  checks.push('Original PDF renders in both the thumbnail and the full document viewer.');
  const before=writes.length;
  await selectFiles(['invalid.html']); await until('document.querySelector("main [role=alert]")?.textContent.includes("PDF, DOCX or TXT")','invalid extension'); assert.equal(writes.length,before);
  failUpload=true; await selectFiles(['failed.txt']);await until('document.querySelector("main [role=alert]")?.textContent.includes("Upload failed")','failed upload');assert.equal(writes.length,before);failUpload=false;
  await evaluate('(()=>{const dt=new DataTransfer();dt.items.add(new File(["Developer"],"Dropped CV.txt",{type:"text/plain"}));document.querySelector("main section[aria-label]").dispatchEvent(new DragEvent("drop",{bubbles:true,dataTransfer:dt}));})()');
  await until('[...document.querySelectorAll("main button")].some(b=>b.getAttribute("aria-label")==="Delete Dropped CV.txt")','drag drop saved');
  checks.push('Drag and drop works; invalid extensions and server failures preserve existing documents.');
  await evaluate('[...document.querySelectorAll("main button")].find(b=>b.getAttribute("aria-label")==="Delete Dropped CV.txt").click()');
  await until('!!document.querySelector("[role=alertdialog]")','delete confirmation');
  await evaluate('[...document.querySelectorAll("[role=alertdialog] button")].find(b=>b.textContent.trim()==="Cancel").click()');
  await until('!document.querySelector("[role=alertdialog]")','cancel deletion');
  assert.ok(uploads.some(row=>row.name==='Dropped CV.txt'));
  await evaluate('[...document.querySelectorAll("main button")].find(b=>b.getAttribute("aria-label")==="Delete Dropped CV.txt").click()');
  await until('!!document.querySelector("[role=alertdialog]")','second confirmation');
  await evaluate('[...document.querySelectorAll("[role=alertdialog] button")].find(b=>b.textContent.trim()==="Delete").click()');
  await until('!document.querySelector("main").textContent.includes("Dropped CV.txt")','deleted');
  checks.push('Deletion requires confirmation and updates the document list.');
  await button('Use my career profile');await until('location.pathname==="/dashboard/resumes/new-fixture"','profile draft');
  await until('!!document.querySelector("#resume-title")','resume editor');
  assert.ok(await evaluate('!!document.querySelector(".document-paper")'));
  checks.push('Profile-based draft opens a readable resume preview and title/summary editor.');
  await navigate('/dashboard/cover-letters');
  assert.equal(await evaluate('!!document.querySelector("main textarea")'),false);
  await fill('#email-job-url','https://example.test/careers/developer');await button('Generate email');
  await until('document.querySelector("main").textContent.includes("Application - Developer")','email from url');
  checks.push('Cover-letter page accepts a public job URL for email creation with no description paste field.');
  await navigate('/g/legacy'); assert.equal(await evaluate('!!document.querySelector("main textarea")'),false);
  await navigate('/');await until('document.querySelector("main").textContent.includes("Recent documents")','overview');
  assert.equal(await evaluate('!!document.querySelector("main textarea")'),false);await screenshot('overview-desktop');
  checks.push('Overview and legacy generation page have no job description composer.');
  failLoad=true;await navigate('/dashboard/resumes');await until('!!document.querySelector("main [role=alert]")','load failure');failLoad=false;await button('Try again');await until('document.querySelector("main").textContent.includes("Camille - Resume.pdf")','retry list');
  const layouts=[];
  for(const language of ['en','fr']){
   await command('Network.setCookie',{name:'i18next',value:language,url:base,path:'/'});await evaluate('localStorage.setItem("i18nextLng",'+JSON.stringify(language)+')');
   for(const theme of ['light','dark']){
    await evaluate('localStorage.setItem("theme",'+JSON.stringify(theme)+')');
    for(const route of ['/','/dashboard/resumes']){
     await navigate(route);await until('!document.querySelector("main [data-slot=skeleton]") && document.documentElement.lang=== '+JSON.stringify(language),'hydrated layout');
     for(const width of [375,768,1440]){
      await size(width);
      const metrics=await evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(metrics.scroll<=metrics.viewport+1,JSON.stringify({language,theme,width,route,metrics}));
      assert.equal(await evaluate('document.documentElement.lang'),language);assert.equal(await evaluate('document.documentElement.classList.contains("dark")'),theme==='dark');
      layouts.push({language,theme,width,route});console.log('Layout '+layouts.length+': '+language+' '+theme+' '+width+' '+route);
      if(language==='fr'&&theme==='dark'&&width===375)await screenshot(route==='/'?'overview-mobile-dark':'documents-mobile-dark');
     }
    }
   }
  }
  checks.push('24 layouts: overview and documents, FR/EN, light/dark, 375/768/1440 px, no horizontal page overflow.');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({scope:'Real UI and middleware; synthetic account and intercepted APIs, no live data or AI requests.',checks,layouts,writes,runtimeErrors:errors},null,2)+'\n');
  console.log(JSON.stringify({checks,layouts:layouts.length,writes: writes.length,errors},null,2));
  await send('Browser.close').catch(()=>{});ws.close();
})().catch(async error => {
  console.error(error.stack); console.error(JSON.stringify({lastCalls:apiCalls.slice(-20),errors}));
  if (command) { try { await screenshot("failure"); console.error(await evaluate("document.body.innerText.slice(-1800)")); } catch {} }
  fs.writeFileSync(path.join(output,"failure.json"),JSON.stringify({error:error.message,checks,errors},null,2));
  if (ws) ws.close(); if (browser) browser.kill(); process.exitCode=1;
});

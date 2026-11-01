const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const base = 'src/lib/agentic/agents/application/';
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function load(file,imports={}) {
  const js=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const fn=vm.runInNewContext(`(function(require,module,exports){${js}\n})`,
    {console,AbortController,AbortSignal,Date,Promise,Map,Set,JSON,Number,Array,String,RegExp,Error});
  fn(id=>{if(Object.hasOwn(imports,id))return imports[id];throw Error(`Unmocked import ${id} in ${file}`)},mod,mod.exports);
  return mod.exports;
}
class CareerContractError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
class AgenticError extends Error{constructor(code,status=500){super(code);this.status=status;this.code=code;}}
const career={'@/lib/career-os/contracts':{CareerContractError}};
const validation=load(base+'tools/validation.tool.ts',career);
const prompt=load(base+'prompts/email.prompt.ts');
const input={language:'en',jobTitle:'Backend developer',company:'Acme',signer:'Ada',
  description:'Build and test Node.js APIs',profileFacts:['I developed Node.js APIs for a public website'],technicalTerms:['Node.js']};
const email={subject:'Application — Backend developer',body:'Dear Hiring Team,\n\nI would like to apply for the backend developer position. I developed Node.js APIs for a public website.\n\nKind regards,\nAda'};
module.exports={read,load,base,career,validation,prompt,input,email,CareerContractError,AgenticError};

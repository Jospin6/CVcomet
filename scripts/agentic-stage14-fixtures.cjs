const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const base = 'src/lib/agentic/agents/interview-voice/';
function read(rel){return fs.readFileSync(path.join(root, rel), 'utf8')}
function load(file, imports={}) {
  const output = ts.transpileModule(read(file), {fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${output}\n})`,
    {console,AbortController,AbortSignal,Promise,Map,Set,Date,JSON,Number,Array,String,RegExp,Error})
    (key => { if (Object.hasOwn(imports,key)) return imports[key]; throw Error(`Unmocked ${key} in ${file}`)},module,module.exports);
  return module.exports;
}
class AgenticError extends Error {constructor(code, status=500){super(code);this.code=code;this.status=status}}
const policy = load('src/lib/career/screening-policy.ts');
const validation = load(base+'tools/validation.tool.ts', {
  '../../../core/errors.ts':{AgenticError}, '@/lib/career/screening-policy':policy,
});
const prompt = load(base+'prompts/voice.prompt.ts');
const turns = [
  {role:'assistant',text:'Describe your previous work.'},
  {role:'user',text:'I built backend services with TypeScript and PostgreSQL for customers.'},
  {role:'assistant',text:'How did you improve reliability?'},
  {role:'user',text:'I added monitoring and alerts to reduce service outages.'},
];
const id = 'bbbbbbbb-1111-4111-8111-aaaaaaaaaaaa';
const preparation = {sessionId:id,roomName:`cvcomet-screening-${id}`,language:'en',
  jobTitle:'Backend engineer',company:'Acme',location:'Remote',jobDescription:'Build REST APIs',
  resumeText:JSON.stringify({skills:['TypeScript','PostgreSQL']})};
const evaluation={language:'en',jobTitle:'Backend engineer',company:'Acme',jobDescription:'Build REST APIs',
  resumeText:preparation.resumeText,turns};
const draft={dimensions:{cvConsistency:90,jobRelevance:85,communication:75,motivation:80,experience:70,professionalism:80},
  evidence:[{dimension:'experience',quote:'I built backend services with TypeScript'},
    {dimension:'communication',quote:'I added monitoring and alerts'}],
  strengths:['Specific examples'],improvements:['Quantify the results'],
  recommendedAction:'Practice the STAR method',summary:'The answers showed relevant backend experience.'};


module.exports = {read,load,validation,prompt,preparation,evaluation,draft,AgenticError,base};

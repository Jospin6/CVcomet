const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const base='src/lib/agentic/agents/supervisor/';
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function load(rel, imports={}){
  const js=ts.transpileModule(read(rel),{fileName:rel,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const fn=vm.runInNewContext(`(function(require,module,exports){${js}\n})`,
    {console,AbortController,AbortSignal,Date,Promise,Map,Set,JSON,Number,Array,String,RegExp,Error,Object});
  fn(name=>{if(Object.hasOwn(imports,name))return imports[name];throw Error(`Unmocked import ${name} in ${rel}`)},mod,mod.exports);
  return mod.exports;
}
class CareerContractError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
class AgenticError extends Error{constructor(code,status){super(code);this.code=code;this.status=status||500;}}
const career={CareerContractError,CAREER_READ_TOOLS:['get_my_profile','list_my_resumes','get_my_resume','list_my_applications','get_my_application','get_my_job_match_insights','list_my_application_packets']};
const engine=load('src/lib/career-os/agent-engine.ts',{'./contracts.ts':career});
const contracts=load(base+'tools/contracts.tool.ts');
const routing=load(base+'tools/routing.tool.ts',{'@/lib/career-os/contracts':career,'@/lib/career-os/agent-engine':engine,'./contracts.tool':contracts});
const prompt=load(base+'prompts/supervisor.prompt.ts',{'../tools/routing.tool':routing});
const input={actorId:'owner',message:'What can I improve in my CV?',history:[]};
module.exports={base,load,read,career,engine,contracts,routing,prompt,input,CareerContractError,AgenticError};

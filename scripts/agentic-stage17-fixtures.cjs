const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const base='src/lib/agentic/memory/';
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function load(rel,imports={}){
 const js=ts.transpileModule(read(rel),{fileName:rel,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 const fn=vm.runInNewContext(`(function(require,module,exports){${js}\n})`,
   {console,AbortController,AbortSignal,Date,Promise,Map,Set,JSON,Number,Array,String,RegExp,Error,Object,Symbol});
 fn(name=>{if(Object.hasOwn(imports,name))return imports[name];throw Error(`Unmocked import ${name} in ${rel}`)},mod,mod.exports);
 return mod.exports;
}
class CareerContractError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
const career={CareerContractError};
const policy=load(base+'tools/policy.tool.ts');
const assembly=load(base+'tools/assemble.tool.ts',{'../tools/policy.tool':policy});
function fakeDatabase(){
 let id=0;const rows=[];
 const project=(row,opts)=>{
  if(!row)return null;
  if(!opts?.select)return {...row};
  return Object.fromEntries(Object.entries(opts.select).filter(([,v])=>v).map(([k])=>[k,row[k]]));
 };
 const own=(row,where)=>row.userId===where.userId&&(!where.id||row.id===where.id)&&(!where.key||row.key===where.key)&&
   (where.revision===undefined||row.revision===where.revision)&&(!where.allowedAgents?.has||row.allowedAgents.includes(where.allowedAgents.has));
 const memory={
  async findMany(opts){return rows.filter(row=>own(row,opts.where)).sort((a,b)=>a.key.localeCompare(b.key)).slice(0,opts.take??99).map(row=>project(row,opts));},
  async findFirst(opts){return project(rows.find(row=>own(row,opts.where)),opts);},
  async create(opts){if(rows.some(row=>row.userId===opts.data.userId&&row.key===opts.data.key))throw {code:'P2002'};
   const row={id:'mem-'+(++id),revision:0,createdAt:new Date(),updatedAt:new Date(),...opts.data};rows.push(row);return project(row,opts);},
  async updateMany(opts){const row=rows.find(row=>own(row,opts.where));if(!row)return {count:0};
   Object.assign(row,{value:opts.data.value,allowedAgents:opts.data.allowedAgents,revision:row.revision+1});return {count:1};},
  async deleteMany(opts){const at=rows.findIndex(row=>own(row,opts.where));if(at===-1)return {count:0};rows.splice(at,1);return {count:1};},
 };
 const prisma={careerAgentMemory:memory,careerMission:{async findFirst(opts){
   if(opts.where.userId!=='alice'||opts.where.id!=='mission-1')return null;
   return {id:'mission-1',title:'Refaire mon CV',revision:4,status:'ACTIVE',_count:{runs:3,approvals:1}};
 }}};
 return {prisma,rows};
}
module.exports={read,load,base,career,policy,assembly,fakeDatabase};

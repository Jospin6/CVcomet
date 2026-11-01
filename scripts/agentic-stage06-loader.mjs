/** Test-only ESM loader for Next.js @/ aliases and extensionless TS imports.
 * Not used by production Next.js or LangGraph. */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as pathResolve, extname } from 'node:path';

const root = pathResolve(fileURLToPath(new URL('../',import.meta.url)));
export async function resolve(specifier, context, nextResolve) {
  let path;
  if (specifier.startsWith('@/')) path=pathResolve(root,'src',specifier.slice(2));
  else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    path=pathResolve(fileURLToPath(new URL('.',context.parentURL)),specifier);
  }
  if (path) {
    const knownExtension=['.ts','.tsx','.mjs','.js','.cjs','.json'].includes(extname(path));
    const candidates=knownExtension?[path]:[path,path+'.ts',path+'.tsx',path+'.mjs',path+'.js',pathResolve(path,'index.ts')];
    for(const candidate of candidates) if(existsSync(candidate)) return {url:pathToFileURL(candidate).href,shortCircuit:true};
  }
  return nextResolve(specifier,context);
}

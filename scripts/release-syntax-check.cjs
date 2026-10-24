#!/usr/bin/env node
/** Parse every TypeScript and TSX source without building or loading runtime deps.
 * This is syntax ONLY; typecheck/build remain mandatory in staging. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); } catch {
  try { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); } catch {
    console.error('TypeScript compiler unavailable; syntax verification not performed'); process.exit(2);
  }
}
const project = path.resolve(__dirname,'..');
const roots = ['src','prisma','scripts'];
let count = 0, errors = 0;
for (const dirname of roots) {
  const root = path.join(project, dirname);
  function check(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory()) { if (!['node_modules', '.next'].includes(item.name)) check(path.join(dir,item.name)); continue; }
      if (!item.isFile() || !/\.tsx?$/.test(item.name) || /\.d\.ts$/.test(item.name)) continue;
      const filepath = path.join(dir,item.name);
      const source = ts.createSourceFile(filepath, fs.readFileSync(filepath, 'utf8'), ts.ScriptTarget.Latest, true, item.name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      count++;
      for (const diagnostic of source.parseDiagnostics) {
        errors++;
        console.error(`${path.relative(project,filepath)}:${source.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1} syntax_error_TS${diagnostic.code}`);
      }
    }
  }
  if (fs.existsSync(root)) check(root);
}
console.log(`${count} TypeScript/TSX files parsed; ${errors} syntax errors. Semantic typecheck NOT performed.`);
process.exitCode = errors ? 1 : 0;

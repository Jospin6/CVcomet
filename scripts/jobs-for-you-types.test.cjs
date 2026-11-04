/* Focused semantic type contract test for the previously reported TS errors.
 * Does not substitute for `npm run typecheck` in the complete app. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { test } = require('node:test');
let ts;
try { ts = require('typescript'); }
catch {
  ts = require(path.join(cp.execFileSync('npm', ['root', '-g'], {
    encoding: 'utf8',
  }).trim(), 'typescript'));
}

const root = path.resolve(__dirname, '..');
const files = [
  'src/components/jobs/jobs-for-you.tsx',
  'src/app/api/find-jobs/for-you/route.ts',
];
function typeDeclaration(file, name) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const alias = ast.statements.find((node) =>
    ts.isTypeAliasDeclaration(node) && node.name.text === name);
  assert.ok(alias, `Expected ${name} in ${file}`);
  return alias.getText(ast);
}

test('work dates, nullable AI scores and preference Prisma delegate compile', () => {
  const ui = files[0];
  const api = files[1];
  assert.match(fs.readFileSync(path.join(root, api), 'utf8'), /import type \{ JobDiscoveryResult \}/);
  const definitions = [
    'type SavedResume = { experiences?: { title: string; company: string; description?: string[] }[]; title: string; id: string; };',
    'type FindJob = { id: string; match?: { score: number | null; matched: string[]; missing: string[]; explanation: string }; };',
    'type UnifiedJob = { id: string; match?: { score: number; matched: string[]; missing: string[]; explanation: string }; };',
    'type MatchingPreferences = { cvId: string | null; countries: string[] };',
    typeDeclaration(ui, 'FullResume'),
    typeDeclaration(ui, 'MatchJob'),
    typeDeclaration(api, 'PreferenceStore'),
    `declare const fullResume: FullResume;
     const work = fullResume.experiences?.[0];
     const start: string | undefined = work?.start;
     const end: string | undefined = work?.end;
     const scores = new Map<string, MatchJob['match']>();
     const nullableMatch = {score: null, matched: [], missing: [], explanation: ''};
     scores.set('sample', nullableMatch);
     const ranked: MatchJob['match'] = nullableMatch;
     const verified: MatchJob['match'] = nullableMatch;
     declare const store: PreferenceStore;
     store.findUnique({where: {userId: 'abc'}});
     store.upsert({where: {userId:'abc'}, create:{userId:'abc', filters:{cvId:null,countries:[]}}, update:{filters:{cvId:null,countries:[]}}});
     void start; void end; void ranked; void verified;`,
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvcomet-typecheck-'));
  try {
    const source = path.join(tmp, 'contract.ts');
    fs.writeFileSync(source, definitions.join('\n\n'));
    const command = cp.spawnSync('tsc', [
      '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022',
      '--module', 'CommonJS', '--lib', 'ES2022', source,
    ], { encoding: 'utf8' });
    assert.equal(command.status, 0,
      `${command.stdout || ''}\n${command.stderr || ''}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

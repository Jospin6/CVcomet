const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, 'public/locales', p, 'common.json'), 'utf8'));
const en = read('en'); const fr = read('fr');
function leaves(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
}
const enKeys = new Set(leaves(en)); const frKeys = new Set(leaves(fr));
const missingFr = [...enKeys].filter(k => !frKeys.has(k));
const missingEn = [...frKeys].filter(k => !enKeys.has(k));
assert.deepEqual(missingFr, [], `Missing FR: ${missingFr.join(', ')}`);
assert.deepEqual(missingEn, [], `Missing EN: ${missingEn.join(', ')}`);
for (const key of ['applications','jobMatch','resumeEditor','ats','findJobs','jobsForYou','resumeImport']) {
  assert.ok(en[key] && fr[key], `Missing central domain ${key}`);
}
assert.equal(en.applications.applicationsCount_one, '{{count}} application');
assert.ok(fr.applications.applicationsCount_other.includes('{{count}}'));
const files = [
  'src/lib/career/application-copy.ts','src/lib/career/job-copy.ts',
  'src/lib/resume-editor-copy.ts','src/lib/resume-ats-copy.ts',
  'src/app/page.tsx','src/components/career/career-command-center.tsx', 'src/components/admin/ai-settings.tsx',
  'src/app/dashboard/find-jobs/page.tsx','src/components/jobs/jobs-for-you.tsx'
];
for (const file of files) {
  const source = fs.readFileSync(path.join(root,file),'utf8');
  assert.match(source, /getCentralCopy\(/, `${file} has not migrated`);
}
for (const key of enKeys) {
  const pick = (obj) => key.split('.').reduce((v, part) => v?.[part], obj);
  const enValue = pick(en), frValue = pick(fr);
  if (typeof enValue === 'string' && typeof frValue === 'string') {
    const vars = (value) => [...value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map(match => match[1]).sort();
    assert.deepEqual(vars(enValue), vars(frValue), `Interpolation mismatch at ${key}`);
  }
}
console.log(`i18next catalogs aligned: ${enKeys.size} EN / ${frKeys.size} FR leaves`);

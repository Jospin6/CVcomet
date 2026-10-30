import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ui = fs.readFileSync(path.join(process.cwd(), "src/components/career-map/career-map-page.tsx"), "utf8");
const service = fs.readFileSync(path.join(process.cwd(), "src/lib/career-map/service.ts"), "utf8");
let passed = 0;
function check(name, callback) {
  callback();
  passed += 1;
  process.stdout.write(`✓ ${name}\n`);
}
check("Both files parse as TypeScript/TSX", () => {
  for (const [code, filename] of [[ui, "career-map-page.tsx"], [service, "service.ts"]]) {
    const output = ts.transpileModule(code, {
      fileName: filename,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    });
    assert.deepEqual(output.diagnostics ?? [], []);
  }
});
check("Old form and explanatory block are removed", () => {
  assert.doesNotMatch(ui, /CV de référence|Métiers à explorer|Générer la carte|Analyse basée sur les compétences et expériences déclarées/);
});
check("Role map has a real central node and clickable occupations", () => {
  assert.match(ui, /ROOT_X/);
  assert.match(ui, /setRole\(node\)/);
  assert.match(ui, /strokeDasharray="5 7"/);
});
check("Preferences are real controlled inputs", () => {
  for (const key of ["goal", "balance", "identity", "income", "qualities", "positions", "workMode"]) {
    assert.match(ui, new RegExp(`preferences\\.${key}`));
  }
  assert.match(ui, /career-role-interest/);
});
check("Resume selector uses the actual resume document renderer", () => {
  assert.match(ui, /AtsResumePreview record=\{cv\}/);
  assert.match(ui, /generate\(cv.id, preferences\)/);
});
check("Role details show real acquired and missing role skills", () => {
  assert.match(ui, /role\.acquired/);
  assert.match(ui, /role\.missing/);
  assert.match(ui, /role\.plan/);
});
check("Map and goal creation retain authenticated backend workflows", () => {
  assert.match(ui, /fetch\("\/api\/career-map"/);
  assert.match(ui, /fetch\("\/api\/career-map\/goals"/);
  assert.match(service, /conversation: \{ userId \}/);
});
check("No fabricated salary or hardcoded vacancy logos", () => {
  assert.doesNotMatch(ui, /\$275,000|\$150,000|nvidia.com|google.com\/s2/);
  assert.match(ui, /\/api\/find-jobs\?q=/);
});
check("Role scores reflect skills without a synthetic floor", () => {
  assert.match(service, /Math\.round\(acquired\.length \* 100 \/ role\.skills\.length\)/);
  assert.doesNotMatch(service, /Math\.max\(15/);
});
check("Map schema validates preference choices and caps role count", () => {
  assert.match(service, /positions: z\.number\(\)\.int\(\)\.min\(4\)\.max\(12\)/);
  assert.match(service, /goal: z\.enum/);
});
check("Career paths rank CV-backed roles and link each node to the owner", () => {
  const compiled = ts.transpileModule(
    `${service}\nexport const __roleGraphTest = roleGraph;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
  ).outputText;
  // Lightweight runtime isolation: role scoring is pure and never touches the DB.
  const chain = new Proxy(() => chain, {
    get: (_, key) => key === "parse" ? (value) => value : () => chain,
    apply: () => chain,
  });
  const z = new Proxy({}, { get: () => () => chain });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: name => name === "zod"
      ? { z }
      : name.includes("prisma")
        ? { __esModule: true, default: {} }
        : name.includes("http")
          ? { ProfileError: class extends Error {} }
          : { getCareerProfile: () => {} },
  });
  const prefs = {
    targetRoles: ["AI Engineer"], interests: [], workMode: "ANY",
    goal: "EXPLORATION", balance: "BALANCED", identity: "SPECIALIST",
    income: "COMFORTABLE", qualities: [], positions: 9,
  };
  const graph = exports.__roleGraphTest("python rag api cloud llm", prefs);
  assert.equal(graph.nodes.length, 9);
  assert.equal(graph.nodes[0].id, "ai-engineer");
  assert.equal(graph.nodes[0].compatibility, 83);
  assert.equal(graph.edges[0].from, "profile");
  const noMatch = exports.__roleGraphTest("", { ...prefs, positions: 4 });
  assert.equal(noMatch.nodes[0].compatibility, 0);
});
console.log(`\n${passed} focused checks passed.`);

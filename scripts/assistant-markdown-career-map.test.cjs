const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function source(file) { return fs.readFileSync(path.join(root, file), "utf8"); }

function transpile(relative, imports) {
  const output = ts.transpileModule(source(relative), {
    fileName: relative,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const load = id => {
    if (Object.hasOwn(imports, id)) return imports[id];
    throw new Error(`Unexpected import ${id}`);
  };
  vm.runInNewContext(`(function(require,module,exports){ ${output}\n })`, { console, Error })(load, mod, mod.exports);
  return mod.exports;
}

const NextResponse = {json: (payload, info) => ({ payload, status: info.status })};
class AgenticError extends Error {
  constructor(code, status=500) { super(code);this.name="AgenticError";this.code=code;this.status=status; }
}
class ProfileError extends Error {
  constructor(status,code) { super(code);this.name="ProfileError";this.code=code;this.status=status; }
}
const errorResponse = transpile("src/lib/career-map/error-response.ts", {
  "next/server": { NextResponse },
  "@/lib/agentic/core/errors": { AgenticError },
  "@/lib/career-profile/http": { ProfileError, profileErrorResponse: error => NextResponse.json({error:error.code},{status:error.status}) },
}).careerMapErrorResponse;

test("Career Map converts LangGraph failures into actionable safe errors", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(errorResponse(new AgenticError("AGENT_RUN_FAILED")))), {
    payload: {error: "CAREER_MAP_GRAPH_FAILED"}, status: 503,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(errorResponse(new AgenticError("AGENT_DEADLINE_EXCEEDED")))), {
    payload: {error: "CAREER_MAP_TIMEOUT"}, status: 504,
  });
});

test("Career Map identifies missing Neon migrations and database connectivity", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(errorResponse({code:"P2021"}))), {
    payload: {error:"CAREER_MAP_MIGRATION_REQUIRED"}, status:503,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(errorResponse({code:"P1001"}))), {
    payload: {error:"CAREER_MAP_DB_UNAVAILABLE"}, status:503,
  });
});

test("Career Map ownership and quota errors remain unchanged", () => {
  const result = errorResponse(new ProfileError(404, "CV_NOT_FOUND"));
  assert.equal(result.status, 404);
  assert.equal(result.payload.error, "CV_NOT_FOUND");
});

test("Markdown rendering is wired only to the assistant's response", () => {
  const page = source("src/app/dashboard/assistant/page.tsx");
  assert.match(page, /<AssistantMarkdown content=\{item\.content\}\s*\/>/);
  assert.match(page, /<p className="whitespace-pre-wrap break-words">\{item\.content\}<\/p>/);
  assert.match(source("src/components/career/AssistantMarkdown.tsx"), /skipHtml/);
  assert.match(source("src/components/career/AssistantMarkdown.tsx"), /remarkPlugins=\{\[remarkGfm\]\}/);
});

test("Markdown component does not execute HTML or hotload remote images", () => {
  const code = source("src/components/career/AssistantMarkdown.tsx");
  assert.doesNotMatch(code, /dangerouslySetInnerHTML|rehypeRaw/);
  assert.match(code, /url\.protocol === "http:" \|\| url\.protocol === "https:"/);
  assert.match(code, /img: \(\{ alt \}\)/);
  assert.match(code, /noopener noreferrer nofollow/);
});

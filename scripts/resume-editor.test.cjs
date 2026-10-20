const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const loadSource = require("./source-loader.cjs");
const dbKey = path.resolve(__dirname, "../prisma/prisma.ts");
const editor = loadSource({})("src/lib/resume-editor.ts");
const owner = "11111111-1111-4111-8111-111111111111", cvId = "22222222-2222-4222-8222-222222222222";

test("a scratch resume edits every section independently and keeps source objects intact", () => {
  const original = editor.resumeContentSchema.parse({});
  let draft = editor.setResumeField(original, "summary.0", "Created accessible React interfaces.");
  draft = editor.setResumeField(draft, "contact.name", "Camille Example");
  draft = editor.addResumeEntry(draft, "experiences");
  draft = editor.setResumeField(draft, "experiences.0.company", "Example Studio");
  draft = editor.setResumeField(draft, "experiences.0.description", "Built a dashboard.\nImproved accessibility.");
  assert.deepEqual(original.summary, []); assert.equal(original.contact.name, "");
  assert.equal(draft.contact.name, "Camille Example");
  assert.deepEqual(draft.experiences[0].description, ["Built a dashboard.", "Improved accessibility."]);
  assert.deepEqual(editor.resumeContentSchema.parse(draft), draft);
  assert.equal(editor.setResumeField(draft, "__proto__.polluted", "yes"), draft);
});

test("layout changes preserve content and pagination keeps every entry in its original order", () => {
  let draft = editor.resumeContentSchema.parse({ title: "Designer", experiences: Array.from({ length: 8 }, (_, i) => ({ title: "Role " + i })) });
  draft.design = editor.moveResumeSection(draft.design, "educations", 0);
  const heights = Object.fromEntries(editor.resumeUnits(draft).map(unit => [unit.key, 220]));
  for (const layout of ["modern", "classic", "minimal"]) {
    draft.design.layout = layout;
    const pages = editor.paginateResume(draft, heights, 170);
    assert.ok(pages.length > 1);
    const experienceUnits = pages.flatMap(page => page.main).filter(unit => unit.section === "experiences");
    assert.deepEqual(experienceUnits.map(unit => unit.index), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(draft.experiences[0].title, "Role 0");
  }
});

test("document saves validate ownership, revisions and all design/content fields in one transaction", async () => {
  let cv = { id: cvId, revision: 0, ...editor.resumeContentSchema.parse({}) }, snapshots = [];
  const db = { cv: {
    findFirst: async ({ where }) => where.conversation.userId === owner && where.id === cvId ? cv : null,
    updateMany: async ({ where, data }) => { if (where.revision !== cv.revision) return { count: 0 }; cv = { ...cv, ...data, revision: cv.revision + 1 }; return { count: 1 }; },
    findUniqueOrThrow: async () => cv,
  }, resumeVersion: { create: async ({ data }) => snapshots.push(data) }, $transaction: async operation => operation(db) };
  const route = loadSource({ [dbKey]: db, "@/lib/auth": { getSessionUser: async () => ({ id: owner }) } })("src/app/api/cvs/[id]/route.ts");
  const save = (body, id = cvId) => route.PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  assert.equal((await save({ contact: { name: "Camille Example" }, design: { layout: "classic", accent: "#1E4B8F" }, experiences: [{ title: "Designer", company: "Example" }], revision: 0 })).status, 200);
  assert.equal(cv.contact.name, "Camille Example"); assert.equal(cv.design.layout, "classic"); assert.equal(cv.revision, 1);
  assert.equal(snapshots[0].snapshot.contact.name, "");
  assert.equal((await save({ title: "Stale", revision: 0 })).status, 409);
  assert.equal((await save({ userId: owner, title: "Forged" })).status, 400);
  assert.equal((await save({ title: "Foreign" }, "foreign")).status, 404);
  assert.equal(cv.revision, 1); assert.equal(snapshots.length, 1);
});

test("AI can draft an empty summary from user notes and returns a proposal without writing the CV", async () => {
  let seen, reservations = 0;
  const profile = { summary: "", skills: "", experiences: [], education: [], projects: [], certifications: [] };
  const route = loadSource({ [dbKey]: { cv: { findFirst: async ({ where }) => where.id === cvId && where.conversation.userId === owner ? { id: cvId } : null } },
    "@/lib/career/auth-user": { requireUser: async () => ({ id: owner }) },
    "@/lib/career-profile/service": { getCareerProfile: async () => profile, careerProfileContext: value => value },
    "@/lib/career-profile/ai": { factualRules: "Never invent candidate facts.", reserveProfileAI: async () => { reservations++; } },
    "@/lib/ai/model": { getAIModel: async () => "configured-provider" },
    ai: { generateText: async options => { seen = options; return { text: "Developer building accessible React interfaces." }; } },
  })("src/app/api/resume-ai/route.ts");
  const request = body => new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const body = { cvId, action: "GENERATE", text: "", notes: "I built accessible React interfaces.", field: "summary.0", language: "en", draft: editor.resumeContentSchema.parse({}) };
  const response = await route.POST(request(body));
  assert.equal(response.status, 200); assert.ok((await response.json()).proposal.includes("React"));
  assert.match(seen.prompt, /I built accessible React interfaces/); assert.match(seen.system, /Never invent/);
  assert.equal(seen.model, "configured-provider"); assert.equal(reservations, 1);
  assert.equal((await route.POST(request({ ...body, notes: "" }))).status, 422);
  assert.equal((await route.POST(request({ ...body, cvId: owner }))).status, 404);
  assert.equal(reservations, 1);
});

test("conversation edits validate allowed fields, persist content and design together, and reject forbidden targets", async () => {
  let cv = { id: cvId, revision: 0, ...editor.resumeContentSchema.parse({ title: "Developer", summary: ["Built React interfaces."], experiences: [{ title: "Developer", company: "Example Studio", description: ["Improved accessibility."] }] }) };
  const snapshots = [];
  const db = {
    cv: {
      findFirst: async ({ where }) => where.id === cvId && where.conversation.userId === owner ? cv : null,
      updateMany: async ({ where, data }) => {
        if (where.revision !== cv.revision) return { count: 0 };
        cv = { ...cv, ...data, revision: cv.revision + 1 }; return { count: 1 };
      },
      findUniqueOrThrow: async () => cv,
    },
    jobMatch: { findFirst: async () => null },
    resumeVersion: { create: async ({ data }) => snapshots.push(data) },
    $transaction: async operation => operation(db),
  };
  let result = {
    status: "applied", message: "Updated title and layout.", summary: ["Updated the title", "Changed the layout"],
    edits: [
      { type: "setField", path: "title", value: "AI Engineer" },
      { type: "updateDesign", changes: { layout: "modern", accent: "#1E4B8F", font: "sans" } },
    ],
  };
  const route = loadSource({ [dbKey]: db,
    "@/lib/auth": { getSessionUser: async () => ({ id: owner, name: "Camille", email: "camille@example.test" }) },
    "@/lib/career-profile/service": { getCareerProfile: async () => ({}), careerProfileContext: value => value },
    "@/lib/career-profile/ai": { factualRules: "Never invent facts.", reserveProfileAI: async () => {} },
    "@/lib/ai/model": { getAIModel: async () => "configured-provider" },
    ai: { generateObject: async () => ({ object: result }) },
  })("src/app/api/cvs/[id]/assistant/route.ts");
  const request = revision => new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: "Change my title and make it two columns", language: "en", revision }) });
  const response = await route.POST(request(0), { params: Promise.resolve({ id: cvId }) });
  assert.equal(response.status, 200); assert.equal(cv.title, "AI Engineer"); assert.equal(cv.design.layout, "modern");
  assert.equal(cv.design.accent, "#1E4B8F"); assert.equal(cv.revision, 1);
  assert.equal(snapshots[0].label, "Before AI conversation edit"); assert.equal(snapshots[0].snapshot.title, "Developer");
  result = { status: "applied", message: "Nope", summary: ["Nope"], edits: [{ type: "setField", path: "conversation.userId", value: "forged" }] };
  assert.equal((await route.POST(request(1), { params: Promise.resolve({ id: cvId }) })).status, 422);
  assert.equal(cv.title, "AI Engineer");
  assert.equal((await route.POST(request(0), { params: Promise.resolve({ id: cvId }) })).status, 409);
});

test("PDF export contains real text and creates multiple A4 pages", async () => {
  const React = require("react"), { renderToBuffer } = await import("@react-pdf/renderer");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { ResumePDF } = loadSource({})("src/components/resumes/resume-pdf.tsx");
  const copy = loadSource({})("src/lib/resume-editor-copy.ts").resumeEditorCopy.en;
  const draft = editor.resumeContentSchema.parse({ title: "Designer", contact: { name: "Camille Example", email: "camille@example.test" }, summary: ["Created accessible interfaces."], experiences: [{ title: "Designer", company: "Example Studio", description: ["Built a dashboard."] }] });
  const units = editor.resumeUnits(draft, false);
  const pages = [{ main: units.filter(unit => unit.section === "summary"), side: [] }, { main: units.filter(unit => unit.section === "experiences"), side: [] }];
  const bytes = await renderToBuffer(React.createElement(ResumePDF, { resume: draft, pages, copy }));
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const document = await task.promise; assert.equal(document.numPages, 2);
    const page = await document.getPage(2), text = await page.getTextContent();
    assert.match(text.items.filter(item => "str" in item).map(item => item.str).join(" "), /Example Studio/);
  } finally { await task.destroy(); }
});

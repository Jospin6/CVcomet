/* Real route handlers with an isolated database double. No live account or AI writes. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function loader(mocks = {}) {
  const cache = new Map();
  function load(name, parent = path.join(root, "entry.ts")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith(".") && !name.startsWith("@/") && !path.isAbsolute(name)) return require(name);
    let file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(parent), name);
    if (!path.extname(file)) file = [file + ".ts", file + ".tsx", file + ".js"].find(fs.existsSync);
    if (Object.hasOwn(mocks, file)) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new vm.Script("(function(require,module,exports){" + code + "\n})", { filename: file }).runInThisContext()(dep => load(dep, file), module, module.exports);
    return module.exports;
  }
  return file => load(path.join(root, file));
}
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const dbKey = path.join(root, "prisma/prisma.ts");
function fixture(authenticated = true) {
  let documents = [];
  const db = { uploadedResume: {
    findMany: async ({ where, select }) => documents.filter(row => row.userId === where.userId).map(row => Object.fromEntries(Object.keys(select).map(key => [key, row[key]]))),
    create: ({ data, select }) => ({ data, select }),
    findFirst: async ({ where }) => documents.find(row => row.id === where.id && row.userId === where.userId) || null,
    deleteMany: async ({ where }) => { const before = documents.length; documents = documents.filter(row => !(row.id === where.id && row.userId === where.userId)); return { count: before - documents.length }; },
  }, $transaction: async writes => writes.map(({ data, select }) => { const row = { ...data, id: `document-${documents.length}`, createdAt: new Date() }; documents.push(row); return Object.fromEntries(Object.keys(select).map(key => [key, row[key]])); }) };
  const load = loader({ "@/lib/auth": { getSessionUser: async () => authenticated ? { id: owner } : null }, [dbKey]: db });
  return { collection: load("src/app/api/resume-documents/route.ts"), item: load("src/app/api/resume-documents/[id]/route.ts"), rows: () => documents, add: data => documents.push(data) };
}
function request(files) {
  const body = new FormData(); files.forEach(file => body.append("resumes", file));
  return new Request("http://localhost/api/resume-documents", { method: "POST", body });
}
const text = (name = "resume.txt") => new File(["Camille Martin\nDeveloper\nReact, TypeScript"], name, { type: "text/plain" });
const context = id => ({ params: Promise.resolve({ id }) });

function docxFixture() {
  const { crc32 } = require("node:zlib");
  const entries = [
    ["[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ["word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Camille Martin</w:t></w:r></w:p><w:p><w:r><w:t>Frontend Developer</w:t></w:r></w:p></w:body></w:document>'],
  ];
  const files = [], directory = []; let offset = 0;
  for (const [name, value] of entries) {
    const filename = Buffer.from(name), data = Buffer.from(value), checksum = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    files.push(local, filename, data); directory.push(central, filename); offset += local.length + filename.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, central, end]);
}

test("valid DOCX provides readable text while preserving the original Word file", async () => {
  const f = fixture(), bytes = docxFixture();
  const response = await f.collection.POST(request([new File([bytes], "resume.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })]));
  assert.equal(response.status, 201);
  const [document] = await response.json();
  assert.ok(document.previewText.includes("Camille Martin")); assert.ok(document.previewText.includes("Frontend Developer"));
  assert.deepEqual(f.rows()[0].content, bytes);
});

test("profile and scratch drafts use server-owned facts and reject client-supplied profile data", async () => {
  let data, loads = 0;
  const profile = { headline: "Developer", summary: "Built a product.", skills: "React", languages: "French", experiences: [{ id: other, title: "Developer", company: "Example", location: "Paris", start: "2023", end: "", description: "Built a product.\nWrote tests." }], education: [], projects: [], certifications: [] };
  const route = loader({ "@/lib/auth": { getSessionUser: async () => ({ id: owner }) }, "@/lib/career-profile/service": { getCareerProfile: async id => { assert.equal(id, owner); loads++; return profile; } }, [dbKey]: { cv: { create: async args => { data = args.data; return { id: "draft", ...data }; } } } })("src/app/api/cvs/route.ts");
  const create = body => route.POST(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  assert.equal((await create({ source: "PROFILE", userId: other })).status, 400);
  assert.equal((await create({ source: "PROFILE" })).status, 201);
  assert.equal(data.conversation.create.userId, owner); assert.equal(data.title, "Developer"); assert.equal(data.skills[0].hardskills, "React");
  assert.deepEqual(data.experiences[0].description, ["Built a product.", "Wrote tests."]); assert.equal("id" in data.experiences[0], false);
  assert.equal((await create({ source: "SCRATCH" })).status, 201); assert.equal(loads, 1); assert.deepEqual(data.summary, []); assert.deepEqual(data.experiences, []);
});

test("document operations require authentication before parsing or reading files", async () => {
  const f = fixture(false);
  assert.equal((await f.collection.GET()).status, 401);
  assert.equal((await f.collection.POST(new Request("http://localhost", { method: "POST" }))).status, 401);
  assert.equal((await f.item.GET(new Request("http://localhost"), context("a"))).status, 401);
  assert.equal((await f.item.DELETE(new Request("http://localhost"), context("a"))).status, 401);
  assert.equal(f.rows().length, 0);
});

test("multiple files persist their original bytes and return metadata without binary contents", async () => {
  const f = fixture();
  const response = await f.collection.POST(request([text(), new File(["%PDF-1.4\noriginal"], "resume.pdf", { type: "application/pdf" })]));
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.length, 2); assert.equal("content" in result[0], false); assert.equal("userId" in result[0], false);
  assert.ok(result[0].previewText.includes("Camille Martin"));
  assert.equal(f.rows()[1].content.toString(), "%PDF-1.4\noriginal");
  assert.ok(f.rows().every(row => row.userId === owner));
});

test("forged formats, corrupt DOCX and empty files reject the whole batch before writes", async () => {
  for (const invalid of [new File(["not a PDF"], "bad.pdf", { type: "application/pdf" }), new File(["bad zip"], "bad.docx"), new File([], "empty.txt"), new File(["hello"], "script.html")]) {
    const f = fixture();
    const response = await f.collection.POST(request([text(), invalid]));
    assert.ok([400, 415].includes(response.status)); assert.equal(f.rows().length, 0);
  }
});

test("file count, per-file size and aggregate limits apply on the server", async () => {
  const f = fixture();
  assert.equal((await f.collection.POST(request([]))).status, 400);
  assert.equal((await f.collection.POST(request(Array.from({ length: 11 }, () => text())))).status, 400);
  assert.equal((await f.collection.POST(request([new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.pdf")]))).status, 413);
  assert.equal((await f.collection.POST(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": String(33 * 1024 * 1024) }, body: "x" }))).status, 413);
  assert.equal(f.rows().length, 0);
});

test("list, preview, download and delete are scoped to the owner", async () => {
  const f = fixture();
  await f.collection.POST(request([text()]));
  f.add({ id: "foreign", userId: other, name: "private.txt", content: Buffer.from("secret") });
  const listed = await (await f.collection.GET()).json(); assert.equal(listed.length, 1);
  assert.equal((await f.item.GET(new Request("http://localhost"), context("foreign"))).status, 404);
  assert.equal((await f.item.DELETE(new Request("http://localhost"), context("foreign"))).status, 404);
  const file = await f.item.GET(new Request("http://localhost?download=1"), context(listed[0].id));
  assert.equal(await file.text(), "Camille Martin\nDeveloper\nReact, TypeScript");
  assert.match(file.headers.get("content-disposition"), /^attachment/); assert.equal(file.headers.get("cache-control"), "private, no-store");
  assert.equal((await f.item.DELETE(new Request("http://localhost"), context(listed[0].id))).status, 204);
  assert.equal(f.rows().length, 1); assert.equal(f.rows()[0].userId, other);
});

test("PDF preview serves original bytes inline and download serves them as attachment", async () => {
  const f = fixture();
  const response = await f.collection.POST(request([new File(["%PDF-1.4\nfixture"], 'CV "équipe".pdf', { type: "application/pdf" })]));
  const [document] = await response.json();
  const inline = await f.item.GET(new Request("http://localhost"), context(document.id));
  assert.equal(inline.headers.get("content-type"), "application/pdf"); assert.match(inline.headers.get("content-disposition"), /^inline/);
  assert.equal(await inline.text(), "%PDF-1.4\nfixture");
  const download = await f.item.GET(new Request("http://localhost?download=1"), context(document.id));
  assert.match(download.headers.get("content-disposition"), /^attachment; filename\*=UTF-8''/);
});

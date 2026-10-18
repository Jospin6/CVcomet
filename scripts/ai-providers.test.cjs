// Targeted integration checks: real SDK adapters, fake HTTP, no billable calls.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { generateText } = require("ai");
const loader = require("./source-loader.cjs");
const dbPath = path.resolve(__dirname, "../prisma/prisma.ts");

function database() {
  const rows = new Map(); let settings = null;
  const db = {
    aIProviderConfig: {
      findUnique: async ({ where }) => rows.get(where.provider) || null,
      findMany: async () => [...rows.values()],
      upsert: async ({ where, create, update }) => {
        const row = { useEnvironmentKey: true, enabled: true, ...rows.get(where.provider), ...(rows.has(where.provider) ? update : create), updatedAt: new Date() };
        rows.set(where.provider, row); return row;
      },
    },
    aISettings: {
      findUnique: async () => settings,
      upsert: async ({ create, update }) => (settings = settings ? { ...settings, ...update } : create),
    },
    $transaction: async operation => operation(db),
  };
  return { db, rows };
}

test("provider/model changes persist immediately, keys are encrypted and active config cannot be removed", async () => {
  const oldSecret = process.env.AI_CONFIG_ENCRYPTION_KEY;
  process.env.AI_CONFIG_ENCRYPTION_KEY = "test-only-encryption-secret";
  try {
    const { db, rows } = database();
    const load = loader({ [dbPath]: db });
    const config = load("src/lib/ai/config.ts");
    const secrets = load("src/lib/ai/secrets.ts");
    const model = load("src/lib/ai/model.ts");
    const key = "secret-which-must-never-be-in-a-response";
    for (const provider of ["OPENAI", "ANTHROPIC", "HUGGINGFACE", "GROQ", "GOOGLE"]) {
      await config.saveAIProviderConfig(provider, { apiKey: key, model: provider + "-model", enabled: true }, "admin");
      const cipher = rows.get(provider).encryptedApiKey;
      assert.ok(cipher && !cipher.includes(key));
      await config.activateAIProvider(provider, "admin");
      assert.equal((await model.getAIContext()).provider, provider);
      const publicView = await config.getAIAdminView();
      assert.equal(publicView.activeProvider, provider);
      assert.ok(!JSON.stringify(publicView).includes(key));
      assert.ok(!JSON.stringify(publicView).includes(cipher));
      await assert.rejects(config.saveAIProviderConfig(provider, { apiKey: null, model: "model", enabled: true }, "admin"), { code: "AI_ACTIVE_PROVIDER_REQUIRED" });
      await assert.rejects(config.saveAIProviderConfig(provider, { model: "", enabled: false }, "admin"), { code: "AI_ACTIVE_PROVIDER_REQUIRED" });
    }
    await config.saveAIProviderConfig("GOOGLE", { model: "changed-model", enabled: true }, "admin");
    assert.equal((await model.getAIContext()).modelId, "changed-model");
    const cipher = rows.get("OPENAI").encryptedApiKey;
    assert.throws(() => secrets.decryptAIKey(cipher, "GROQ"), { code: "AI_KEY_UNREADABLE" });
    rows.get("OPENAI").encryptedApiKey = "broken-cipher";
    await config.saveAIProviderConfig("OPENAI", { apiKey: "replacement", model: "new-model", enabled: true }, "admin");
    assert.equal((await config.getAIProviderConfig("OPENAI")).apiKey, "replacement");
  } finally {
    if (oldSecret === undefined) delete process.env.AI_CONFIG_ENCRYPTION_KEY;
    else process.env.AI_CONFIG_ENCRYPTION_KEY = oldSecret;
  }
});

for (const [provider, host] of [
  ["OPENAI", "api.openai.com"], ["GOOGLE", "generativelanguage.googleapis.com"],
  ["ANTHROPIC", "api.anthropic.com"], ["HUGGINGFACE", "router.huggingface.co"], ["GROQ", "api.groq.com"],
]) {
  test(provider + " adapter sends text/JSON to its own endpoint with its own key", async () => {
    const originalFetch = global.fetch; let calls = 0;
    const key = "fake-key-for-" + provider;
    global.fetch = async (url, init) => {
      calls++;
      assert.equal(new URL(url).host, host);
      const headers = new Headers(init.headers);
      assert.equal(provider === "GOOGLE" ? headers.get("x-goog-api-key") : provider === "ANTHROPIC" ? headers.get("x-api-key") : headers.get("authorization"),
        provider === "GOOGLE" || provider === "ANTHROPIC" ? key : "Bearer " + key);
      const request = JSON.parse(init.body);
      if (provider === "OPENAI") {
        assert.equal(request.temperature, undefined);
        assert.equal(request.max_tokens, undefined);
        assert.ok(request.max_completion_tokens >= 4096);
      }
      const text = '{"ok":true}';
      let body;
      if (provider === "GOOGLE") {
        if (calls === 1) {
          assert.equal(request.generationConfig.responseSchema.properties.ok.type, "boolean");
          assert.equal(request.generationConfig.responseSchema.properties.ok.enum, undefined);
        }
        body = { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } };
      }
      else if (provider === "ANTHROPIC") body = { id: "msg_test", type: "message", role: "assistant", model: "claude-test", content: request.tools
        ? [{ type: "tool_use", id: "call_test", name: request.tools[0].name, input: { ok: true } }]
        : [{ type: "text", text }], stop_reason: request.tools ? "tool_use" : "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      else {
        if (calls === 1) assert.match(JSON.stringify(request.messages), /json/i);
        if (provider === "HUGGINGFACE") assert.equal(request.response_format, undefined);
        body = { id: "chat_test", object: "chat.completion", created: 1, model: "test", choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
      }
      return Response.json(body);
    };
    try {
      const load = loader({ [dbPath]: {},
        "@/lib/auth": { getSessionUser: async () => ({ id: "admin", role: "ADMIN" }), isAdmin: user => user?.role === "ADMIN" },
      });
      const { createAIModel } = load("src/lib/ai/model.ts");
      const modelId = provider === "OPENAI" ? "gpt-5.2" : "test-chat-model";
      const model = createAIModel({ provider, apiKey: key, model: modelId, enabled: true });
      const route = load("src/app/api/admin/ai/test/route.ts");
      const response = await route.POST(new Request("http://localhost/api/admin/ai/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model: modelId, apiKey: key }),
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
      assert.equal((await generateText({ model, prompt: "Reply OK", maxRetries: 0 })).text, '{"ok":true}');
      assert.equal(calls, 2);
    } finally { global.fetch = originalFetch; }
  });
}

test("Google service failures are reported as provider unavailability rather than invalid JSON", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({ error: { code: 503, status: "UNAVAILABLE", message: "The model is overloaded. Please try again later." } }, { status: 503 });
  try {
    const load = loader({ [dbPath]: {},
      "@/lib/auth": { getSessionUser: async () => ({ id: "admin", role: "ADMIN" }), isAdmin: user => user?.role === "ADMIN" },
    });
    const route = load("src/app/api/admin/ai/test/route.ts");
    const response = await route.POST(new Request("http://localhost/api/admin/ai/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "GOOGLE", model: "gemini-test", apiKey: "fake-key" }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "AI_PROVIDER_UNAVAILABLE" });
  } finally { global.fetch = originalFetch; }
});

test("all AI admin endpoints reject anonymous and non-admin users before accessing configuration", async () => {
  for (const user of [null, { id: "user", role: "USER" }]) {
    const load = loader({
      "@/lib/auth": { getSessionUser: async () => user, isAdmin: value => value?.role === "ADMIN" },
      "@/lib/ai/config": new Proxy({}, { get: () => () => { throw new Error("Config must not be accessed"); } }),
      "@/lib/ai/model": {},
    });
    for (const [file, method] of [["route.ts", "GET"], ["route.ts", "PATCH"], ["activate/route.ts", "POST"], ["models/route.ts", "POST"], ["test/route.ts", "POST"]]) {
      const route = load("src/app/api/admin/ai/" + file);
      const request = new Request("http://localhost/api/admin/ai", { method, ...(method !== "GET" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}) });
      assert.equal((await route[method](request)).status, user ? 403 : 401);
    }
  }
});

test("strict schema output is opt-in and legacy or compatible providers keep JSON mode", async t => {
  const { generateObject } = require('ai');
  const { z } = require('zod');
  const { createAIModel } = loader({ [dbPath]: {} })('src/lib/ai/model.ts');
  let expected;
  t.mock.method(global, 'fetch', async (_url, init) => {
    const request = JSON.parse(init.body);
    assert.equal(request.response_format.type, expected);
    if (expected === 'json_schema') assert.equal(request.response_format.json_schema.strict, true);
    return Response.json({ id: 'test', object: 'chat.completion', created: 1, model: request.model, choices: [{ index: 0, message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  });
  for (const [provider, model, strict, format] of [
    ['OPENAI', 'gpt-4o-mini', true, 'json_schema'],
    ['OPENAI', 'gpt-4o-mini', false, 'json_object'],
    ['OPENAI', 'gpt-3.5-turbo', true, 'json_object'],
    ['GROQ', 'compatible-model', true, 'json_object'],
  ]) {
    expected = format;
    const result = await generateObject({ model: createAIModel({ provider, model, apiKey: 'fake-key', enabled: true }, { structuredOutputs: strict }), schema: z.object({ ok: z.boolean() }), prompt: 'Return JSON', maxRetries: 0 });
    assert.equal(result.object.ok, true);
  }
});

test("invalid structured response diagnostics omit document text, issue messages and credentials", t => {
  const { ZodError } = require('zod');
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const { profileAIError } = loader({})('src/lib/career-profile/http.ts');
  const secret = 'private-document-fragment-and-key';
  const validation = new ZodError([{ code: 'invalid_type', expected: 'string', received: 'null', path: [secret], message: secret }]);
  const error = Object.assign(new Error(secret), { name: 'AI_NoObjectGeneratedError', text: secret, responseBody: secret,
    cause: Object.assign(new Error(secret), { name: 'AI_TypeValidationError', cause: validation }) });
  const result = profileAIError(error);
  assert.equal(result.code, 'AI_INVALID_RESPONSE'); assert.equal(result.status, 502);
  assert.equal(logs[0][1].validationIssues, 1);
  assert.deepEqual(logs[0][1].validationCodes, ['invalid_type']);
  assert.ok(!JSON.stringify(logs).includes(secret));
});

test("PDF text extraction runs locally with the installed PDF engine", async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { extractPDFText } = loader({ "pdfjs-dist/legacy/build/pdf.mjs": pdfjs })("src/lib/pdf-text.ts");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const content = "BT /F1 12 Tf 72 720 Td (Sam Developer) Tj ET";
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  assert.match(await extractPDFText(Buffer.from(pdf)), /Sam Developer/);
});

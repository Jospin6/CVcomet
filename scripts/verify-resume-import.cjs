// One live import of a synthetic PDF using the configured provider. Billable.
// Authentication/quota are injected only in this local script. No user or
// profile is created; the actual multipart handler, PDF reader and AI run.
require("@next/env").loadEnvConfig(process.cwd());
const assert = require("node:assert/strict");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { resumePDF } = require("./resume-fixture.cjs");
const client = new PrismaClient();
const mocks = {
  [path.resolve(__dirname, "../prisma/prisma.ts")]: client,
  "@/lib/auth": { getSessionUser: async () => ({ id: "synthetic-fixture-user", role: "USER" }) },
};
const load = require("./source-loader.cjs")(mocks);

async function main() {
  const config = load("src/lib/ai/config.ts");
  const selected = await config.getAIProviderConfig(await config.getActiveAIProvider());
  console.log("Resume import provider:", selected.provider, "/", selected.model);
  mocks["pdfjs-dist/legacy/build/pdf.mjs"] = await import("pdfjs-dist/legacy/build/pdf.mjs");
  mocks["@/lib/career-profile/ai"] = { ...load("src/lib/career-profile/ai.ts"), reserveProfileAI: async () => {} };
  const form = new FormData();
  form.set("resume", new File([resumePDF()], "synthetic-resume.pdf", { type: "application/pdf" }));
  const response = await load("src/app/api/career-profile/import/route.ts").POST(new Request("http://localhost/api/career-profile/import", { method: "POST", body: form }));
  const data = await response.json();
  if (!response.ok) { console.error("Resume import failed:", data.error || "UNAVAILABLE"); process.exitCode = 1; return; }
  assert.equal(data.source.type, "pdf");
  assert.equal(data.extracted.name, "Sam Example");
  assert.equal(data.extracted.linkedin, "https://linkedin.com/in/sam-example");
  assert.ok(data.extracted.experiences.some(item => item.company === "Example Labs"));
  assert.equal(data.extracted.email, undefined);
  console.log("PDF import succeeded: draft returned, bare URL normalized, source facts preserved, no profile saved.");
}
main().catch(error => {
  console.error("Resume import verification failed:", error?.code || error?.name || "UnknownError");
  process.exitCode = 1;
}).finally(() => client.$disconnect());

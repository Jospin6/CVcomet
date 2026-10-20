// Manual live-provider smoke check. Uses synthetic documents and in-memory writes only.
// Run: node -e "require('@next/env').loadEnvConfig(process.cwd()); require('./scripts/source-loader.cjs')({})('scripts/verify-resume-chat.ts')"
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import prisma from "../prisma/prisma";
import { resumeContentSchema, type EditorResume } from "../src/lib/resume-editor";

const owner = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
let saved = { id, revision: 0, ...resumeContentSchema.parse({ title: "Developer", summary: ["Built React interfaces."], experiences: [{ title: "Developer", company: "Example Studio", description: ["Built React interfaces."] }] }) };
const snapshots: unknown[] = [];
const db = {
  cv: {
    findFirst: async () => saved,
    updateMany: async ({ where, data }: { where: { revision: number }; data: EditorResume }) => {
      if (where.revision !== saved.revision) return { count: 0 };
      saved = { ...saved, ...data, revision: saved.revision + 1 }; return { count: 1 };
    },
    findUniqueOrThrow: async () => saved,
  },
  jobMatch: { findFirst: async () => null },
  resumeVersion: { create: async ({ data }: { data: unknown }) => { snapshots.push(data); } },
  $transaction: async (operation: (_tx: unknown) => Promise<unknown>) => operation(db),
};
const loader = createRequire(path.resolve("package.json"))("./scripts/source-loader.cjs");
const real = loader({ [path.resolve("prisma/prisma.ts")]: prisma });
const load = loader({
  [path.resolve("prisma/prisma.ts")]: db,
  "@/lib/auth": { getSessionUser: async () => ({ id: owner }) },
  "@/lib/career-profile/service": { getCareerProfile: async () => ({}), careerProfileContext: () => ({}) },
  "@/lib/career-profile/ai": { ...real("src/lib/career-profile/ai.ts"), reserveProfileAI: async () => {} },
  // Real configured model, real provider request, no writes to the actual database.
  "@/lib/ai/model": real("src/lib/ai/model.ts"),
});
const route = load("src/app/api/cvs/[id]/assistant/route.ts");

async function main() {
  const before = structuredClone(saved);
  const response = await route.POST(new Request("http://localhost/api/cvs/" + id + "/assistant", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "change the title to Software Engineer", language: "en", revision: saved.revision }),
  }), { params: Promise.resolve({ id }) });
  const data = await response.json();
  console.log(JSON.stringify({ status: response.status, result: data.status, error: data.error, edits: data.edits }));
  assert.equal(response.status, 200);
  assert.equal(saved.title, "Software Engineer");
  assert.deepEqual({ ...saved, title: before.title, revision: before.revision }, before);
  assert.equal(snapshots.length, 1);
  console.log("Live title edit: validated, applied, persisted in fixture; other fields preserved.");
}
main().catch(() => { console.error("Live resume chat check failed."); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });

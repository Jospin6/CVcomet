import { z } from "zod";
import {
  moveResumeSection,
  resumeContentSchema,
  resumeDesignSchema,
  resumeSections,
  setResumeField,
  type EditorResume,
} from "@/lib/resume-editor";

const contactFields = ["name", "email", "phone", "city", "linkedin", "website"] as const;
const sectionFields = {
  experiences: ["title", "company", "location", "start", "end", "description"],
  educations: ["degree", "school", "location", "start", "end", "description"],
  skills: ["hardskills", "softskills", "tools"],
  projects: ["title", "description", "technologies", "link"],
  certifications: ["title", "issuer", "date", "description"],
  languages: ["language", "level"],
} as const;

const designChangesSchema = z.object({
  layout: z.enum(["modern", "classic", "minimal"]).optional(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  font: z.enum(["sans", "serif", "mono"]).optional(),
  fontSize: z.number().min(11).max(16).optional(),
  lineHeight: z.number().min(1.2).max(1.8).optional(),
  padding: z.number().min(28).max(64).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "At least one design change is required");

function editSchema(path: z.ZodType<string>) { return z.discriminatedUnion("type", [
  z.object({ type: z.literal("setField"), path, value: z.string().max(8000) }).strict(),
  z.object({ type: z.literal("updateDesign"), changes: designChangesSchema }).strict(),
  z.object({ type: z.literal("moveSection"), section: z.enum(resumeSections), position: z.number().int().min(0).max(resumeSections.length - 1) }).strict(),
  z.object({ type: z.literal("setSectionVisibility"), section: z.enum(resumeSections), visible: z.boolean() }).strict(),
]); }

export const resumeConversationEditSchema = editSchema(z.string().min(1).max(100));

const resultShape = {
  status: z.enum(["applied", "clarification"]),
  message: z.string().trim().min(1).max(1000),
  summary: z.array(z.string().trim().min(1).max(300)).max(12),
  edits: z.array(resumeConversationEditSchema).max(14),
};
function checkResult(value: { status: string; edits: unknown[] }, context: z.RefinementCtx) {
  if (value.status === "applied" && !value.edits.length) context.addIssue({ code: "custom", message: "Applied responses need edits", path: ["edits"] });
  if (value.status === "clarification" && value.edits.length) context.addIssue({ code: "custom", message: "Clarifications cannot edit the document", path: ["edits"] });
}
export const resumeConversationResultSchema = z.object(resultShape).strict().superRefine(checkResult);

export type ResumeConversationEdit = z.infer<typeof resumeConversationEditSchema>;
export type ResumeConversationResult = z.infer<typeof resumeConversationResultSchema>;

export function resumeConversationFields(resume: EditorResume): [string, ...string[]] {
  const fields: [string, ...string[]] = ["title", ...contactFields.map(key => `contact.${key}`)];
  for (let index = 0; index < Math.max(1, resume.summary.length); index++) fields.push(`summary.${index}`);
  for (const section of Object.keys(sectionFields) as (keyof typeof sectionFields)[]) {
    resume[section].forEach((entry, index) => {
      for (const field of sectionFields[section]) fields.push(`${section}.${index}.${field}`);
      if ("description" in entry && Array.isArray(entry.description)) {
        entry.description.forEach((_, bullet) => fields.push(`${section}.${index}.description.${bullet}`));
      }
    });
  }
  return fields;
}

// The provider sees exactly the same field allowlist as the application layer.
export function resumeConversationSchemaFor(resume: EditorResume) {
  return z.object({ ...resultShape, edits: z.array(editSchema(z.enum(resumeConversationFields(resume)))).max(14) })
    .strict().superRefine(checkResult);
}

export class ResumeConversationEditError extends Error {
  constructor() { super("AI_INVALID_EDIT"); }
}

export function applyResumeConversationEdits(resume: EditorResume, edits: ResumeConversationEdit[]) {
  let next = structuredClone(resume);
  const allowed = new Set(resumeConversationFields(resume));
  for (const edit of z.array(resumeConversationEditSchema).max(14).parse(edits)) {
    if (edit.type === "setField") {
      if (!allowed.has(edit.path)) throw new ResumeConversationEditError();
      const updated = setResumeField(next, edit.path, edit.value);
      if (updated === next) throw new ResumeConversationEditError();
      next = updated;
      continue;
    }
    if (edit.type === "updateDesign") {
      next = { ...next, design: resumeDesignSchema.parse({ ...next.design, ...edit.changes }) };
      continue;
    }
    if (edit.type === "moveSection") {
      next = { ...next, design: moveResumeSection(next.design, edit.section, edit.position) };
      continue;
    }
    const hidden = new Set(next.design.hiddenSections);
    if (edit.visible) hidden.delete(edit.section); else hidden.add(edit.section);
    next = { ...next, design: { ...next.design, hiddenSections: [...hidden] } };
  }
  return resumeContentSchema.parse(next);
}

export function resumeConversationChanges(edits: ResumeConversationEdit[]) {
  return edits.map(edit => {
    if (edit.type === "setField") return `Updated ${edit.path}`;
    if (edit.type === "updateDesign") return `Updated ${Object.keys(edit.changes).join(", ")}`;
    if (edit.type === "moveSection") return `Moved ${edit.section}`;
    return `${edit.visible ? "Showed" : "Hid"} ${edit.section}`;
  });
}

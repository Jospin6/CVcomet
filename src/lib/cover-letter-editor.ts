import { z } from "zod";

const text = (max: number) => z.string().max(max).default("");

export const coverLetterContentSchema = z.object({
  recipientName: text(300), recipientTitle: text(300), companyName: text(300), companyAddress: text(1000),
  positionTitle: text(300), introduction: text(6000), body: text(12000), conclusion: text(6000),
  senderName: text(300), senderAddress: text(1000), senderEmail: text(254), senderPhone: text(80), sendertitle: text(300),
}).strict();

export const coverLetterDesignSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).default("#173F35"),
  font: z.enum(["sans", "serif", "mono"]).default("sans"),
  fontSize: z.number().min(11).max(16).default(13), lineHeight: z.number().min(1.2).max(2).default(1.6),
  padding: z.number().min(32).max(80).default(60), alignment: z.enum(["left", "center", "right"]).default("left"),
  headerStyle: z.enum(["classic", "accent", "minimal"]).default("accent"),
  fieldStyles: z.record(z.object({ bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(), align: z.enum(["left", "center", "right"]).optional() }).strict()).default({}),
}).strict();

export const coverLetterPatchSchema = coverLetterContentSchema.partial().extend({
  design: coverLetterDesignSchema.optional(), revision: z.number().int().nonnegative().optional(),
}).strict();

export type CoverLetterDocument = z.infer<typeof coverLetterContentSchema> & { design: z.infer<typeof coverLetterDesignSchema> };
export type CoverLetterDesign = CoverLetterDocument["design"];

export function normalizeCoverLetter(value: Record<string, unknown>): CoverLetterDocument {
  const content = Object.fromEntries(Object.keys(coverLetterContentSchema.shape).map(key => [key, value[key] ?? undefined]));
  return { ...coverLetterContentSchema.parse(content), design: coverLetterDesignSchema.parse(value.design ?? {}) };
}

export const coverLetterFonts = {
  sans: "Arial, Helvetica, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "'Courier New', monospace",
};

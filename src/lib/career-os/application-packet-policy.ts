/** Pure application-packet policy: testable without Prisma, Next or LLMs. */
import { createHash } from "node:crypto";
import { CareerContractError } from "./contracts.ts";

export type PacketStatus = "DRAFT" | "READY" | "CANCELED";
export type PacketLanguage = "fr" | "en";

export function normalizedHeading(value: string, max = 110): string {
  return value.replace(/[\r\n\t\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Conservative baseline: no claims about candidate skills, experience or attachments already sent. */
export function draftApplicationEmail(input: { company: string | null; title: string; name: string | null; language: PacketLanguage }) {
  const position = normalizedHeading(input.title, 110) || (input.language === "fr" ? "poste proposé" : "advertised role");
  const company = normalizedHeading(input.company || "", 110);
  const name = normalizedHeading(input.name || "", 100);
  if (input.language === "fr") return {
    subject: normalizedHeading(`Candidature — ${position}${company ? ` — ${company}` : ""}`, 300),
    body: `Bonjour,\n\nJe souhaite vous présenter ma candidature pour le poste de ${position}${company ? ` au sein de ${company}` : ""}.\n\nJe vous remercie de l'attention portée à ma candidature et reste à votre disposition pour tout complément d'information.\n\nCordialement,${name ? `\n${name}` : ""}`,
  };
  return {
    subject: normalizedHeading(`Application — ${position}${company ? ` — ${company}` : ""}`, 300),
    body: `Dear Hiring Team,\n\nI would like to apply for the ${position} position${company ? ` at ${company}` : ""}.\n\nThank you for considering my application. I would welcome the opportunity to provide further information.\n\nKind regards,${name ? `\n${name}` : ""}`,
  };
}

export function intentHash(input: { jobId: string; cvId: string; coverLetterId?: string | null; missionId?: string | null; language: PacketLanguage }): string {
  return createHash("sha256").update(JSON.stringify([input.jobId, input.cvId, input.coverLetterId || null, input.missionId || null, input.language])).digest("hex");
}

export function assertEditable(status: PacketStatus, revision: number, expectedRevision: number): void {
  if (status !== "DRAFT") throw new CareerContractError(409, "PACKET_NOT_EDITABLE");
  if (revision !== expectedRevision) throw new CareerContractError(409, "PACKET_CHANGED");
}

export function assertSourcesCurrent(saved: { cvRevision: number; letterRevision: number | null; jobUpdatedAt: Date }, current: { cvRevision: number; letterRevision: number | null; jobUpdatedAt: Date }): void {
  if (saved.cvRevision !== current.cvRevision || saved.letterRevision !== current.letterRevision || saved.jobUpdatedAt.getTime() !== current.jobUpdatedAt.getTime()) {
    throw new CareerContractError(409, "PACKET_SOURCE_CHANGED");
  }
}

export function decidePacket(status: PacketStatus, revision: number, expected: number, action: "approve" | "cancel", reviewed: boolean): PacketStatus {
  assertEditable(status, revision, expected);
  if (action === "approve" && !reviewed) throw new CareerContractError(400, "EXPLICIT_REVIEW_REQUIRED");
  return action === "approve" ? "READY" : "CANCELED";
}

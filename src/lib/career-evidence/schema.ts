import { z } from "zod";
import { EVIDENCE_KINDS, EVIDENCE_STATUSES } from "./contracts";

export const newEvidenceSchema = z.object({
  apiVersion: z.literal("v1"),
  kind: z.enum(EVIDENCE_KINDS),
  statement: z.string().trim().min(2).max(1600),
  sourceLabel: z.string().trim().max(200).nullable().optional(),
}).strict();

export const evidenceEditSchema = z.object({
  apiVersion: z.literal("v1"),
  revision: z.number().int().min(0),
  statement: z.string().trim().min(2).max(1600),
  kind: z.enum(EVIDENCE_KINDS),
  sourceLabel: z.string().trim().max(200).nullable().optional(),
}).strict();

export const evidenceTransitionSchema = z.object({
  apiVersion: z.literal("v1"),
  revision: z.number().int().min(0),
  action: z.enum(["confirm", "reject", "revoke"]),
}).strict();

export const evidenceDeleteSchema = z.object({
  apiVersion: z.literal("v1"),
  revision: z.number().int().min(0),
}).strict();

export const evidenceQuerySchema = z.object({
  apiVersion: z.literal("v1"),
  status: z.enum(EVIDENCE_STATUSES).optional(),
  kind: z.enum(EVIDENCE_KINDS).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
}).strict();

export const evidenceImportSchema = z.object({ apiVersion: z.literal("v1") }).strict();

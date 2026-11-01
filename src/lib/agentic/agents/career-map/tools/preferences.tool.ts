import { z } from "zod";
export const preferenceSchema = z.object({
  targetRoles: z.array(z.string().trim().max(100)).max(5).default([]),
  interests: z.array(z.string().trim().max(80)).max(8).default([]),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "ANY"]).default("ANY"),
  goal: z.enum(["EXPLORATION", "ADVANCEMENT", "CHANGE"]).default("EXPLORATION"),
  balance: z.enum(["CHILL", "BALANCED", "HUSTLE"]).default("BALANCED"),
  identity: z.enum(["SPECIALIST", "GENERALIST", "FOUNDER"]).default("SPECIALIST"),
  income: z.enum(["HIGH", "COMFORTABLE", "UNIMPORTANT"]).default("COMFORTABLE"),
  qualities: z.array(z.enum(["LEADERSHIP", "KNOWLEDGE", "CREATIVITY", "PEOPLE", "IMPACT"])).max(5).default([]),
  positions: z.number().int().min(4).max(12).default(9),
});
export type CareerMapPreferences = z.infer<typeof preferenceSchema>;

import "dotenv/config";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ProfileError } from "./career-profile/http";

export const gemini = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_MODEL_API_KEY });

// All features reuse this provider and model selection.
export function getCareerModel() {
  if (!process.env.GOOGLE_GENERATIVE_MODEL_API_KEY) throw new ProfileError(503, "AI_UNAVAILABLE");
  return gemini(process.env.GEMINI_MODEL || "gemini-3.5-flash");
}

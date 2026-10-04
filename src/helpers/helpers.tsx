import type { careerProfileContext } from "@/lib/career-profile/service";
import { factualRules } from "@/lib/career-profile/ai";

type PromptInput = { description: string; user: ReturnType<typeof careerProfileContext>; curentLanguage: string };
export const generateCvSystemPrompt = () => factualRules + "\nWrite a concise professional resume using the required schema. Use job keywords only when supported by the confirmed profile. Empty sections are valid. Never use previous assistant messages as factual evidence.";
export const generateCvPrompt = ({ description, user, curentLanguage }: PromptInput) =>
  JSON.stringify({ task: "Write a concise resume. Select relevant confirmed facts and rephrase clearly. Preserve dates, qualifications and language levels as provided. Do not fill gaps.", language: curentLanguage, jobDescription: description, confirmedCareerProfile: user });
export const generateCoverLetterSystemPrompt = () => factualRules + "\nWrite a concise professional cover letter using the required schema. Never use previous assistant messages as factual evidence. Use a generic greeting if no recipient is provided.";
export const generateCoverLetterPrompt = ({ description, user, curentLanguage }: PromptInput) =>
  JSON.stringify({ task: "Write a cover letter under 400 words using only confirmed candidate facts. Company and job details may come from the job description. Leave unknown contact details empty.", language: curentLanguage, jobDescription: description, confirmedCareerProfile: user, currentDate: new Date().toISOString().slice(0, 10) });
export const generatedLanguagePrompt = (language: string) => language === "fr" ? "French" : "English";

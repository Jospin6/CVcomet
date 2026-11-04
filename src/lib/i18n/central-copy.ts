import { createAppI18n, type AppLanguage } from "@/lib/i18n/i18n";
import en from "../../../public/locales/en/common.json";

type CentralDomains = Pick<typeof en, "applications" | "jobMatch" | "resumeEditor" | "ats" | "findJobs" | "jobsForYou" | "applicationIntake" | "home" | "careerCommandCenter" | "aiSettings">;
const resources = {en: createAppI18n("en"), fr: createAppI18n("fr")};

/** The same i18next resources as the app's LanguageProvider; no parallel copy tables.
 * Explicit-language access is needed by PDF rendering and other non-hook call sites. */
export function getCentralCopy<K extends keyof CentralDomains>(domain: K): Record<AppLanguage, CentralDomains[K]> {
  return {
    en: resources.en.getResource("en", "common", domain) as CentralDomains[K],
    fr: resources.fr.getResource("fr", "common", domain) as CentralDomains[K],
  };
}

/** Translate interpolated values from the same central i18next catalog. */
export function translateCentral(language: AppLanguage, key: string, values?: Record<string, string | number>): string {
  return String(resources[language].t(key, values));
}

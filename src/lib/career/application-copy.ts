import { getCentralCopy, translateCentral } from "@/lib/i18n/central-copy";
import type { AppLanguage } from "@/lib/i18n/i18n";

/** UI-only copy for the Applications workspace. Saved notes, job descriptions and emails are never translated. */
const base = getCentralCopy("applications");
export const applicationCopy = {
  en: {
    ...base.en,
    applicationsCount: (count: number) => translateCentral("en", "applications.applicationsCount", { count }),
    page: (page: number) => translateCentral("en", "applications.page", { page }),
  },
  fr: {
    ...base.fr,
    applicationsCount: (count: number) => translateCentral("fr", "applications.applicationsCount", { count }),
    page: (page: number) => translateCentral("fr", "applications.page", { page }),
  },
};

export function applicationLocale(language: AppLanguage) {
  return language === "fr" ? "fr-FR" : "en-US";
}

/** Translate only known API error codes. Never print untrusted backend exception text in the UI. */
export function applicationErrorLabel(code: string | undefined, language: AppLanguage, fallback: string): string {
  const c = applicationCopy[language];
  switch (code) {
    case "NOT_FOUND": case "APPLICATION_NOT_FOUND": return c.applicationNotFound;
    case "DUPLICATE_APPLICATION": return c.duplicateApplication;
    default: return fallback;
  }
}

/** Display names only; do not change persisted interview status codes. */
export function applicationInterviewStatusLabel(status: string, language: AppLanguage) {
  const c = applicationCopy[language];
  switch (status) {
    case "ACTIVE": case "IN_PROGRESS": return c.interviewActive;
    case "COMPLETED": case "DONE": return c.interviewCompleted;
    case "SCHEDULED": return c.interviewScheduled;
    case "CANCELED": case "CANCELLED": return c.interviewCanceled;
    default: return status;
  }
}

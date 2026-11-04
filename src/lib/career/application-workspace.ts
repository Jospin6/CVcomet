import type { AppLanguage } from "@/lib/i18n/i18n";
import { translateCentral } from "@/lib/i18n/central-copy";

/** Shared presentation helpers; no permissions or trusted status changes live here. */
export const applicationStatuses = ["SAVED", "APPLIED", "INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
export type ApplicationStatusKey = typeof applicationStatuses[number];
/** Application status codes remain stable in the database; their display names come from i18next. */
export function applicationStatusLabel(status: string, language: AppLanguage = "fr") {
  if (applicationStatuses.includes(status as ApplicationStatusKey)) {
    return translateCentral(language, `applications.statuses.${status}`);
  }
  return translateCentral(language, "applications.unknownStatus");
}
export function applicationStatusTone(status: string) {
  if (status === "HIRED" || status === "OFFER") return "bg-primary/10 text-primary";
  if (status === "REJECTED" || status === "WITHDRAWN") return "bg-muted text-muted-foreground";
  return "bg-secondary text-foreground";
}
export const applicationStages = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "HIRED"] as const;
export function applicationStageIndex(status: string) {
  return status === "TECHNICAL_INTERVIEW" ? 2 : applicationStages.findIndex(value => value === status);
}

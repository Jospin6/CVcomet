/** Shared presentation helpers; no permissions or trusted status changes live here. */
export const applicationStatuses = ["SAVED", "APPLIED", "INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
export type ApplicationStatusKey = typeof applicationStatuses[number];
const names: Record<ApplicationStatusKey, string> = {
  SAVED: "Enregistrée", APPLIED: "Envoyée", INTERVIEW: "Entretien", TECHNICAL_INTERVIEW: "Entretien technique", OFFER: "Offre reçue", HIRED: "Acceptée", REJECTED: "Non retenue", WITHDRAWN: "Retirée",
};
export function applicationStatusLabel(status: string) {
  return Object.prototype.hasOwnProperty.call(names, status) ? names[status as ApplicationStatusKey] : "Statut inconnu";
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

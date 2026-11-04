"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, ChevronDown } from "lucide-react";

/** Public allowlisted event metadata; never render raw tool inputs or prompt text. */
export type MissionProgressEvent = Readonly<{
  id?: string; kind: string; step?: string; code?: string; at?: string;
}>;
const labels: Record<string, [string, string]> = {
  "supervisor.context": ["Lecture du contexte", "Reading context"],
  "supervisor.route": ["Choix de l'agent", "Choosing agent"],
  "supervisor.respond": ["Rédaction de la réponse", "Drafting response"],
  "supervisor.verify": ["Vérification", "Verification"],
  "supervisor.assemble": ["Finalisation", "Finalizing"],
  "get_my_profile": ["Consultation du profil", "Reading profile"],
  "list_my_resumes": ["Consultation des CV", "Reading resumes"],
  "get_my_resume": ["Consultation du CV", "Reading resume"],
  "get_my_application": ["Consultation d'une candidature", "Reading application"],
  "list_my_applications": ["Consultation des candidatures", "Reading applications"],
  "get_my_job_match_insights": ["Consultation d'une analyse", "Reading match analysis"],
  "list_my_application_packets": ["Consultation des dossiers", "Reading application packets"],
};
function describe(event: MissionProgressEvent, french: boolean) {
  const phrase = labels[event.step ?? ""];
  if (event.kind === "mission.started") return translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text001");
  if (event.kind === "approval.required") return translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text002");
  if (event.kind === "mission.completed") return translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text003");
  if (event.kind === "mission.failed") return translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text004");
  if (event.kind === "tool.failed" || event.kind === "step.failed") return translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text005");
  const fallback = translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text006");
  return (phrase ? phrase[french ? 0 : 1] : fallback) +
    (event.kind.endsWith(".completed") ? (translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text007")) : "");
}
export default function CareerMissionProgress({ events, active, french, onRefresh, warning }: {
  events: readonly MissionProgressEvent[]; active: boolean; french: boolean;
  onRefresh?: () => void; warning?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = events.at(-1);
  const finished = latest?.kind === "mission.completed";
  const failed = latest?.kind === "mission.failed";
  if (!active && events.length === 0 && !warning) return null;
  const status = failed ? (translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text008")) : finished ?
    (translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text009")) : active ?
      (translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text010")) : (translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text011"));
  return (
    <div className="mb-5 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground"
      aria-live="polite" role="status">
      <div className="flex items-center gap-2">
        {failed ? <CircleAlert className="size-4" aria-hidden="true" /> : finished ?
          <CheckCircle2 className="size-4" aria-hidden="true" /> : active ?
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {latest ? describe(latest, french) : (translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text012"))}
        </span>
        <span>{status}</span>
        {events.length > 1 && (
          <button type="button" onClick={() => setExpanded(v => !v)}
            aria-label={translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text013")} aria-expanded={expanded}
            className="rounded-md p-1 hover:bg-muted">
            <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {warning && <div className="mt-2 flex items-center justify-between gap-2">
        <span>{translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text014")}</span>
        {onRefresh && <button type="button" onClick={onRefresh} className="shrink-0 underline">
          {translateCentral(french ? "fr" : "en", "uiText.components_career_CareerMissionProgress.text015")}</button>}
      </div>}
      {expanded && <ol className="mt-3 space-y-2 border-t border-border/60 pt-3">
        {events.slice(-12).map((event, index) => (
          <li key={`${event.id ?? index}-${event.kind}`} className="flex items-start gap-2">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden="true" />
            <span>{describe(event, french)}</span>
          </li>
        ))}
      </ol>}
    </div>
  );
}

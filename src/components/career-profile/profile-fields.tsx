"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { careerGoals, experienceLevels, workModes, type ProfileData } from "@/lib/career-profile/schema";

export function ProfileField({ name, value, onChange, multiline = false, options, required = false, type = "text" }: {
  name: string; value: string; onChange: (_value: string) => void; multiline?: boolean; options?: readonly string[]; required?: boolean; type?: string;
}) {
  const { t } = useTranslation();
  const key = name.split("-").at(-1)!;
  const label = t("career.fields." + key);
  return <div className={multiline ? "space-y-2 sm:col-span-2" : "space-y-2"}>
    <label htmlFor={name} className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}{required && " *"}</label>
    {options ? <select id={name} value={value} onChange={e => onChange(e.target.value)} required={required} className="h-12 w-full min-w-0 rounded-xl border border-input/80 bg-background px-4 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10">
      <option value="">{t("career.choose")}</option>{options.map(option => <option key={option} value={option}>{t("career.options." + option)}</option>)}
    </select> : multiline
      ? <Textarea id={name} value={value} onChange={e => onChange(e.target.value)} rows={5} maxLength={8000} className="min-h-32 rounded-xl border-input/80 bg-background px-4 py-3 leading-6 shadow-sm focus-visible:ring-primary/15" required={required} />
      : <Input id={name} value={value} onChange={e => onChange(e.target.value)} type={type} required={required} maxLength={type === "url" ? 2048 : 500} className="h-12 rounded-xl border-input/80 bg-background px-4 shadow-sm focus-visible:ring-primary/15" />}
  </div>;
}

export function TargetFields({ profile, set, part = "all" }: { profile: ProfileData; set: <K extends keyof ProfileData>(_key: K, _value: ProfileData[K]) => void; part?: "all" | "goal" | "level" | "job" }) {
  return <div className="grid gap-5 sm:grid-cols-2">
    {(part === "all" || part === "goal") && <ProfileField name="careerGoal" value={profile.careerGoal} onChange={v => set("careerGoal", v as ProfileData["careerGoal"])} options={careerGoals} required />}
    {(part === "all" || part === "level") && <ProfileField name="experienceLevel" value={profile.experienceLevel} onChange={v => set("experienceLevel", v as ProfileData["experienceLevel"])} options={experienceLevels} required />}
    {(part === "all" || part === "job") && <>
      {(["targetJobTitle", "targetIndustry", "targetCountry"] as const).map(key => <ProfileField key={key} name={key} value={profile[key]} onChange={v => set(key, v)} required />)}
      <ProfileField name="preferredWorkMode" value={profile.preferredWorkMode} onChange={v => set("preferredWorkMode", v as ProfileData["preferredWorkMode"])} options={workModes} required />
    </>}
  </div>;
}

export function ImproveButton({ field, value, onAccept, experienceId }: { field: "headline" | "summary" | "experience"; value: string; onAccept: (_value: string) => void; experienceId?: string }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{ original: string; suggestion: string } | null>(null);
  const [error, setError] = useState("");
  const improve = async () => {
    setBusy(true); setError("");
    const original = value;
    try {
      const response = await fetch("/api/career-profile/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, text: original, experienceId, language: i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "UNAVAILABLE");
      setProposal({ original, suggestion: data.suggestion });
    } catch (error) { setError(t("career.errors." + (error instanceof Error ? error.message : "UNAVAILABLE"), { defaultValue: t("career.errors.UNAVAILABLE") })); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <Button type="button" variant="outline" size="sm" disabled={busy || !value.trim()} onClick={improve}><Sparkles className="size-4" />{t(busy ? "career.improving" : "career.improve")}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(proposal)} onOpenChange={open => { if (!open) setProposal(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("career.aiTitle")}</DialogTitle><DialogDescription>{t("career.aiReview")}</DialogDescription></DialogHeader>
        <p className="text-sm font-medium">{t("career.original")}</p><p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{proposal?.original}</p>
        <label htmlFor={"suggestion-" + field} className="text-sm font-medium">{t("career.suggestion")}</label>
        <Textarea id={"suggestion-" + field} rows={6} value={proposal?.suggestion || ""} onChange={e => setProposal(p => p && { ...p, suggestion: e.target.value })} />
        {proposal && proposal.original !== value && <p role="alert" className="text-sm text-destructive">{t("career.changedSource")}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setProposal(null)}>{t("career.reject")}</Button>
          <Button disabled={!proposal?.suggestion.trim() || proposal.original !== value} onClick={() => { if (proposal) onAccept(proposal.suggestion); setProposal(null); }}>{t("career.accept")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

const collectionFields = {
  experiences: ["title", "company", "location", "start", "end", "description"],
  education: ["degree", "school", "start", "end", "description"],
  projects: ["title", "url", "start", "end", "description"],
  certifications: ["name", "organization", "date", "description"],
  awards: ["title", "organization", "date", "description"],
  professionalLinks: ["label", "url"],
} as const;
type CollectionKey = keyof typeof collectionFields;

function CollectionFields({ name, profile, update }: { name: CollectionKey; profile: ProfileData; update: (_profile: ProfileData) => void }) {
  const { t } = useTranslation();
  const fields = collectionFields[name];
  const items = profile[name] as { id?: string; [key: string]: string | undefined }[];
  const setItems = (values: typeof items) => update({ ...profile, [name]: values });
  return <section id={"section-" + name} className="app-section space-y-5 rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
    <h2 className="type-h2 tracking-[-0.02em]">{t("career.sections." + name)}</h2>
    {items.length === 0 && <p className="text-sm text-muted-foreground">{t("career.emptySection")}</p>}
    {items.map((item, index) => <fieldset key={item.id || index} className="space-y-5 rounded-2xl border border-border/70 bg-muted/[0.18] p-5 sm:p-6">
      <legend className="max-w-full break-words px-2 text-sm font-medium">{t("career.sections." + name)} {index + 1}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(key => <ProfileField key={key} name={name + "-" + index + "-" + key} value={item[key] || ""} multiline={key === "description"} type={key === "url" ? "url" : "text"} onChange={value => setItems(items.map((x, i) => i === index ? { ...x, [key]: value } : x))} required={key === fields[0]} />)}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {name === "experiences" && <ImproveButton field="experience" value={item.description || ""} experienceId={item.id} onAccept={description => setItems(items.map((x, i) => i === index ? { ...x, description } : x))} />}
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label={t("career.removeItem", { section: t("career.sections." + name), index: index + 1 })}><Trash2 className="size-4" />{t("career.remove")}</Button>
      </div>
    </fieldset>)}
    <Button type="button" variant="outline" disabled={items.length >= (name === "professionalLinks" ? 30 : 50)} onClick={() => setItems([...items, Object.fromEntries(fields.map(key => [key, ""]))])}><Plus className="size-4" />{t("career.add")}</Button>
  </section>;
}

export function ProfileFields({ profile, update, includeTarget = true }: { profile: ProfileData; update: (_value: ProfileData) => void; includeTarget?: boolean }) {
  const { t } = useTranslation();
  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => update({ ...profile, [key]: value });
  return <div className="space-y-6">
    {includeTarget && <section id="section-target" className="app-section space-y-5 rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"><h2 className="type-h2 tracking-[-0.02em]">{t("career.sections.target")}</h2><TargetFields profile={profile} set={set} /></section>}
    <section id="section-personal" className="app-section space-y-5 rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="type-h2 tracking-[-0.02em]">{t("career.sections.personal")}</h2>
      <div className="grid gap-5 sm:grid-cols-2">{(["name", "email", "phone", "address"] as const).map(key => <ProfileField key={key} name={key} value={profile[key]} type={key === "email" ? "email" : "text"} onChange={v => set(key, v)} required={key === "email"} />)}</div>
    </section>
    {(["headline", "summary"] as const).map(key => <section key={key} id={"section-" + key} className="app-section space-y-4">
      <h2 className="type-h2 tracking-[-0.02em]">{t("career.sections." + key)}</h2>
      <ProfileField name={key} value={profile[key]} onChange={v => set(key, v)} multiline={key === "summary"} />
      <ImproveButton field={key} value={profile[key]} onAccept={v => set(key, v)} />
    </section>)}
    <CollectionFields name="experiences" profile={profile} update={update} />
    <CollectionFields name="education" profile={profile} update={update} />
    <section id="section-skills" className="app-section space-y-4"><h2 className="type-h2 tracking-[-0.02em]">{t("career.sections.skills")}</h2><ProfileField name="skills" value={profile.skills} onChange={v => set("skills", v)} multiline /><p className="text-sm text-muted-foreground">{t("career.skillsHint")}</p></section>
    <CollectionFields name="projects" profile={profile} update={update} />
    <CollectionFields name="certifications" profile={profile} update={update} />
    <section id="section-languages" className="app-section space-y-4"><h2 className="type-h2 tracking-[-0.02em]">{t("career.sections.languages")}</h2><ProfileField name="languages" value={profile.languages} onChange={v => set("languages", v)} multiline /><p className="text-sm text-muted-foreground">{t("career.languagesHint")}</p></section>
    <CollectionFields name="awards" profile={profile} update={update} />
    <section className="app-section space-y-5 rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"><h2 className="type-h2 tracking-[-0.02em]">{t("career.standardLinks")}</h2><div className="grid gap-5 sm:grid-cols-2">{(["linkedin", "github", "portfolio"] as const).map(key => <ProfileField key={key} name={key} type="url" value={profile[key]} onChange={v => set(key, v)} />)}</div></section>
    <CollectionFields name="professionalLinks" profile={profile} update={update} />
    <section className="app-section space-y-4"><h2 className="type-h2 tracking-[-0.02em]">{t("career.fields.hobbies")}</h2><ProfileField name="hobbies" value={profile.hobbies} onChange={v => set("hobbies", v)} multiline /></section>
  </div>;
}

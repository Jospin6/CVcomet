"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CareerDirectionFields, CountryPicker, IndustrySelect } from "./career-direction-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  careerGoals,
  experienceLevels,
  workModes,
  type ProfileData,
} from "@/lib/career-profile/schema";

export type ProfileTab =
  | "overview"
  | "experience"
  | "education"
  | "skills"
  | "links";

function AutoTextarea({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<"textarea">, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 420)}px`;
    element.style.overflowY = element.scrollHeight > 420 ? "auto" : "hidden";
  }, [value]);

  return (
    <Textarea
      {...props}
      ref={ref}
      rows={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-[54px] resize-none rounded-md bg-background px-3 py-2 text-sm leading-5"
    />
  );
}

export function ProfileField({
  name,
  value,
  onChange,
  multiline = false,
  options,
  required = false,
  type = "text",
  readOnly = false,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  options?: readonly string[];
  required?: boolean;
  type?: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const key = name.split("-").at(-1)!;

  return (
    <div className={multiline ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <label htmlFor={name} className="block text-xs font-medium">
        {t("career.fields." + key)}{required && " *"}
      </label>

      {options ? (
        <select
          id={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t("career.choose")}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {t("career.options." + option)}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <AutoTextarea
          id={name}
          value={value}
          onChange={onChange}
          maxLength={8000}
          required={required}
        />
      ) : (
        <Input
          id={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          type={type}
          required={required}
          maxLength={type === "url" ? 2048 : 500}
          className="h-9 rounded-md bg-background text-sm"
        />
      )}
    </div>
  );
}

export function TargetFields({
  profile,
  set,
  part = "all",
}: {
  profile: ProfileData;
  set: <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => void;
  part?: "all" | "goal" | "level" | "job";
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(part === "all" || part === "goal") && (
        <ProfileField
          name="careerGoal"
          value={profile.careerGoal}
          onChange={(value) => set("careerGoal", value as ProfileData["careerGoal"])}
          options={careerGoals}
          required
        />
      )}
      {(part === "all" || part === "level") && (
        <ProfileField
          name="experienceLevel"
          value={profile.experienceLevel}
          onChange={(value) => set("experienceLevel", value as ProfileData["experienceLevel"])}
          options={experienceLevels}
          required
        />
      )}
      {(part === "all" || part === "job") && (
        <>
          <ProfileField
            name="targetJobTitle"
            value={profile.targetJobTitle}
            onChange={(value) => set("targetJobTitle", value)}
            required
          />
          <IndustrySelect
            value={profile.targetIndustry}
            onChange={(value) => set("targetIndustry", value)}
            required
          />
          <CountryPicker
            id="onboarding-target-country"
            value={profile.targetCountry}
            onChange={(value) => set("targetCountry", value)}
            mode="name"
            required
          />
          <ProfileField
            name="preferredWorkMode"
            value={profile.preferredWorkMode}
            onChange={(value) => set(
              "preferredWorkMode", value as ProfileData["preferredWorkMode"],
            )}
            options={workModes}
            required
          />
        </>
      )}
    </div>
  );
}

export function ImproveButton({
  field,
  value,
  onAccept,
  experienceId,
}: {
  field: "headline" | "summary" | "experience";
  value: string;
  onAccept: (value: string) => void;
  experienceId?: string;
}) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{
    original: string;
    suggestion: string;
  } | null>(null);
  const [error, setError] = useState("");

  const improve = async () => {
    setBusy(true);
    setError("");
    const original = value;
    try {
      const response = await fetch("/api/career-profile/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          text: original,
          experienceId,
          language: i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "UNAVAILABLE");
      setProposal({ original, suggestion: data.suggestion });
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "UNAVAILABLE";
      setError(t("career.errors." + code, {
        defaultValue: t("career.errors.UNAVAILABLE"),
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !value.trim()}
        onClick={improve}
      >
        <Sparkles className="size-4" />
        {t(busy ? "career.improving" : "career.improve")}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <Dialog open={Boolean(proposal)} onOpenChange={(open) => {
        if (!open) setProposal(null);
      }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("career.aiTitle")}</DialogTitle>
            <DialogDescription>{t("career.aiReview")}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{t("career.original")}</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {proposal?.original}
          </p>
          <label htmlFor={`suggestion-${field}`} className="text-sm font-medium">
            {t("career.suggestion")}
          </label>
          <Textarea
            id={`suggestion-${field}`}
            rows={4}
            value={proposal?.suggestion || ""}
            onChange={(event) => setProposal((current) => current && ({
              ...current,
              suggestion: event.target.value,
            }))}
          />
          {proposal && proposal.original !== value && (
            <p role="alert" className="text-sm text-destructive">
              {t("career.changedSource")}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setProposal(null)}>
              {t("career.reject")}
            </Button>
            <Button
              disabled={!proposal?.suggestion.trim() || proposal.original !== value}
              onClick={() => {
                if (proposal) onAccept(proposal.suggestion);
                setProposal(null);
              }}
            >
              {t("career.accept")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
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

function CollectionFields({
  name,
  profile,
  update,
}: {
  name: CollectionKey;
  profile: ProfileData;
  update: (profile: ProfileData) => void;
}) {
  const { t } = useTranslation();
  const fields = collectionFields[name];
  const items = profile[name] as {
    id?: string;
    [key: string]: string | undefined;
  }[];
  const setItems = (values: typeof items) => update({
    ...profile,
    [name]: values,
  });

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{t("career.sections." + name)}</h2>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("career.emptySection")}</p>
      )}
      {items.map((item, index) => (
        <fieldset
          key={item.id || index}
          className="space-y-4 rounded-lg border bg-muted/10 p-4"
        >
          <legend className="px-2 text-xs font-medium text-muted-foreground">
            {t("career.sections." + name)} {index + 1}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((key) => (
              <ProfileField
                key={key}
                name={`${name}-${index}-${key}`}
                value={item[key] || ""}
                multiline={key === "description"}
                type={key === "url" ? "url" : "text"}
                onChange={(value) => setItems(items.map((entry, i) =>
                  i === index ? { ...entry, [key]: value } : entry,
                ))}
                required={key === fields[0]}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            {name === "experiences" && (
              <ImproveButton
                field="experience"
                value={item.description || ""}
                experienceId={item.id}
                onAccept={(description) => setItems(items.map((entry, i) =>
                  i === index ? { ...entry, description } : entry,
                ))}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
              aria-label={t("career.removeItem", {
                section: t("career.sections." + name),
                index: index + 1,
              })}
            >
              <Trash2 className="size-4" />
              {t("career.remove")}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={items.length >= (name === "professionalLinks" ? 30 : 50)}
        onClick={() => setItems([
          ...items,
          Object.fromEntries(fields.map((key) => [key, ""])),
        ])}
      >
        <Plus className="size-4" />
        {t("career.add")}
      </Button>
    </section>
  );
}

export function ProfileFields({
  profile,
  update,
  includeTarget = true,
  activeTab,
}: {
  profile: ProfileData;
  update: (value: ProfileData) => void;
  includeTarget?: boolean;
  activeTab?: ProfileTab;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) =>
    update({ ...profile, [key]: value });
  const show = (tab: ProfileTab) => !activeTab || activeTab === tab;

  return (
    <div className="space-y-6">
      {show("overview") && (
        <>
          <section className="space-y-4">
            <h2 className="text-base font-semibold">
              {t("career.sections.personal")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["name", "email", "phone", "address"] as const).map((key) => (
                <ProfileField
                  key={key}
                  name={key}
                  value={profile[key]}
                  type={key === "email" ? "email" : "text"}
                  readOnly={key === "email"}
                  onChange={(value) => set(key, value)}
                  required={key === "email"}
                />
              ))}
            </div>
          </section>
          <section className="space-y-4 border-t pt-5">
            <h2 className="text-base font-semibold">
              {t("career.sections.headline")}
            </h2>
            <ProfileField
              name="headline"
              value={profile.headline}
              onChange={(value) => set("headline", value)}
            />
            <ImproveButton
              field="headline"
              value={profile.headline}
              onAccept={(value) => set("headline", value)}
            />
            <ProfileField
              name="summary"
              value={profile.summary}
              onChange={(value) => set("summary", value)}
              multiline
            />
            <ImproveButton
              field="summary"
              value={profile.summary}
              onAccept={(value) => set("summary", value)}
            />
          </section>
          {includeTarget && (
            <section className="space-y-4 border-t pt-5">
              <h2 className="text-base font-semibold">
                {t("career.sections.target")}
              </h2>
              <CareerDirectionFields profile={profile} onChange={update} />
            </section>
          )}
        </>
      )}
      {show("experience") && (
        <>
          <CollectionFields name="experiences" profile={profile} update={update} />
          <div className="border-t pt-5">
            <CollectionFields name="projects" profile={profile} update={update} />
          </div>
        </>
      )}
      {show("education") && (
        <>
          <CollectionFields name="education" profile={profile} update={update} />
          <div className="border-t pt-5">
            <CollectionFields name="certifications" profile={profile} update={update} />
          </div>
          <div className="border-t pt-5">
            <CollectionFields name="awards" profile={profile} update={update} />
          </div>
        </>
      )}
      {show("skills") && (
        <div className="space-y-5">
          <ProfileField
            name="skills" value={profile.skills}
            onChange={(value) => set("skills", value)} multiline
          />
          <ProfileField
            name="languages" value={profile.languages}
            onChange={(value) => set("languages", value)} multiline
          />
          <ProfileField
            name="hobbies" value={profile.hobbies}
            onChange={(value) => set("hobbies", value)} multiline
          />
        </div>
      )}
      {show("links") && (
        <>
          <section className="space-y-4">
            <h2 className="text-base font-semibold">{t("career.standardLinks")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["linkedin", "github", "portfolio"] as const).map((key) => (
                <ProfileField
                  key={key} name={key} type="url" value={profile[key]}
                  onChange={(value) => set(key, value)}
                />
              ))}
            </div>
          </section>
          <div className="border-t pt-5">
            <CollectionFields
              name="professionalLinks" profile={profile} update={update}
            />
          </div>
        </>
      )}
    </div>
  );
}

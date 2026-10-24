"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleHelp, Download, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EVIDENCE_KINDS, EVIDENCE_STATUSES, type EvidenceKind, type EvidenceStatus } from "@/lib/career-evidence/contracts";

type Item = {
  id: string; kind: EvidenceKind; statement: string; source: string; sourceLabel: string | null;
  status: EvidenceStatus; revision: number; updatedAt: string; confirmedAt: string | null;
};
type Envelope<T> = { data?: T; error?: { code?: string } };
const root = "/api/career/v1/evidence";

async function request<T>(url: string, method = "GET", body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method, cache: "no-store", credentials: "same-origin",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiVersion: "v1", ...body }) } : {}),
  });
  const payload = (await res.json()) as Envelope<T>;
  if (!res.ok || !payload.data) throw new Error(payload.error?.code || `HTTP_${res.status}`);
  return payload.data;
}

export function EvidenceVaultPage() {
  const { t } = useTranslation();
  const l = (name: string) => t(`evidence.${name}`);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<EvidenceStatus | "ALL">("ALL");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [kind, setKind] = useState<EvidenceKind>("SKILL");
  const [statement, setStatement] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editKind, setEditKind] = useState<EvidenceKind>("SKILL");
  const [editSource, setEditSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ apiVersion: "v1", limit: "25" });
    if (status !== "ALL") params.set("status", status);
    if (cursor) params.set("cursor", cursor);
    const data = await request<{ items: Item[]; nextCursor: string | null }>(`${root}?${params}`);
    setItems(current => cursor ? [...current, ...data.items] : data.items);
    setNextCursor(data.nextCursor);
  }, [status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItems([]);
    const params = new URLSearchParams({ apiVersion: "v1", limit: "25" });
    if (status !== "ALL") params.set("status", status);
    void request<{ items: Item[]; nextCursor: string | null }>(`${root}?${params}`)
      .then(data => { if (active) { setItems(data.items); setNextCursor(data.nextCursor); setError(""); } })
      .catch(err => { if (active) setError(String(err instanceof Error ? err.message : err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);

  async function perform(action: () => Promise<unknown>, feedback: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); await load(); setNotice(feedback); setEditing(null); }
    catch (err) { setError(String(err instanceof Error ? err.message : err)); }
    finally { setBusy(false); }
  }

  const startEdit = (item: Item) => {
    setEditing(item.id); setDraft(item.statement);
    setEditKind(item.kind); setEditSource(item.sourceLabel || "");
  };
  const disabled = busy || loading;
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <PageHeader eyebrow="CVComet Career OS" title={l("title")} description={l("intro")} />
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>{l("privacy")}</p>
      </div>

      <section className="app-section space-y-4" aria-labelledby="new-fact-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="new-fact-title" className="text-lg font-semibold">{l("addTitle")}</h2>
          <Button type="button" variant="outline" disabled={disabled}
            onClick={() => void perform(() => request(`${root}/import-profile`, "POST", {}), l("importDone"))}>
            <Download className="mr-2 size-4" />{l("importButton")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{l("importHelp")}</p>
        <form className="grid gap-3 md:grid-cols-[200px_1fr]" onSubmit={event => {
          event.preventDefault();
          void perform(async () => { await request(root, "POST", { kind, statement, sourceLabel: sourceLabel || null }); setStatement(""); setSourceLabel(""); }, l("created"));
        }}>
          <label className="text-sm font-medium">{l("category")}
            <select value={kind} onChange={event => setKind(event.target.value as EvidenceKind)}
              className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3">
              {EVIDENCE_KINDS.map(value => <option key={value} value={value}>{l(`kind.${value}`)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">{l("statement")}
            <textarea required minLength={2} maxLength={1600} rows={2} value={statement}
              placeholder={l("placeholder")} onChange={event => setStatement(event.target.value)}
              className="mt-1 block w-full rounded-md border bg-background p-3" />
          </label>
          <label className="text-sm font-medium md:col-span-2">{l("source")}
            <input value={sourceLabel} maxLength={200} onChange={event => setSourceLabel(event.target.value)}
              placeholder={l("sourcePlaceholder")} className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3" />
          </label>
          <Button type="submit" className="md:col-span-2 md:justify-self-start" disabled={disabled || statement.trim().length < 2}>
            <Plus className="mr-2 size-4" />{l("addButton")}
          </Button>
        </form>
      </section>

      <section className="space-y-4" aria-labelledby="vault-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="vault-title" className="text-lg font-semibold">{l("myFacts")}</h2>
          <label className="text-sm">{l("filter")}
            <select value={status} onChange={event => setStatus(event.target.value as EvidenceStatus | "ALL")}
              className="ml-2 min-h-10 rounded-md border bg-background px-3">
              <option value="ALL">{l("all")}</option>
              {EVIDENCE_STATUSES.map(value => <option key={value} value={value}>{l(`status.${value}`)}</option>)}
            </select>
          </label>
        </div>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{l("failed")}: {error}. {l("retryHelp")}</p>}
        {notice && <p role="status" className="rounded-lg border border-primary/20 p-3 text-sm text-primary">{notice}</p>}
        {loading && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" />{l("loading")}</p>}
        {!loading && items.length === 0 && <div className="app-section flex items-start gap-3 text-sm text-muted-foreground">
          <CircleHelp className="size-5 shrink-0" />{l("empty")}
        </div>}
        <div className="grid gap-3">
          {items.map(item => <article key={item.id} className="app-section space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-muted px-2 py-1 font-medium">{l(`kind.${item.kind}`)}</span>
              <span className="rounded-md border px-2 py-1">{l(`status.${item.status}`)}</span>
              <span className="text-muted-foreground">{l(`origin.${item.source}`)}</span>
            </div>
            {editing === item.id ? <div className="grid gap-3">
              <select value={editKind} onChange={event => setEditKind(event.target.value as EvidenceKind)} aria-label={l("category")}
                className="min-h-11 rounded-md border bg-background px-3">
                {EVIDENCE_KINDS.map(value => <option key={value} value={value}>{l(`kind.${value}`)}</option>)}
              </select>
              <textarea aria-label={l("statement")} value={draft} minLength={2} maxLength={1600} rows={3} onChange={event => setDraft(event.target.value)} className="w-full rounded-md border bg-background p-3" />
              <input aria-label={l("source")} maxLength={200} value={editSource} onChange={event => setEditSource(event.target.value)} className="min-h-11 rounded-md border bg-background px-3" />
              <p className="text-xs text-muted-foreground">{l("editWarning")}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={disabled || draft.trim().length < 2} onClick={() => void perform(() => request(`${root}/${item.id}`, "PATCH", { revision: item.revision, kind: editKind, statement: draft, sourceLabel: editSource || null }), l("updated"))}><Check className="mr-2 size-4" />{l("save")}</Button>
                <Button variant="outline" onClick={() => setEditing(null)}><X className="mr-2 size-4" />{l("cancel")}</Button>
              </div>
            </div> : <>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.statement}</p>
              <p className="text-xs text-muted-foreground">{item.sourceLabel || l("noSource")}</p>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {(item.status === "DRAFT" || item.status === "REJECTED") && <Button disabled={disabled} size="sm" onClick={() => void perform(() => request(`${root}/${item.id}`, "PATCH", { revision: item.revision, action: "confirm" }), l("confirmed"))}><Check className="mr-1 size-4" />{l("confirm")}</Button>}
                {item.status === "DRAFT" && <Button disabled={disabled} size="sm" variant="outline" onClick={() => void perform(() => request(`${root}/${item.id}`, "PATCH", { revision: item.revision, action: "reject" }), l("rejected"))}><X className="mr-1 size-4" />{l("reject")}</Button>}
                {item.status === "CONFIRMED" && <Button disabled={disabled} size="sm" variant="outline" onClick={() => void perform(() => request(`${root}/${item.id}`, "PATCH", { revision: item.revision, action: "revoke" }), l("revoked"))}><Undo2 className="mr-1 size-4" />{l("revoke")}</Button>}
                {item.status !== "REVOKED" && <Button disabled={disabled} size="sm" variant="ghost" onClick={() => startEdit(item)}><Pencil className="mr-1 size-4" />{l("edit")}</Button>}
                <Button disabled={disabled} size="sm" variant="ghost" className="text-destructive" onClick={() => {
                  if (window.confirm(l("deleteConfirm"))) void perform(() => request(`${root}/${item.id}`, "DELETE", { revision: item.revision }), l("deleted"));
                }}><Trash2 className="mr-1 size-4" />{l("delete")}</Button>
              </div>
            </>}
          </article>)}
        </div>
        {nextCursor && <Button variant="outline" disabled={disabled} onClick={() => {
          if (busy) return;
          setBusy(true); setError("");
          void load(nextCursor).catch(err => setError(String(err instanceof Error ? err.message : err)))
            .finally(() => setBusy(false));
        }}>{l("more")}</Button>}
      </section>
    </div>
  );
}

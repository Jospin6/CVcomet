"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";
import { translateCentral } from "@/lib/i18n/central-copy";

type Key = "response_language" | "response_style" | "target_role" | "target_country" | "target_industry" | "work_mode" | "cv_market";
type Scope = "supervisor" | "resume" | "cover_letter";
type Preference = { id: string; key: Key; value: string; allowedAgents: Scope[]; revision: number };
type Envelope<T> = { data?: T; error?: { code: string } };
const keys: readonly Key[] = ["response_language", "response_style", "target_role", "target_country", "target_industry", "work_mode", "cv_market"];
const scopes: readonly Scope[] = ["supervisor", "resume", "cover_letter"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await r.json() as Envelope<T>;
  if (!r.ok || !body.data) throw Error(body.error?.code || "MEMORY_UNAVAILABLE");
  return body.data;
}

/** Explicit CRUD only. Never auto-infer or persist facts from chat messages. */
export default function CareerMemoryPanel({ french, onClose }: { french: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Preference[]>([]);
  const [key, setKey] = useState<Key>("response_language");
  const [value, setValue] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(["supervisor"]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const current = items.find(item => item.key === key);
  const reload = useCallback(async () => {
    const result = await request<{ items: Preference[] }>("/api/career/v1/agent/memory");
    setItems(result.items);
  }, []);
  useEffect(() => {
    let live = true;
    request<{ items: Preference[] }>("/api/career/v1/agent/memory")
      .then(result => { if (live) setItems(result.items); })
      .catch(() => { if (live) setError(translateCentral(french ? "fr" : "en", "careerMemory.label001")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // Mount-only; the active display language is captured for this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const choose = (next: Key) => {
    setKey(next);
    const existing = items.find(item => item.key === next);
    setValue(existing?.value ?? "");
    setSelectedScopes(existing?.allowedAgents ?? ["supervisor"]);
    setError(""); setNotice("");
  };
  useEffect(() => {
    if (loading || items.length === 0 || value) return;
    const initial = items.find(item => item.key === key);
    if (initial) { setValue(initial.value); setSelectedScopes(initial.allowedAgents); }
    // Only initializes the first loaded row; switching uses choose().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim() || !selectedScopes.length || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/api/career/v1/agent/memory${current ? `/${current.id}` : ""}`, {
        method: current ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", key, value: value.trim(), allowedAgents: selectedScopes,
          ...(current ? { expectedRevision: current.revision } : {}) }),
      });
      await reload();
      setNotice(translateCentral(french ? "fr" : "en", "careerMemory.label002"));
    } catch (e) { setError(e instanceof Error ? e.message : "MEMORY_UNAVAILABLE"); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!current || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/api/career/v1/agent/memory/${current.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", expectedRevision: current.revision }),
      });
      await reload(); setValue(""); setSelectedScopes(["supervisor"]);
      setNotice(translateCentral(french ? "fr" : "en", "careerMemory.label003"));
    } catch (e) { setError(e instanceof Error ? e.message : "MEMORY_UNAVAILABLE"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label={translateCentral(french ? "fr" : "en", "careerMemory.label004")}
        className="flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div><h2 className="text-base font-semibold">{translateCentral(french ? "fr" : "en", "careerMemory.label005")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{translateCentral(french ? "fr" : "en", "careerMemory.label006")}</p></div>
          <button type="button" aria-label={translateCentral(french ? "fr" : "en", "careerMemory.label007")} onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="size-4"/></button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          {loading ? <LoaderCircle className="size-5 animate-spin" aria-label={translateCentral(french ? "fr" : "en", "careerMemory.label008")} /> : (
            <>
              <p className="text-xs text-muted-foreground">{translateCentral(french ? "fr" : "en", "careerMemory.label009")}</p>
              <form onSubmit={event => { void save(event); }} className="space-y-3">
                <label className="block text-xs font-medium">{translateCentral(french ? "fr" : "en", "careerMemory.label010")}
                  <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={key} disabled={busy} onChange={e => choose(e.target.value as Key)}>
                    {keys.map(item => <option key={item} value={item}>{translateCentral(french ? "fr" : "en", `careerMemory.fields.${item}`)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium">{translateCentral(french ? "fr" : "en", "careerMemory.label011")}
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={value} disabled={busy}
                    required maxLength={120} onChange={e => setValue(e.target.value)} placeholder={translateCentral(french ? "fr" : "en", "careerMemory.label012")} />
                </label>
                <fieldset className="rounded-xl border p-3"><legend className="px-1 text-xs font-medium">{translateCentral(french ? "fr" : "en", "careerMemory.label013")}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {scopes.map(scope => <label key={scope} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" disabled={busy} checked={selectedScopes.includes(scope)} onChange={e =>
                        setSelectedScopes(prev => e.target.checked ? [...prev, scope] : prev.filter(item => item !== scope))} />
                      {scope.replaceAll("_", " ")}
                    </label>)}
                  </div>
                </fieldset>
                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
                <div className="flex justify-end gap-2">
                  {current && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border px-3 py-2 text-xs hover:bg-muted disabled:opacity-40">{translateCentral(french ? "fr" : "en", "careerMemory.label014")}</button>}
                  <button type="submit" disabled={busy || !value.trim() || !selectedScopes.length}
                    className="rounded-lg bg-primary px-4 py-2 text-xs text-primary-foreground disabled:opacity-40">
                    {busy ? "…" : translateCentral(french ? "fr" : "en", "careerMemory.label015")}
                  </button>
                </div>
              </form>
              <p className="border-t pt-3 text-xs text-muted-foreground">{translateCentral(french ? "fr" : "en", "careerMemory.label016")} {items.length}/7</p>
              <div className="flex flex-wrap gap-2">
                {items.map((item: Preference) => <button key={item.id} type="button" onClick={() => choose(item.key)}
                  className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted" title={item.value}>
                  {translateCentral(french ? "fr" : "en", `careerMemory.fields.${item.key}`)}
                </button>)}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

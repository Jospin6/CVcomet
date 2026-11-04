"use client";
import { getCentralCopy } from "@/lib/i18n/central-copy";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, Cpu, KeyRound, Loader2, RefreshCw, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { AIAdminView, AIProviderId, AIProviderView, AIModelOption } from "@/lib/ai/catalog";

const copy = getCentralCopy("aiSettings");
type Copy = typeof copy.fr | typeof copy.en;

async function api<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch("/api/admin/ai" + path, { method, cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI_FAILED");
  return data;
}

export function AISettingsPanel({ initial }: { initial: AIAdminView }) {
  const { i18n } = useTranslation();
  const c = copy[i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"];
  const [view, setView] = useState(initial);
  const [selected, setSelected] = useState<AIProviderId>(initial.activeProvider);
  const active = view.providers.find(provider => provider.provider === view.activeProvider)!;
  const provider = view.providers.find(provider => provider.provider === selected)!;
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />{c.back}</Link>
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1><p className="mt-2 text-sm text-muted-foreground">{c.description}</p></div>
    <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-wrap items-start gap-4 pt-6">
      <Cpu className="size-7 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">{c.current}</p>
        <p className="mt-1 break-words font-semibold">{active.label} <span className="font-normal text-muted-foreground">/ {active.model || "—"}</span></p>
        <p className="mt-2 text-sm text-muted-foreground">{c.applies}</p><p className="mt-1 text-xs text-muted-foreground">{c.immediate}</p></div>
      <Badge variant={active.configured && active.enabled ? "default" : "destructive"}>{active.configured && active.enabled ? c.active : c.missing}</Badge>
    </CardContent></Card>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={c.title}>
      {view.providers.map(item => <button key={item.provider} type="button" aria-pressed={selected === item.provider} onClick={() => setSelected(item.provider)}
        className={`rounded-xl border p-4 text-left transition-colors hover:border-primary ${selected === item.provider ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"}`}>
        <p className="text-sm font-semibold">{item.label}</p><p className="mt-2 text-xs text-muted-foreground">{!item.enabled ? c.disabled : item.configured ? c.ready : c.missing}</p>
        {view.activeProvider === item.provider && <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"><CheckCircle2 className="size-3" />{c.active}</span>}
      </button>)}
    </div>
    <ProviderForm key={selected} provider={provider} active={view.activeProvider === selected} canStoreKeys={view.canStoreKeys} onUpdate={setView} c={c} />
  </div>;
}

function ProviderForm({ provider, active, canStoreKeys, onUpdate, c }: {
  provider: AIProviderView; active: boolean; canStoreKeys: boolean; onUpdate: (_view: AIAdminView) => void; c: Copy;
}) {
  const [model, setModel] = useState(provider.model);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider.enabled);
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const payload = { provider: provider.provider, model: model.trim(), enabled, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) };
  const execute = async (action: string, task: () => Promise<string>) => {
    setBusy(action); setFeedback(null);
    try { const text = await task(); setFeedback({ text, error: false }); toast.success(text); }
    catch (error) {
      const code = error instanceof Error ? error.message : "AI_FAILED";
      const text = (c.errors as Record<string, string>)[code] || c.errors.AI_FAILED;
      setFeedback({ text, error: true }); toast.error(text);
    } finally { setBusy(""); }
  };
  const save = async (activate: boolean) => {
    const saved = await api<AIAdminView>("", payload, "PATCH");
    onUpdate(saved); setApiKey("");
    if (activate) onUpdate(await api<AIAdminView>("/activate", { provider: provider.provider }));
    return activate ? c.activated : c.success;
  };
  const spinner = (action: string) => busy === action ? <Loader2 className="size-4 animate-spin" /> : null;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-5" />{provider.label}</CardTitle></CardHeader>
    <CardContent className="space-y-6">
      {!canStoreKeys && <p role="alert" className="text-sm text-destructive">{c.encryption}</p>}
      <div className="space-y-2"><Label htmlFor="ai-key">{c.key}</Label>
        <Input id="ai-key" type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="off" maxLength={4096} disabled={Boolean(busy) || !canStoreKeys} placeholder={provider.configured ? "••••••••" : c.key} />
        <p className="text-xs text-muted-foreground">{provider.keySource === "database" ? c.savedKey : provider.keySource === "environment" ? c.serverKey : c.noKey} {c.keyHint}</p>
        <div className="flex flex-wrap gap-2">
          {provider.configured && <Button size="sm" variant="ghost" disabled={Boolean(busy) || active} onClick={() => execute("remove", async () => {
            onUpdate(await api<AIAdminView>("", { provider: provider.provider, model: provider.model, enabled: provider.enabled, apiKey: null }, "PATCH")); setApiKey(""); return c.keyRemoved;
          })}>{spinner("remove")}{c.remove}</Button>}
          {provider.keySource !== "environment" && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => execute("server", async () => {
            onUpdate(await api<AIAdminView>("", { provider: provider.provider, model: provider.model, enabled: provider.enabled, useEnvironmentKey: true }, "PATCH")); setApiKey(""); return c.keyRestored;
          })}>{spinner("server")}{c.server}</Button>}
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="ai-model">{c.model}</Label><div className="flex flex-col gap-2 sm:flex-row">
        <Input id="ai-model" list="ai-model-options" value={model} onChange={event => setModel(event.target.value)} maxLength={200} disabled={Boolean(busy)} placeholder="model-id" />
        <datalist id="ai-model-options">{models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
        <Button variant="outline" disabled={Boolean(busy) || (!apiKey.trim() && !provider.configured)} onClick={() => execute("models", async () => {
          const result = await api<{ models: AIModelOption[] }>("/models", { provider: provider.provider, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
          setModels(result.models); return `${result.models.length} ${c.loaded}`;
        })}>{spinner("models") || <RefreshCw className="size-4" />}{c.load}</Button>
      </div><p className="text-xs text-muted-foreground">{c.modelHint}</p></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={Boolean(busy) || active} className="size-4 accent-primary" />{c.enabled}</label>
      <div className="border-t pt-5"><div className="flex flex-wrap gap-3">
        <Button disabled={Boolean(busy) || !model.trim() || (!!apiKey.trim() && !canStoreKeys)} variant="outline" onClick={() => execute("save", () => save(false))}>{spinner("save") || <Save className="size-4" />}{c.save}</Button>
        <Button disabled={Boolean(busy) || !enabled || !model.trim() || (!apiKey.trim() && !provider.configured)} onClick={() => execute("activate", () => save(true))}>{spinner("activate") || <Zap className="size-4" />}{c.activate}</Button>
        <Button variant="secondary" disabled={Boolean(busy) || !model.trim() || (!apiKey.trim() && !provider.configured)} onClick={() => execute("test", async () => {
          const result = await api<{ latencyMs: number }>("/test", { provider: provider.provider, model: model.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
          return `${c.tested} (${result.latencyMs} ${c.ms})`;
        })}>{spinner("test") || <CheckCircle2 className="size-4" />}{c.test}</Button>
      </div><p className="mt-3 text-xs text-muted-foreground">{c.testHint}</p></div>
      {feedback && <p role={feedback.error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${feedback.error ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"}`}>{feedback.text}</p>}
      <p className="text-xs text-muted-foreground">{c.security}</p>
    </CardContent>
  </Card>;
}

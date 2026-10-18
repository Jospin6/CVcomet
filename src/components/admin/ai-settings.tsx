"use client";

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

const copy = {
  fr: {
    back: "Administration", title: "Fournisseurs et modèles IA", description: "Configurez les cinq fournisseurs et choisissez celui utilisé par toutes les fonctions IA.",
    current: "Configuration active", applies: "Utilisée pour les imports de CV, les réécritures, les CV, les lettres, les emails, l’analyse des offres et l’assistant.",
    immediate: "Chaque changement s’applique aux prochaines requêtes, sans redémarrage.", active: "Actif", ready: "Clé configurée", missing: "Clé manquante", disabled: "Désactivé",
    key: "Clé API", keyHint: "Laissez ce champ vide pour conserver la clé actuelle. Une nouvelle clé la remplace à l’enregistrement.",
    savedKey: "Une clé chiffrée est enregistrée.", serverKey: "Une clé est configurée sur le serveur.", noKey: "Ajoutez une clé pour utiliser ce fournisseur.",
    model: "Modèle", modelHint: "Chargez la liste, puis sélectionnez un modèle ou saisissez son identifiant exact.", load: "Charger les modèles", loaded: "modèles disponibles",
    enabled: "Fournisseur disponible", save: "Enregistrer", activate: "Enregistrer et activer", test: "Tester le modèle", testHint: "Le test effectue une courte génération JSON, facturée par le fournisseur selon votre offre.",
    remove: "Supprimer la clé", server: "Utiliser la clé du serveur", success: "Configuration enregistrée", activated: "Fournisseur activé", tested: "Connexion et génération JSON réussies", ms: "ms",
    keyRemoved: "Clé supprimée", keyRestored: "Clé du serveur sélectionnée", encryption: "Le serveur doit avoir un secret de chiffrement pour enregistrer les clés.",
    security: "Les clés restent côté serveur et sont chiffrées en base. Elles ne sont jamais affichées dans cette page.",
    errors: {
      AI_AUTH_ERROR: "Clé refusée ou accès non autorisé. Vérifiez la clé et les permissions du fournisseur.", AI_RATE_LIMIT: "Quota ou limite du fournisseur atteint. Vérifiez votre offre et votre facturation.",
      AI_TIMEOUT: "Le fournisseur a mis trop de temps à répondre.", AI_FAILED: "L’appel au fournisseur a échoué. Réessayez ou vérifiez sa configuration.",
      AI_PROVIDER_UNAVAILABLE: "Le service du fournisseur est temporairement indisponible ou surchargé. Réessayez dans un instant ou choisissez un autre modèle ou fournisseur.",
      AI_INVALID_RESPONSE: "Le modèle n’a pas renvoyé des données JSON exploitables. Réessayez ou choisissez un autre modèle.",
      AI_UNAVAILABLE: "Ajoutez une clé et un modèle, puis activez le fournisseur.", AI_KEY_REQUIRED: "Ajoutez une clé API avant de charger les modèles.",
      AI_KEY_UNREADABLE: "La clé enregistrée ne peut plus être déchiffrée. Enregistrez une nouvelle clé.", AI_ENCRYPTION_UNAVAILABLE: "Le secret de chiffrement du serveur est manquant.",
      AI_ACTIVE_PROVIDER_REQUIRED: "Activez d’abord un autre fournisseur avant de désactiver celui-ci ou de supprimer sa clé.", AI_PROVIDER_NOT_READY: "Le fournisseur doit être disponible et avoir une clé et un modèle.",
      AI_MODEL_UNAVAILABLE: "Ce modèle est introuvable ou ne prend pas en charge cette opération.", FORBIDDEN: "Cette action est réservée aux administrateurs.", UNAUTHORIZED: "Reconnectez-vous pour continuer.", VALIDATION: "Vérifiez les champs saisis.",
    },
  },
  en: {
    back: "Administration", title: "AI providers and models", description: "Configure all five providers and choose the one used by every AI feature.",
    current: "Active configuration", applies: "Used for resume imports, rewriting, resumes, cover letters, emails, job analysis and the assistant.",
    immediate: "Changes apply to new requests immediately, without restarting.", active: "Active", ready: "Key configured", missing: "Missing key", disabled: "Disabled",
    key: "API key", keyHint: "Leave this field empty to keep the current key. A new key replaces it when you save.",
    savedKey: "An encrypted key is stored.", serverKey: "A key is configured on the server.", noKey: "Add a key to use this provider.",
    model: "Model", modelHint: "Load the list, then select a model or enter its exact identifier.", load: "Load models", loaded: "available models",
    enabled: "Provider available", save: "Save", activate: "Save and activate", test: "Test model", testHint: "The test makes a short JSON generation request, billed by the provider according to your plan.",
    remove: "Remove key", server: "Use server key", success: "Configuration saved", activated: "Provider activated", tested: "Connection and JSON generation successful", ms: "ms",
    keyRemoved: "Key removed", keyRestored: "Server key selected", encryption: "The server needs an encryption secret to store keys.",
    security: "Keys stay on the server and are encrypted in the database. They are never displayed on this page.",
    errors: {
      AI_AUTH_ERROR: "Key rejected or access denied. Check the provider key and permissions.", AI_RATE_LIMIT: "The provider quota or rate limit was reached. Check your plan and billing.",
      AI_TIMEOUT: "The provider took too long to respond.", AI_FAILED: "The provider request failed. Try again or check its configuration.",
      AI_PROVIDER_UNAVAILABLE: "The provider service is temporarily unavailable or overloaded. Try again shortly or choose another model or provider.",
      AI_INVALID_RESPONSE: "The model did not return usable JSON data. Try again or choose another model.",
      AI_UNAVAILABLE: "Add a key and model, then activate the provider.", AI_KEY_REQUIRED: "Add an API key before loading models.",
      AI_KEY_UNREADABLE: "The stored key cannot be decrypted. Save a new key.", AI_ENCRYPTION_UNAVAILABLE: "The server encryption secret is missing.",
      AI_ACTIVE_PROVIDER_REQUIRED: "Activate another provider before disabling this one or removing its key.", AI_PROVIDER_NOT_READY: "The provider must be available and have a key and model.",
      AI_MODEL_UNAVAILABLE: "This model was not found or does not support this operation.", FORBIDDEN: "This action is reserved for administrators.", UNAUTHORIZED: "Sign in again to continue.", VALIDATION: "Check the entered values.",
    },
  },
};
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

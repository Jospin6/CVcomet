"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight, BriefcaseBusiness, Check, ChevronDown, FileText,
  LoaderCircle, Maximize2, Minus, Plus, Settings2,
  Target, Trash2,
} from "lucide-react";

import "./career-map-fullscreen.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AtsResumePreview,
  type AtsResumeRecord,
} from "@/components/resumes/ats-resume-preview";

type SkillStep = { id: string; title: string };
type RoleNode = {
  id: string;
  title: string;
  compatibility: number;
  acquired: string[];
  missing: string[];
  explanation: string;
  plan: SkillStep[];
};
type CareerPreferences = {
  targetRoles: string[];
  interests: string[];
  workMode: "REMOTE" | "HYBRID" | "ONSITE" | "ANY";
  goal: "EXPLORATION" | "ADVANCEMENT" | "CHANGE";
  balance: "CHILL" | "BALANCED" | "HUSTLE";
  identity: "SPECIALIST" | "GENERALIST" | "FOUNDER";
  income: "HIGH" | "COMFORTABLE" | "UNIMPORTANT";
  qualities: Array<"LEADERSHIP" | "KNOWLEDGE" | "CREATIVITY" | "PEOPLE" | "IMPACT">;
  positions: number;
};
type CareerMap = {
  id: string;
  title: string;
  cvId: string | null;
  preferences?: Partial<CareerPreferences>;
  graph: { nodes: RoleNode[]; edges: { from: string; to: string }[] };
  createdAt: string;
};
type Profile = { name?: string; headline?: string; skills?: string; experiences?: unknown[]; targetJobTitle?: string; targetIndustry?: string };
type Resume = AtsResumeRecord;
type Opportunity = {
  id: string;
  title: string;
  company: string;
  logoUrl?: string | null;
  applyUrl?: string | null;
  location?: string | null;
};
const safeHttpUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};

const DEFAULT_PREFERENCES: CareerPreferences = {
  targetRoles: [],
  interests: [],
  workMode: "ANY",
  goal: "EXPLORATION",
  balance: "BALANCED",
  identity: "SPECIALIST",
  income: "COMFORTABLE",
  qualities: [],
  positions: 9,
};

const QUALITY_OPTIONS = [
  ["LEADERSHIP", "Leadership"],
  ["KNOWLEDGE", "Specialized knowledge"],
  ["CREATIVITY", "Creativity"],
  ["PEOPLE", "Interpersonal skills"],
  ["IMPACT", "Social impact"],
] as const;

const POSITION_LAYOUT = [
  { x: 175, y: 222 }, { x: 450, y: 236 }, { x: 744, y: 208 },
  { x: 74, y: 376 }, { x: 345, y: 400 }, { x: 665, y: 370 },
  { x: 192, y: 536 }, { x: 494, y: 525 }, { x: 828, y: 522 },
  { x: 20, y: 564 }, { x: 818, y: 345 }, { x: 924, y: 190 },
];

const BOARD_WIDTH = 1120;
const BOARD_HEIGHT = 695;
const ROOT_X = 557;
const ROOT_Y = 78;
const CENTER_NODE_ID = "__career_center__";
type NodePosition = { x: number; y: number };
type NodeLayout = { mapId: string | null; positions: Record<string, NodePosition> };
const ROOT_POSITION = { x: ROOT_X - 80, y: ROOT_Y - 30 };

function boundedPosition(position: NodePosition, isCenter: boolean): NodePosition {
  const width = isCenter ? 160 : 154;
  return {
    x: Math.max(0, Math.min(BOARD_WIDTH - width, position.x)),
    y: Math.max(0, Math.min(BOARD_HEIGHT - 80, position.y)),
  };
}

function readNodeLayout(mapId: string): NodeLayout {
  try {
    const raw = window.localStorage.getItem(`cvcomet:career-map:layout:${mapId}`);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const positions: Record<string, NodePosition> = {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [id, location] of Object.entries(value)) {
        if (!location || typeof location !== "object") continue;
        const p = location as { x?: unknown; y?: unknown };
        if (typeof p.x === "number" && Number.isFinite(p.x) &&
            typeof p.y === "number" && Number.isFinite(p.y)) {
          positions[id] = boundedPosition({ x: p.x, y: p.y }, id === CENTER_NODE_ID);
        }
      }
    }
    return { mapId, positions };
  } catch {
    return { mapId, positions: {} };
  }
}
const shortName = (name: string) => name.trim().split(/\s+/).slice(0, 2).join(" ") || "My career";
const cvTitle = (cv: Resume) => cv.design?.documentName || cv.title || "My Resume";

function currentPreferences(value?: Partial<CareerPreferences>) {
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    targetRoles: Array.isArray(value?.targetRoles) ? value.targetRoles : [],
    interests: Array.isArray(value?.interests) ? value.interests : [],
    qualities: Array.isArray(value?.qualities) ? value.qualities : [],
  } satisfies CareerPreferences;
}

function PreferenceChoice<T extends string>({
  title, value, options, onChange,
}: {
  title: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-medium text-foreground">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
              value === id
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function RoleDetails({
  role, onGoal, saving, goalSaved,
}: {
  role: RoleNode;
  onGoal: () => void;
  saving: boolean;
  goalSaved: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">What makes this a potential fit?</h3>
        <p className="text-sm leading-6 text-muted-foreground">{role.explanation}</p>
        <p className="text-xs text-muted-foreground">
          Skill overlap: {role.compatibility}% · Based on a curated role checklist, not hiring odds.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Check className="size-4 text-emerald-600" />
            Skills in your background ({role.acquired.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {role.acquired.length ? role.acquired.map(skill => (
              <span key={skill} className="rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
                {skill}
              </span>
            )) : <p className="text-xs text-muted-foreground">No matching skills found yet.</p>}
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Plus className="size-4 text-destructive" />
            Skills to develop or document ({role.missing.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {role.missing.length ? role.missing.map(skill => (
              <span key={skill} className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-foreground">
                {skill}
              </span>
            )) : <p className="text-xs text-muted-foreground">No gaps in the selected checklist.</p>}
          </div>
        </section>
      </div>
      {role.plan.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Suggested next steps</h3>
          <div className="space-y-1.5">
            {role.plan.map((step, index) => (
              <div key={step.id} className="flex gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">{index + 1}.</span>
                {step.title}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button onClick={onGoal} disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Target className="size-4" />}
          {goalSaved ? "Goal saved" : "Set as career goal"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/find-jobs?q=${encodeURIComponent(role.title)}`}>
            <BriefcaseBusiness className="size-4" /> Find jobs
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/cover-letters?target=${encodeURIComponent(role.title)}`}>
            <FileText className="size-4" /> Cover letter
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/interviews">Practice interview</Link>
        </Button>
      </div>
    </div>
  );
}

export function CareerMapPage() {
  const [cvs, setCvs] = useState<Resume[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [maps, setMaps] = useState<CareerMap[]>([]);
  const [selected, setSelected] = useState<CareerMap | null>(null);
  const [cvId, setCvId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<CareerPreferences>(DEFAULT_PREFERENCES);
  const [role, setRole] = useState<RoleNode | null>(null);
  const [openings, setOpenings] = useState<Opportunity[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodeLayout, setNodeLayout] = useState<NodeLayout>({ mapId: null, positions: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [goalBusy, setGoalBusy] = useState(false);
  const [savedGoals, setSavedGoals] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const dragStart = useRef<{
    pointerId: number; x: number; y: number; panX: number; panY: number;
  } | null>(null);
  const nodeDragStart = useRef<{
    pointerId: number; id: string; startX: number; startY: number;
    original: NodePosition; moved: boolean;
  } | null>(null);
  const lastNodeDrag = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    if (!role) { setOpenings([]); return; }
    const controller = new AbortController();
    setOpenings([]);
    setOpeningsLoading(true);
    void fetch(`/api/find-jobs?q=${encodeURIComponent(role.title)}&page=1`, {
      signal: controller.signal,
    }).then(async response => response.ok ? response.json() : { jobs: [] })
      .then((data: { jobs?: Opportunity[] }) => {
        if (!controller.signal.aborted) {
          setOpenings(Array.isArray(data.jobs) ? data.jobs.slice(0, 3) : []);
        }
      }).catch(() => {
        if (!controller.signal.aborted) setOpenings([]);
      }).finally(() => {
        if (!controller.signal.aborted) setOpeningsLoading(false);
      });
    return () => controller.abort();
  }, [role]);

  const nodes = useMemo(() => selected?.graph.nodes ?? [], [selected]);
  const positions = nodeLayout.mapId === selected?.id ? nodeLayout.positions : {};
  const rootPosition = positions[CENTER_NODE_ID] ?? ROOT_POSITION;

  // A user's arrangement is local to the saved map. It never alters AI results.
  useEffect(() => {
    if (!selected || nodeLayout.mapId !== selected.id) return;
    try {
      window.localStorage.setItem(
        `cvcomet:career-map:layout:${selected.id}`,
        JSON.stringify(nodeLayout.positions),
      );
    } catch { /* Storage may be disabled; dragging still works this session. */ }
  }, [selected?.id, nodeLayout]);

  const updateNodePosition = (id: string, position: NodePosition) => {
    if (!selected) return;
    const bounded = boundedPosition(position, id === CENTER_NODE_ID);
    setNodeLayout(current => ({
      mapId: selected.id,
      positions: {
        ...(current.mapId === selected.id ? current.positions : {}),
        [id]: bounded,
      },
    }));
  };

  const beginNodeDrag = (event: ReactPointerEvent<HTMLElement>, id: string, position: NodePosition) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    nodeDragStart.current = {
      pointerId: event.pointerId, id,
      startX: event.clientX, startY: event.clientY,
      original: position, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveNode = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = nodeDragStart.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
    drag.moved = true;
    updateNodePosition(drag.id, {
      x: drag.original.x + deltaX / scale,
      y: drag.original.y + deltaY / scale,
    });
  };

  const endNodeDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = nodeDragStart.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (drag.moved) lastNodeDrag.current = { id: drag.id, at: Date.now() };
    nodeDragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const moveNodeWithKeys = (
    event: ReactKeyboardEvent<HTMLElement>, id: string, position: NodePosition,
  ) => {
    const offset = event.shiftKey ? 20 : 8;
    const directions: Record<string, NodePosition> = {
      ArrowLeft: { x: -offset, y: 0 },
      ArrowRight: { x: offset, y: 0 },
      ArrowUp: { x: 0, y: -offset },
      ArrowDown: { x: 0, y: offset },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    updateNodePosition(id, {
      x: position.x + direction.x, y: position.y + direction.y,
    });
  };
  const selectedResume = useMemo(() => cvs.find(cv => cv.id === cvId) ?? null, [cvs, cvId]);
  const hasBackground = Boolean(
    profile?.headline?.trim() || profile?.skills?.trim() ||
    profile?.experiences?.length || cvs.length,
  );

  const selectMap = useCallback((map: CareerMap) => {
    setSelected(map);
    setPreferences(currentPreferences(map.preferences));
    setCvId(map.cvId ?? null);
    setRole(null);
    setNodeLayout(readNodeLayout(map.id));
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, []);

  const generate = useCallback(async (
    selectedCv: string | null,
    nextPreferences: CareerPreferences,
    { closePreferences = false }: { closePreferences?: boolean } = {},
  ) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/career-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId: selectedCv, preferences: nextPreferences }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "MAP_GENERATION_FAILED");
      }
      const map = result as CareerMap;
      setMaps(existing => [map, ...existing]);
      selectMap(map);
      if (closePreferences) setPreferencesOpen(false);
      setResumeOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate your map.");
    } finally {
      setBusy(false);
    }
  }, [selectMap]);

  useEffect(() => {
    const controller = new AbortController();
    const read = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
      return response.json();
    };
    void Promise.all([
      read("/api/cvs?mine=1"),
      read("/api/career-map"),
      read("/api/career-profile"),
    ]).then(([resumeData, mapData, profileData]) => {
      if (controller.signal.aborted) return;
      const list = Array.isArray(resumeData) ? resumeData as Resume[] : [];
      const mapList = Array.isArray(mapData.maps) ? mapData.maps as CareerMap[] : [];
      setCvs(list);
      setProfile(profileData as Profile);
      setMaps(mapList);
      setSavedGoals(Array.isArray(mapData.goals)
        ? mapData.goals.map((goal: { roleId: string }) => goal.roleId)
        : []);
      if (mapList[0]) {
        selectMap(mapList[0]);
      } else if (
        (profileData?.headline || profileData?.skills || profileData?.experiences?.length || list.length)
      ) {
        // One initial generation, only when no map has ever been saved.
        void generate(null, DEFAULT_PREFERENCES);
      }
    }).catch(cause => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Map unavailable.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [generate, selectMap]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this career map?")) return;
    setError("");
    const response = await fetch(`/api/career-map/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setError("Could not delete the selected map.");
      return;
    }
    const remaining = maps.filter(map => map.id !== id);
    setMaps(remaining);
    if (selected?.id === id) {
      if (remaining[0]) selectMap(remaining[0]);
      else setSelected(null);
    }
  };

  const saveGoal = async (item: RoleNode) => {
    if (!selected) return;
    setGoalBusy(true);
    setError("");
    try {
      const response = await fetch("/api/career-map/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: item.id, mapId: selected.id }),
      });
      if (!response.ok) throw new Error("Could not save this career goal.");
      setSavedGoals(current => Array.from(new Set([...current, item.id])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this career goal.");
    } finally {
      setGoalBusy(false);
    }
  };

  return (
    <div className="cvcomet-career-map-fullscreen relative min-w-0 overflow-hidden">
      <section
        className="relative h-full w-full overflow-hidden bg-background"
        aria-label="Interactive career map"
      >
        {error && (
          <div
            role="alert"
            className="absolute left-1/2 top-4 z-30 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-destructive/30 bg-card px-3 py-2 text-sm text-destructive shadow-sm"
          >
            {error === "MAP_LIMIT"
              ? "You have reached the map creation limit. Try again later."
              : error}
          </div>
        )}

        {/* Dotted diagram board, theme-aware and without a hard-coded palette. */}
        <div className="pointer-events-none absolute inset-0 opacity-65" style={{
          backgroundImage: "radial-gradient(circle, var(--border) 0.8px, transparent 1px)",
          backgroundSize: "19px 19px",
        }} />

        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
          <Button variant="outline" size="sm" className="justify-start bg-card" onClick={() => setPreferencesOpen(true)}>
            <Settings2 className="size-4" /> Preferences
          </Button>
          <Button variant="outline" size="sm" className="justify-start bg-card" onClick={() => {
            setPreferences(current => ({ ...current, positions: current.positions >= 12 ? 6 : current.positions + 3 }));
            setPreferencesOpen(true);
          }}>
            <Plus className="size-4" /> More positions
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
          <button type="button" className="p-2.5 hover:bg-muted" aria-label="Zoom in" onClick={() => setScale(s => Math.min(1.5, +(s + .15).toFixed(2)))}>
            <Plus className="size-4" />
          </button>
          <button type="button" className="border-y p-2.5 hover:bg-muted" aria-label="Zoom out" onClick={() => setScale(s => Math.max(.6, +(s - .15).toFixed(2)))}>
            <Minus className="size-4" />
          </button>
          <button type="button" className="p-2.5 hover:bg-muted" aria-label="Fit map" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>
            <Maximize2 className="size-4" />
          </button>
        </div>

        {selected && (
          <div className="absolute right-4 top-4 z-10">
            <button
              type="button"
              className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setHistoryOpen(x => !x)}
              aria-expanded={historyOpen}
            >
              Saved maps <ChevronDown className="ml-2 inline size-3" />
            </button>
            {historyOpen && (
              <div className="absolute right-0 mt-2 max-h-56 w-64 space-y-1 overflow-y-auto rounded-xl border bg-card p-2 shadow-lg">
                {maps.map(map => (
                  <div key={map.id} className="flex items-center gap-1 rounded-lg hover:bg-muted">
                    <button type="button" className="min-w-0 flex-1 px-2 py-2 text-left text-xs" onClick={() => { selectMap(map); setHistoryOpen(false); }}>
                      <span className="block truncate">{map.title}</span>
                      <span className="text-muted-foreground">{new Date(map.createdAt).toLocaleDateString()}</span>
                    </button>
                    <button type="button" onClick={() => void remove(map.id)} className="rounded p-2 hover:text-destructive" aria-label={`Delete map ${map.title}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading career map
          </div>
        ) : !selected ? (
          <div className="relative flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <Target className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Your career paths will appear here.</p>
            {!hasBackground && <p className="max-w-sm text-xs text-muted-foreground">Add your skills or experience to your profile first.</p>}
            <div className="flex gap-2">
              {!hasBackground && <Button variant="outline" asChild><Link href="/dashboard/profile">Complete profile</Link></Button>}
              <Button disabled={busy || !hasBackground} onClick={() => void generate(cvId, preferences)}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create map
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDown={event => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              if ((event.target as Element).closest("button, a, [data-career-draggable]")) return;
              dragStart.current = {
                pointerId: event.pointerId, x: event.clientX, y: event.clientY,
                panX: pan.x, panY: pan.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              const drag = dragStart.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              setPan({
                x: drag.panX + event.clientX - drag.x,
                y: drag.panY + event.clientY - drag.y,
              });
            }}
            onPointerUp={event => {
              if (dragStart.current?.pointerId !== event.pointerId) return;
              dragStart.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => { dragStart.current = null; }}
          >
            <div
              className="relative mx-auto"
              style={{
                width: BOARD_WIDTH * scale,
                height: BOARD_HEIGHT * scale,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
              }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width: BOARD_WIDTH, height: BOARD_HEIGHT,
                  transform: `scale(${scale})`, transformOrigin: "top left",
                }}
              >
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 text-border"
                  width={BOARD_WIDTH}
                  height={BOARD_HEIGHT}
                  viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
                >
                  {nodes.slice(0, 12).map((node, index) => {
                    const position = positions[node.id] ?? POSITION_LAYOUT[index];
                    const cx = position.x + 77;
                    const cy = position.y;
                    return (
                      <path
                        key={node.id}
                        d={`M ${rootPosition.x + 80} ${rootPosition.y + 70} C ${rootPosition.x + 80} ${rootPosition.y + 165}, ${cx} ${cy - 130}, ${cx} ${cy}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="5 7"
                      />
                    );
                  })}
                </svg>

                <div
                  data-career-draggable
                  role="group"
                  tabIndex={0}
                  aria-label="Your career node. Drag to move, or use arrow keys."
                  className="absolute z-10 flex min-h-16 w-40 cursor-grab select-none items-center justify-center rounded-xl border bg-card px-4 py-3 text-center text-sm font-semibold shadow-sm active:cursor-grabbing"
                  style={{ left: rootPosition.x, top: rootPosition.y, touchAction: "none" }}
                  onPointerDown={event => beginNodeDrag(event, CENTER_NODE_ID, rootPosition)}
                  onPointerMove={moveNode}
                  onPointerUp={endNodeDrag}
                  onPointerCancel={endNodeDrag}
                  onKeyDown={event => moveNodeWithKeys(event, CENTER_NODE_ID, rootPosition)}
                >
                  {shortName(profile?.name || "My profile")}
                </div>
                {nodes.slice(0, 12).map((node, index) => {
                  const position = positions[node.id] ?? POSITION_LAYOUT[index];
                  return (
                    <button
                      type="button"
                      key={node.id}
                      data-career-draggable
                      onClick={() => {
                        const lastDrag = lastNodeDrag.current;
                        if (lastDrag?.id === node.id && Date.now() - lastDrag.at < 700) {
                          lastNodeDrag.current = null;
                          return;
                        }
                        setRole(node);
                      }}
                      onPointerDown={event => beginNodeDrag(event, node.id, position)}
                      onPointerMove={moveNode}
                      onPointerUp={endNodeDrag}
                      onPointerCancel={endNodeDrag}
                      onKeyDown={event => moveNodeWithKeys(event, node.id, position)}
                      className="absolute z-10 flex min-h-[68px] w-[154px] cursor-grab select-none flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2.5 py-3 text-center shadow-sm transition-[border-color,transform,box-shadow] hover:border-primary/60 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
                      style={{ left: position.x, top: position.y, touchAction: "none" }}
                      aria-label={`View career path: ${node.title}. ${node.compatibility}% catalog skill overlap.`}
                    >
                      <span className="text-[13px] font-medium leading-5">{node.title}</span>
                      <span className="text-[11px] text-muted-foreground">{node.compatibility}% skills</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Preferences: side panel, same visual hierarchy as reference screenshots. */}
      <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <SheetContent side="left" className="max-w-[340px] gap-0 overflow-hidden">
          <SheetHeader className="border-b py-5">
            <SheetTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4" /> Preferences</SheetTitle>
            <SheetDescription className="sr-only">Choose your career path preferences</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <PreferenceChoice title="Your goal" value={preferences.goal} options={[
              ["EXPLORATION", "Career exploration"],
              ["ADVANCEMENT", "Career advancement"],
              ["CHANGE", "Career change"],
            ]} onChange={goal => setPreferences(current => ({ ...current, goal }))} />
            <PreferenceChoice title="Work/life balance" value={preferences.balance} options={[
              ["CHILL", "Chill"], ["BALANCED", "Healthy balance"], ["HUSTLE", "Hustle"],
            ]} onChange={balance => setPreferences(current => ({ ...current, balance }))} />
            <PreferenceChoice title="Desired identity" value={preferences.identity} options={[
              ["SPECIALIST", "Specialist"],
              ["GENERALIST", "Jack of all trades"],
              ["FOUNDER", "Business owner"],
            ]} onChange={identity => setPreferences(current => ({ ...current, identity }))} />
            <PreferenceChoice title="Desired income" value={preferences.income} options={[
              ["HIGH", "High"], ["COMFORTABLE", "Comfortable"],
              ["UNIMPORTANT", "Unimportant"],
            ]} onChange={income => setPreferences(current => ({ ...current, income }))} />
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium">Professional qualities</legend>
              <div className="flex flex-wrap gap-1.5">
                {QUALITY_OPTIONS.map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={preferences.qualities.includes(id)}
                    onClick={() => setPreferences(current => ({
                      ...current,
                      qualities: current.qualities.includes(id)
                        ? current.qualities.filter(value => value !== id)
                        : [...current.qualities, id],
                    }))}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      preferences.qualities.includes(id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-muted/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >{label}</button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <label className="text-xs font-medium" htmlFor="career-role-interest">Role to explore (optional)</label>
              <Input
                id="career-role-interest"
                value={preferences.targetRoles[0] ?? ""}
                maxLength={100}
                placeholder="e.g. AI Engineer"
                onChange={event => setPreferences(current => ({
                  ...current,
                  targetRoles: event.target.value.trim() ? [event.target.value] : [],
                }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium" htmlFor="career-industry-interest">Industry preferences</label>
              <Input
                id="career-industry-interest"
                value={preferences.interests[0] ?? ""}
                maxLength={80}
                placeholder={profile?.targetIndustry || "e.g. Software Engineering"}
                onChange={event => setPreferences(current => ({
                  ...current,
                  interests: event.target.value ? [event.target.value] : [],
                }))}
              />
            </div>
            <PreferenceChoice title="Preferred work mode" value={preferences.workMode} options={[
              ["ANY", "Any"], ["REMOTE", "Remote"],
              ["HYBRID", "Hybrid"], ["ONSITE", "On-site"],
            ]} onChange={workMode => setPreferences(current => ({ ...current, workMode }))} />
            <div className="space-y-2">
              <label className="text-xs font-medium" htmlFor="career-positions">Positions on map</label>
              <select
                id="career-positions"
                value={preferences.positions}
                onChange={event => setPreferences(current => ({ ...current, positions: Number(event.target.value) }))}
                className="h-9 w-full rounded-md border bg-card px-2 text-sm"
              >
                {[6, 9, 12].map(value => <option key={value} value={value}>{value} positions</option>)}
              </select>
            </div>
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs text-muted-foreground">Resume used: {selectedResume ? cvTitle(selectedResume) : "Career profile"}</p>
              <Button variant="outline" className="w-full" onClick={() => setResumeOpen(true)}>
                <FileText className="size-4" /> Select resume
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Income and balance are saved as preferences; they do not generate salary claims without verified data.</p>
          </div>
          <div className="border-t bg-background px-5 py-4">
            <Button className="w-full" disabled={busy || !hasBackground} onClick={() => void generate(cvId, preferences, { closePreferences: true })}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              Apply preferences
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select Resume</DialogTitle>
            <DialogDescription className="sr-only">Choose the resume to use when generating your career map</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[68vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4">
            <button
              type="button"
              onClick={() => { setCvId(null); setResumeOpen(false); void generate(null, preferences); }}
              className={`flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs ${!cvId ? "border-primary ring-1 ring-primary" : "border-dashed hover:border-primary/60"}`}
            >
              <FileText className="size-6 text-muted-foreground" /> Career profile
            </button>
            {cvs.map(cv => (
              <div key={cv.id} className={`overflow-hidden rounded-xl border ${cvId === cv.id ? "border-primary ring-1 ring-primary" : ""}`}>
                <button
                  type="button"
                  onClick={() => { setCvId(cv.id); setResumeOpen(false); void generate(cv.id, preferences); }}
                  aria-label={`Select ${cvTitle(cv)}`}
                  className="block h-44 w-full overflow-hidden bg-muted/30"
                >
                  <AtsResumePreview record={cv} />
                </button>
                <div className="flex items-center justify-between gap-2 px-2 py-2">
                  <span className="truncate text-xs font-medium" title={cvTitle(cv)}>{cvTitle(cv)}</span>
                  {cvId === cv.id && <Check className="size-4 shrink-0 text-primary" />}
                </div>
              </div>
            ))}
            <Link href="/dashboard/resumes" className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-xs text-primary hover:bg-muted/50">
              <Plus className="size-6" /> Create resume
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">The map updates using the resume you select.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(role)} onOpenChange={open => { if (!open) setRole(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-xl">{role?.title}</DialogTitle>
            <DialogDescription>
              Explore what you already demonstrate and what you could develop next.
            </DialogDescription>
          </DialogHeader>
          {role && (
            <>
              <RoleDetails
                role={role}
                saving={goalBusy}
                goalSaved={savedGoals.includes(role.id)}
                onGoal={() => void saveGoal(role)}
              />
              <section className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Open jobs for this role</h3>
                  <Link
                    href={`/dashboard/find-jobs?q=${encodeURIComponent(role.title)}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View more <ArrowRight className="size-3" />
                  </Link>
                </div>
                {openingsLoading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="size-3.5 animate-spin" /> Searching current vacancies
                  </p>
                ) : openings.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {openings.map(item => (
                      <div key={item.id} className="min-w-0 rounded-lg border p-3">
                        <div className="flex items-start gap-2">
                          {safeHttpUrl(item.logoUrl) ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={safeHttpUrl(item.logoUrl)!} alt={`Logo ${item.company}`} className="size-7 shrink-0 object-contain" />
                          ) : <BriefcaseBusiness className="size-6 shrink-0 text-primary" />}
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs font-medium">{item.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{item.company}</p>
                          </div>
                        </div>
                        {safeHttpUrl(item.applyUrl) && (
                          <a href={safeHttpUrl(item.applyUrl)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            Apply <ArrowRight className="size-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No current vacancies found for this title.</p>
                )}
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

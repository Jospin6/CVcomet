"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUpRight,
  ContactRound,
  FileText,
  Mail,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { AppDispatch, RootState } from "@/redux/store";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import {
  addConversation,
  clearConversationId,
  setTypeGeneration,
} from "@/redux/conversation/conversationSlice";
import { getTodayGenerationCount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreRing } from "@/components/ui/score-ring";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { profileCompleteness } from "@/lib/career-profile/schema";
import { dayLimit } from "@/helpers/constants";

function Overview() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const search = useSearchParams();
  const { user: session } = useCurrentUser();
  const user = useSelector(selectUser);
  const conversations = useSelector(
    (state: RootState) => state.conversation.conversations,
  );
  const loadingConversations = useSelector(
    (state: RootState) => state.conversation.loading,
  );
  const [input, setInput] = useState("");
  const [kind, setKind] = useState<"cv" | "coverLetter">("cv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (session?.id) void dispatch(fetchUser(session.id));
  }, [session?.id, dispatch]);
  useEffect(() => {
    const type = search.get("document");
    if (type === "cv" || type === "coverLetter") {
      setKind(type);
      requestAnimationFrame(() => textarea.current?.focus());
    }
  }, [search]);
  const completeness = profileCompleteness({
    name: user?.name, email: user?.email, headline: user?.headline,
    summary: user?.summary, skills: user?.skills, languages: user?.languages,
    careerGoal: user?.careerGoal, experienceLevel: user?.experienceLevel,
    targetJobTitle: user?.targetJobTitle, targetIndustry: user?.targetIndustry,
    targetCountry: user?.targetCountry, preferredWorkMode: user?.preferredWorkMode,
    experiences: user?.Experience, education: user?.Education, projects: user?.Project,
  });
  const fields = Object.values(completeness.sections);
  const completed = completeness.completed;
  const percentage = completeness.percentage;
  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) {
      setError(t("shell.requiredDescription"));
      textarea.current?.focus();
      return;
    }
    if (!session?.id) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      dispatch(clearConversationId());
      dispatch(setTypeGeneration(kind));
      const conversation = await dispatch(
        addConversation({ content: input.trim(), userId: session.id }),
      ).unwrap();
      router.push("/g/" + conversation.id);
    } catch {
      setError(t("shell.composerError"));
      setBusy(false);
    }
  };
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("shell.homeEyebrow")}
        title={
          user?.name
            ? t("shell.greeting", { name: user.name.split(" ")[0] })
            : t("shell.homeTitle")
        }
        description={t("shell.homeDescription")}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <section className="relative overflow-hidden rounded-xl border bg-hero px-6 py-8 text-hero-foreground sm:p-9">
          <p className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest">
            <Sparkles className="size-3.5" />
            {t("shell.heroLabel")}
          </p>
          <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-[-.04em] sm:text-4xl">
            {t("shell.heroTitle")}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed">
            {t("shell.heroDescription")}
          </p>
          <Button asChild className="mt-7">
            <a href="#composer" onClick={() => textarea.current?.focus()}>
              {t("shell.start")}
              <ArrowRight />
            </a>
          </Button>
        </section>
        <section className="app-section flex flex-col items-center text-center">
          <p className="mb-5 flex w-full items-center gap-2 text-xs text-muted-foreground">
            <ContactRound className="size-4" />
            {t("shell.careerProfile")}
          </p>
          <ScoreRing
            value={percentage}
            label={t("shell.profileCompleteness")}
          />
          <h2 className="mt-4 text-sm font-semibold">
            {t("shell.profileCompleteness")}
          </h2>
          <p className="my-3 text-xs text-muted-foreground">
            {user
              ? t("shell.profileFields", {
                  complete: completed,
                  total: fields.length,
                })
              : t("shell.profileUnavailable")}
          </p>
          <Button variant="outline" asChild className="mt-auto w-full">
            <Link href={user && !user.onboardingCompletedAt ? "/onboarding" : "/dashboard/profile"}>
              {t("shell.completeProfile")}
              <ArrowUpRight />
            </Link>
          </Button>
        </section>
      </div>
      <section
        className="app-section scroll-mt-6"
        id="composer"
        aria-labelledby="composer-heading"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="composer-heading" className="type-h2">
              {t("shell.composerTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("shell.composerDescription")}
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/templates">
              {t("shell.exploreTemplates")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <form onSubmit={generate}>
          <label
            htmlFor="job-description"
            className="mb-2 block text-sm font-medium"
          >
            {t("shell.jobDescription")}
          </label>
          <Textarea
            ref={textarea}
            id="job-description"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError("");
            }}
            placeholder={t("shell.jobPlaceholder")}
            rows={5}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "generation-error" : undefined}
          />
          {error && (
            <p
              id="generation-error"
              role="alert"
              className="mt-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div
              role="group"
              aria-label={t("shell.documents")}
              className="flex rounded-lg border bg-muted p-1"
            >
              {(
                [
                  { value: "cv", label: "resumeShort", icon: FileText },
                  { value: "coverLetter", label: "letterShort", icon: Mail },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={kind === value ? "outline" : "ghost"}
                  size="sm"
                  disabled={busy}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  <Icon />
                  {t("shell." + label)}
                </Button>
              ))}
            </div>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              <Sparkles
                className={
                  busy ? "animate-pulse motion-reduce:animate-none" : ""
                }
              />
              {busy
                ? t("shell.creating")
                : session
                  ? t("shell.create")
                  : t("login")}
            </Button>
          </div>
          {user && (
            <div className="mt-5 max-w-sm">
              <p className="mb-2 text-xs text-muted-foreground">
                {user.isSubscribed
                  ? t("shell.subscriptionActive")
                  : t("shell.remaining", {
                      count: getTodayGenerationCount(
                        user.lastGeneratedAt || "",
                        user.generationCount || 0,
                      ),
                    })}
              </p>
              {!user.isSubscribed && (
                <ProgressBar
                  value={
                    (getTodayGenerationCount(
                      user.lastGeneratedAt || "",
                      user.generationCount || 0,
                    ) /
                      dayLimit) *
                    100
                  }
                  label={t("remainingGenerations")}
                />
              )}
            </div>
          )}
        </form>
      </section>
      <section>
        <SectionHeader
          title={t("shell.recent")}
          description={t("shell.recentDescription")}
        />
        {loadingConversations && !conversations.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : session && conversations.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {conversations.slice(0, 6).map((conversation) => (
              <Link
                key={conversation.id}
                href={"/g/" + conversation.id}
                className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary"
              >
                <MessageSquare className="mb-6 size-5 text-primary" />
                <h3 className="truncate font-medium">
                  {conversation.title || t("shell.untitled")}
                </h3>
                <p className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  {t("shell.open")}
                  <ArrowUpRight className="size-4" />
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title={t("shell.emptyDocuments")}
            description={t("shell.emptyDocumentsDescription")}
          />
        )}
      </section>
    </div>
  );
}
export default function Home() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Overview />
    </Suspense>
  );
}

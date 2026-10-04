"use client";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Search, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import type { AppDispatch, RootState } from "@/redux/store";
import { fetchTemplates } from "@/redux/template/templateSlice";
import {
  fetchUser,
  resetTemplateUpdated,
  selectUpdateCurrentTeplated,
  selectUser,
} from "@/redux/user/userSlice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateItemSkeleton } from "@/components/ui/templateItemSkeleton";
import TemplateCardList from "@/components/ui/templateCardList";
import { marketProfiles, resumeMarkets } from "@/lib/resume-market";

export default function Templates() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const { user: currentUser } = useCurrentUser();
  const user = useSelector(selectUser);
  const { templates, loading, error } = useSelector(
    (state: RootState) => state.template,
  );
  const updated = useSelector(selectUpdateCurrentTeplated);
  const [type, setType] = useState("CV");
  const [plan, setPlan] = useState("all");
  const [market, setMarket] = useState("all");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (currentUser?.id) void dispatch(fetchUser(currentUser.id));
  }, [currentUser?.id, dispatch]);
  useEffect(() => {
    void dispatch(fetchTemplates());
  }, [dispatch]);
  useEffect(() => { if (user?.targetMarket && market === "all") setMarket(user.targetMarket); }, [user?.targetMarket, market]);
  useEffect(() => {
    if (currentUser?.id && updated) {
      void dispatch(fetchUser(currentUser.id));
      dispatch(resetTemplateUpdated());
      void dispatch(fetchTemplates());
    }
  }, [updated, currentUser?.id, dispatch]);
  const filtered = templates.filter(
    (item) =>
      item.type === type &&
      (plan === "all" || item.plan === plan) &&
      (market === "all" || !item.markets?.length || item.markets.includes(market)) &&
      item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("shell.templatesEyebrow")}
        title={t("shell.templatesTitle")}
        description={t("shell.templatesDescription")}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs value={type} onValueChange={setType}>
            <TabsList aria-label={t("shell.templates")}>
              <TabsTrigger value="CV">{t("shell.resumes")}</TabsTrigger>
              <TabsTrigger value="COVER_LETTER">
                {t("shell.coverLetters")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {t("shell.templateCount", { count: filtered.length })}
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label={t("shell.searchTemplates")}
              placeholder={t("shell.searchTemplates")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger className="h-10 w-full bg-card sm:w-56" aria-label="Hiring market"><SelectValue placeholder="Hiring market" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All markets</SelectItem>{resumeMarkets.map(id => <SelectItem key={id} value={id}>{marketProfiles[id].shortLabel}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger
              className="h-10 w-full bg-card sm:w-48"
              aria-label={t("plan")}
            >
              <SlidersHorizontal className="size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("shell.allPlans")}</SelectItem>
              <SelectItem value="FREE">{t("shell.freePlan")}</SelectItem>
              <SelectItem value="PAID">{t("shell.paidPlan")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {loading ? (
        <TemplateItemSkeleton />
      ) : error ? (
        <EmptyState
          icon={LayoutTemplate}
          title={t("shell.loadError")}
          action={
            <Button
              variant="outline"
              onClick={() => dispatch(fetchTemplates())}
            >
              {t("shell.retry")}
            </Button>
          }
        />
      ) : filtered.length ? (
        <TemplateCardList templates={filtered} user={user ?? undefined} />
      ) : (
        <EmptyState
          icon={LayoutTemplate}
          title={t(templates.length ? "shell.noResults" : "shell.noTemplates")}
          description={t(
            templates.length
              ? "shell.noResultsDescription"
              : "shell.noTemplatesDescription",
          )}
          action={
            templates.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setPlan("all");
                  setMarket(user?.targetMarket || "all");
                  setType("CV");
                }}
              >
                {t("shell.resetFilters")}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

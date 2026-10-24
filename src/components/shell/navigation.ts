import {
  LayoutDashboard,
  ContactRound,
  ShieldCheck,
  FileText,
  ScanLine,
  BriefcaseBusiness,
  Map,
  ClipboardList,
  FileCheck2,
  MessagesSquare,
  ChartNoAxesCombined,
  Sparkles,
  PanelsTopLeft,
  Settings,
  CreditCard,
  CircleHelp,
  SearchCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = { key: string; icon: LucideIcon; href?: string };
export const navigationGroups: { key: string; items: NavigationItem[] }[] = [
  {
    key: "workspace",
    items: [
      { key: "overview", icon: LayoutDashboard, href: "/" },
      { key: "assistant", icon: Sparkles, href: "/dashboard/assistant" },
      { key: "findJobs", icon: SearchCheck, href: "/dashboard/find-jobs" },
      { key: "careerProfile", icon: ContactRound, href: "/dashboard/profile" },
      { key: "evidenceVault", icon: ShieldCheck, href: "/dashboard/evidence" },
      { key: "documents", icon: FileText, href: "/dashboard/resumes" },
      { key: "templates", icon: PanelsTopLeft, href: "/templates" },
    ],
  },
  {
    key: "jobSearch",
    items: [
      { key: "ats", icon: ScanLine, href: "/dashboard/ats" },
      { key: "jobMatch", icon: BriefcaseBusiness, href: "/dashboard/job-match" },
      { key: "careerMap", icon: Map, href: "/dashboard/career-map" },
      { key: "applications", icon: ClipboardList, href: "/dashboard/applications" },
      { key: "applicationAgent", icon: FileCheck2, href: "/dashboard/application-agent" },
      { key: "interviews", icon: MessagesSquare, href: "/dashboard/interviews" },
    ],
  },
  {
    key: "insights",
    items: [
      { key: "analytics", icon: ChartNoAxesCombined, href: "/dashboard/analytics" },
    ],
  },
];
export const footerNavigation: NavigationItem[] = [
  { key: "settings", icon: Settings, href: "/settings" },
  { key: "billing", icon: CreditCard, href: "/upgrade" },
  { key: "help", icon: CircleHelp, href: "/help" },
];
export const commandActions: NavigationItem[] = [
  { key: "assistant", icon: Sparkles, href: "/dashboard/assistant" },
  { key: "createResume", icon: FileText, href: "/dashboard/resumes" },
  { key: "createLetter", icon: FileText, href: "/dashboard/cover-letters" },
  { key: "analyzeResume", icon: ScanLine, href: "/dashboard/ats" },
  { key: "matchJob", icon: BriefcaseBusiness, href: "/dashboard/job-match" },
  { key: "careerMap", icon: Map, href: "/dashboard/career-map" },
  { key: "addApplication", icon: ClipboardList, href: "/dashboard/applications" },
  { key: "applicationAgent", icon: FileCheck2, href: "/dashboard/application-agent" },
  { key: "practiceInterview", icon: MessagesSquare, href: "/dashboard/interviews" },
  ...footerNavigation,
  { key: "careerProfile", icon: ContactRound, href: "/dashboard/profile" },
  { key: "evidenceVault", icon: ShieldCheck, href: "/dashboard/evidence" },
  { key: "templates", icon: PanelsTopLeft, href: "/templates" },
];

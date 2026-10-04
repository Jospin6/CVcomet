import {
  LayoutDashboard,
  ContactRound,
  FileText,
  ScanLine,
  BriefcaseBusiness,
  Mail,
  ClipboardList,
  MessagesSquare,
  ChartNoAxesCombined,
  Sparkles,
  PanelsTopLeft,
  Settings,
  CreditCard,
  CircleHelp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = { key: string; icon: LucideIcon; href?: string };
export const navigationGroups: { key: string; items: NavigationItem[] }[] = [
  {
    key: "workspace",
    items: [
      { key: "overview", icon: LayoutDashboard, href: "/" },
      { key: "careerProfile", icon: ContactRound, href: "/dashboard/profile" },
      { key: "resumes", icon: FileText, href: "/dashboard/resumes" },
      {
        key: "coverLetters",
        icon: Mail,
        href: "/?document=coverLetter#composer",
      },
      { key: "templates", icon: PanelsTopLeft, href: "/templates" },
    ],
  },
  {
    key: "jobSearch",
    items: [
      { key: "ats", icon: ScanLine, href: "/dashboard/ats" },
      { key: "jobMatch", icon: BriefcaseBusiness, href: "/dashboard/job-match" },
      { key: "applications", icon: ClipboardList, href: "/dashboard/applications" },
      { key: "interviews", icon: MessagesSquare, href: "/dashboard/interviews" },
    ],
  },
  {
    key: "insights",
    items: [
      { key: "analytics", icon: ChartNoAxesCombined, href: "/dashboard/analytics" },
      { key: "assistant", icon: Sparkles, href: "/dashboard/assistant" },
    ],
  },
];
export const footerNavigation: NavigationItem[] = [
  { key: "settings", icon: Settings, href: "/settings" },
  { key: "billing", icon: CreditCard, href: "/upgrade" },
  { key: "help", icon: CircleHelp, href: "/help" },
];
export const commandActions: NavigationItem[] = [
  { key: "createResume", icon: FileText, href: "/?document=cv#composer" },
  { key: "analyzeResume", icon: ScanLine, href: "/dashboard/ats" },
  { key: "matchJob", icon: BriefcaseBusiness, href: "/dashboard/job-match" },
  { key: "createLetter", icon: Mail, href: "/?document=coverLetter#composer" },
  { key: "addApplication", icon: ClipboardList, href: "/dashboard/applications" },
  { key: "practiceInterview", icon: MessagesSquare, href: "/dashboard/interviews" },
  ...footerNavigation,
  { key: "careerProfile", icon: ContactRound, href: "/dashboard/profile" },
  { key: "templates", icon: PanelsTopLeft, href: "/templates" },
];

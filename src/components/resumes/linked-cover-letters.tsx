"use client";

import Link from "next/link";
import { ChevronDown, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type LinkedCoverLetter = { id: string; positionTitle: string | null; companyName: string | null };

export function LinkedCoverLetters({ letters, compact = false }: { letters: LinkedCoverLetter[]; compact?: boolean }) {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr");
  if (!letters.length) return null;
  const label = fr ? "Lettre de motivation" : "Cover letter";
  const props = { variant: compact ? "ghost" as const : "outline" as const, size: compact ? "sm" as const : "default" as const };
  if (letters.length === 1) return <Button {...props} asChild><Link href={`/dashboard/cover-letters/${letters[0].id}`}><Mail className="size-4" />{label}</Link></Button>;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button {...props}><Mail className="size-4" />{label} ({letters.length})<ChevronDown className="size-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{letters.map((letter, index) => <DropdownMenuItem key={letter.id} asChild><Link href={`/dashboard/cover-letters/${letter.id}`}>{[letter.positionTitle, letter.companyName].filter(Boolean).join(" · ") || `${label} ${index + 1}`}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

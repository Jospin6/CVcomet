import type { ReactNode } from "react";
import { normalizeJobMarkdown } from "@/lib/find-jobs/description";

function inlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    return part;
  });
}

export function JobDescription({ value }: { value: string }) {
  const markdown = normalizeJobMarkdown(value);
  if (!markdown) return <p className="text-sm text-muted-foreground">La description complète est disponible sur le site de l’entreprise.</p>;

  const blocks = markdown.split(/\n{2,}/).filter(Boolean);
  return <div className="space-y-4 text-[0.9375rem] leading-7 text-foreground/85">
    {blocks.map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const heading = lines[0]?.match(/^(#{1,3})\s+(.+)$/);
      if (heading) return <h3 key={index} className="pt-2 text-lg font-semibold tracking-tight text-foreground">{inlineMarkdown(heading[2])}</h3>;
      if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index} className="ml-5 list-disc space-y-2 marker:text-primary">
        {lines.map((line, itemIndex) => <li key={itemIndex} className="pl-1">{inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>)}
      </ul>;
      if (lines.every((line) => /^\d+[.)]\s+/.test(line))) return <ol key={index} className="ml-5 list-decimal space-y-2 marker:font-semibold marker:text-primary">
        {lines.map((line, itemIndex) => <li key={itemIndex} className="pl-1">{inlineMarkdown(line.replace(/^\d+[.)]\s+/, ""))}</li>)}
      </ol>;
      return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{inlineMarkdown(line)}{lineIndex < lines.length - 1 && <br />}</span>)}</p>;
    })}
  </div>;
}

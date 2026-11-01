"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Only HTTP(S) destinations are clickable; never navigate to app-internal or JS URLs from AI output. */
function safeExternalLink(href: string | undefined) {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Formats model-authored Markdown without evaluating HTML or loading remote images. */
export default function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 break-words text-inherit [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => safeExternalLink(url) ?? ""}
        components={{
          h1: ({ children }) => <h2 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h2>,
          h2: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h4>,
          h4: ({ children }) => <h5 className="mb-1 mt-3 font-medium">{children}</h5>,
          p: ({ children }) => <p className="my-2 leading-7 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 leading-6">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
          hr: () => <hr className="my-4 border-border" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => {
            const safe = safeExternalLink(href);
            return safe ? (
              <a href={safe} target="_blank" rel="noopener noreferrer nofollow"
                className="font-medium text-primary underline underline-offset-4 hover:opacity-80">{children}</a>
            ) : <span>{children}</span>;
          },
          // Do not hotlink AI-generated image URLs; the user already has dedicated attachments.
          img: ({ alt }) => <span className="text-muted-foreground">{alt ?? "[image]"}</span>,
          pre: ({ children }) => <pre className="my-3 max-w-full overflow-x-auto rounded-xl border border-border bg-muted/50 p-3 text-xs leading-5 sm:text-sm">{children}</pre>,
          code: ({ children, className }) => <code className={`${className ?? ""} rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.88em]`}>{children}</code>,
          table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-max border-collapse text-left text-sm">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t border-border px-3 py-2 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

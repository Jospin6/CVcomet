"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  changes?: string[];
};

type Props = {
  messages: Message[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  disabled?: boolean;
  fr: boolean;
  placeholder?: string;
  error?: string;
  suggestions?: { label: string; prompt: string }[];
  review?: ReactNode;
};

export function StudioConversation({
  messages,
  value,
  onChange,
  onSubmit,
  busy,
  disabled = false,
  fr,
  placeholder,
  error,
  suggestions = [],
  review,
}: Props) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const area = messagesRef.current;
    if (area) area.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 42), 132)}px`;
  }, [value]);

  return (
    <div className="studio-chat" aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_conversation.text001")}>
      <div ref={messagesRef} className="studio-chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && !review && (
          <div className="studio-chat-welcome">
            <p className="text-sm font-medium">
              {translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_conversation.text002")}
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${index}-${message.role}`}
            className={`studio-chat-message ${message.role === "user" ? "is-user" : "is-assistant"}`}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            {Boolean(message.changes?.length) && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {message.changes?.map((change, i) => <li key={`${i}-${change}`}>{change}</li>)}
              </ul>
            )}
          </div>
        ))}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_conversation.text003")}
          </p>
        )}
        {review}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="studio-chat-footer">
        {messages.length === 0 && suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className="rounded-full border px-2.5 py-1.5 text-[10px] hover:bg-muted"
                disabled={busy || disabled}
                onClick={() => onChange(suggestion.prompt)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="studio-chat-composer">
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={4000}
            aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_conversation.text004")}
            placeholder={placeholder || (translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_conversation.text005"))}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (value.trim() && !busy && !disabled) event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={busy || disabled}
          />
          <button
            type="submit"
            className="studio-chat-send"
            aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_conversation.text006")}
            disabled={!value.trim() || busy || disabled}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

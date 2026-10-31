"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUp, Loader2, MessageSquareText, TextSelect } from "lucide-react";

export type StudioAIMode = "chat" | "selection";
export type DocumentTextSelection = { field: string; text: string };

/** Capture only selections made within ONE editable document field. */
export function useDocumentTextSelection(
  canvas: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  const [selection, setSelection] = useState<DocumentTextSelection | null>(null);

  useEffect(() => {
    if (!ready || !canvas.current) return;
    const root = canvas.current;
    const capture = () => {
      const selected = window.getSelection();
      if (!selected || selected.isCollapsed || !selected.rangeCount) return;

      const range = selected.getRangeAt(0);
      const asElement = (node: Node) =>
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement;
      const start = asElement(range.startContainer)?.closest<HTMLElement>("[data-field]");
      const end = asElement(range.endContainer)?.closest<HTMLElement>("[data-field]");
      if (!start || start !== end || !root.contains(start)) return;

      const field = start.dataset.field;
      const text = selected.toString().trim();
      if (field && text) setSelection({ field, text: text.slice(0, 1500) });
    };

    root.addEventListener("pointerup", capture);
    root.addEventListener("keyup", capture);
    return () => {
      root.removeEventListener("pointerup", capture);
      root.removeEventListener("keyup", capture);
    };
  }, [canvas, ready]);

  return { selection, clearSelection: () => setSelection(null) };
}

export function StudioAIModes({
  mode,
  onModeChange,
  fr,
  chat,
  selection,
}: {
  mode: StudioAIMode;
  onModeChange: (mode: StudioAIMode) => void;
  fr: boolean;
  chat: ReactNode;
  selection: ReactNode;
}) {
  return (
    <div className="studio-ai-workspace">
      <div className="studio-ai-mode-tabs" role="tablist" aria-label={fr ? "Mode de l'assistant" : "Assistant mode"}>
        <button
          type="button"
          role="tab"
          id="studio-ai-chat-tab"
          aria-controls="studio-ai-chat-panel"
          aria-selected={mode === "chat"}
          onClick={() => onModeChange("chat")}
        >
          <MessageSquareText className="size-3.5" /> Chat
        </button>
        <button
          type="button"
          role="tab"
          id="studio-ai-selection-tab"
          aria-controls="studio-ai-selection-panel"
          aria-selected={mode === "selection"}
          onClick={() => onModeChange("selection")}
        >
          <TextSelect className="size-3.5" /> {fr ? "Texte sélectionné" : "Selected text"}
        </button>
      </div>
      <div
        role="tabpanel"
        id={mode === "chat" ? "studio-ai-chat-panel" : "studio-ai-selection-panel"}
        aria-labelledby={mode === "chat" ? "studio-ai-chat-tab" : "studio-ai-selection-tab"}
        className="studio-ai-mode-content"
      >
        {mode === "chat" ? chat : selection}
      </div>
    </div>
  );
}

export function StudioSelectedEdit({
  fr,
  fieldLabel,
  text,
  exactSelection,
  value,
  onChange,
  onSubmit,
  busy,
  disabled,
  feedback,
  review,
  restriction,
}: {
  fr: boolean;
  fieldLabel: string;
  text: string;
  exactSelection: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  disabled: boolean;
  feedback?: string;
  review?: ReactNode;
  restriction?: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 42), 120)}px`;
  }, [value]);

  return (
    <section className="studio-selected-editor" aria-label={fr ? "Modification ciblée" : "Focused edit"}>
      <div className="studio-selected-scroll">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold">{fr ? "Passage à modifier" : "Text to edit"}</span>
          <span className="min-w-0 truncate text-[10px] text-muted-foreground" title={fieldLabel}>
            {fieldLabel}
          </span>
        </div>
        <div className="studio-selected-quote whitespace-pre-wrap break-words">
          {text || (fr ? "Sélectionnez un passage dans le document." : "Select text in the document.")}
        </div>
        {!exactSelection && (
          <p className="text-[10px] leading-4 text-muted-foreground">
            {fr
              ? "Sélectionnez des mots dans le document pour cibler un passage précis."
              : "Highlight words in the document to target an exact passage."}
          </p>
        )}
        {restriction && <p role="status" className="text-xs text-muted-foreground">{restriction}</p>}
        {busy && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {fr ? "Préparation de la modification…" : "Preparing your edit…"}
          </p>
        )}
        {feedback && <p role="status" className="text-xs leading-5 text-muted-foreground">{feedback}</p>}
        {review}
      </div>
      <form className="studio-selected-footer" onSubmit={onSubmit}>
        <label htmlFor="studio-selected-instruction" className="sr-only">
          {fr ? "Modification demandée" : "Requested change"}
        </label>
        <div className="studio-chat-composer">
          <textarea
            ref={input}
            id="studio-selected-instruction"
            rows={1}
            maxLength={1800}
            placeholder={fr ? "Que souhaitez-vous changer dans ce passage ?" : "What would you change in this passage?"}
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (value.trim() && text && !disabled && !busy && !restriction) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
            disabled={busy || disabled || Boolean(restriction)}
          />
          <button
            className="studio-chat-send"
            type="submit"
            aria-label={fr ? "Proposer une modification" : "Suggest edit"}
            disabled={!text || !value.trim() || busy || disabled || Boolean(restriction)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </section>
  );
}

/** Keep the selected snippet in the request, not the document identity fields. */
export function scopedEditInstruction(
  field: string,
  source: string,
  request: string,
  fr: boolean,
) {
  const excerpt = source.slice(0, 1100);
  const prompt = fr
    ? `Modifie uniquement le champ « ${field} ». Passage concerné : « ${excerpt} ». Demande : ${request}. Préserve le reste du champ et tous les autres champs. N'invente aucun fait. Si la modification ciblée n'est pas possible, demande une clarification.`
    : `Edit only the field "${field}". Target passage: "${excerpt}". Request: ${request}. Preserve the rest of this field and all other fields. Do not invent facts. Ask for clarification if a targeted edit is not possible.`;
  return prompt.slice(0, 3900);
}

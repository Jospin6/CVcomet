import { AgenticError } from "../../../core/errors.ts";
import type { ReadToolRegistry } from "../../../core/tools/read-tool-registry.ts";

export function registerDemoTools(registry: ReadToolRegistry): void {
  registry.register({
    name: "count_words",
    publicDemo: true,
    validate(raw) {
      if (!raw || typeof raw !== "object" || !("text" in raw) ||
          typeof raw.text !== "string" || raw.text.length > 120) {
        throw new AgenticError("AGENT_TOOL_INPUT_INVALID", 400);
      }
      return { text: raw.text };
    },
    authorize(_input, context) {
      if (context.access.kind !== "public_demo") throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
    },
    execute({ text }) {
      return text.length ? text.split(/\s+/).length : 0;
    },
  });
}

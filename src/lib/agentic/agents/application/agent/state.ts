import { Annotation } from "@langchain/langgraph";
import type { ApplicationEmail, ApplicationPacketInput, ApplicationSuggestionInput } from "../tools/contracts.tool";

/** Ephemeral only: never checkpoint contact data or application email contents. */
export const ApplicationPacketState = Annotation.Root({
  input: Annotation<ApplicationPacketInput>,
  draft: Annotation<ApplicationEmail>,
  verified: Annotation<boolean>,
  result: Annotation<ApplicationEmail>,
});
export const ApplicationSuggestionState = Annotation.Root({
  input: Annotation<ApplicationSuggestionInput>,
  draft: Annotation<ApplicationEmail | null>,
  verified: Annotation<boolean>,
  result: Annotation<ApplicationEmail | null>,
});

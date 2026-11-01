import { Annotation } from "@langchain/langgraph";

/** Deliberately stores only synthetic, non-personal demo data. */
export const DurableDemoState = Annotation.Root({
  request: Annotation<string>,
  confirmed: Annotation<boolean>,
  result: Annotation<string>,
});

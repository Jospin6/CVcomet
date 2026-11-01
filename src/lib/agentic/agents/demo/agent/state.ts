import { Annotation } from "@langchain/langgraph";

/** Demonstration graph state only: do not use for candidate data. */
export const DemoState = Annotation.Root({
  text: Annotation<string>,
  normalized: Annotation<string>,
  wordCount: Annotation<number>,
  result: Annotation<string>,
});

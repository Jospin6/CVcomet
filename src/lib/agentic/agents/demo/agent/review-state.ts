import { Annotation } from "@langchain/langgraph";

/** Only dummy IDs/revisions; NEVER use as a candidate document model. */
export const ReviewDemoState = Annotation.Root({
  resourceId: Annotation<string>,
  revision: Annotation<string>,
  result: Annotation<string>,
});

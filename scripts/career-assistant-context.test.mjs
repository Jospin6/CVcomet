import test from "node:test";
import assert from "node:assert/strict";
import { withApplicationContext, AGENT_MAX_READS } from "../src/lib/career-os/agent-engine.ts";

const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const otherId = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("without a selected application, the read plan remains unchanged", () => {
  const plan = [{ tool: "get_my_profile", input: {} }];
  assert.deepEqual(withApplicationContext(plan), plan);
});

test("selected application is fetched first with its trusted ID", () => {
  const plan = [{ tool: "list_my_resumes", input: {} }];
  assert.deepEqual(withApplicationContext(plan, id), [
    { tool: "get_my_application", input: { applicationId: id } },
    { tool: "list_my_resumes", input: {} },
  ]);
});

test("model cannot replace the selected application", () => {
  const plan = [
    { tool: "get_my_application", input: { applicationId: otherId } },
    { tool: "get_my_profile", input: {} },
  ];
  const result = withApplicationContext(plan, id);
  assert.equal(result[0].input.applicationId, id);
  assert.equal(result.filter(call => call.tool === "get_my_application").length, 1);
});

test("the three-read budget is respected", () => {
  const plan = [
    { tool: "list_my_applications", input: {} },
    { tool: "list_my_resumes", input: {} },
    { tool: "get_my_profile", input: {} },
  ];
  const result = withApplicationContext(plan, id);
  assert.equal(result.length, AGENT_MAX_READS);
  assert.equal(result[0].tool, "get_my_application");
});

test("malformed IDs and unapproved tools are rejected", () => {
  assert.throws(() => withApplicationContext([], "not-a-uuid"));
  assert.throws(() => withApplicationContext([{ tool: "submit_application", input: {} }], id));
});

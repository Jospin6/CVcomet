import type { MemoryState } from "../agent/state";
/** Bound payload; do not promote memory to a tool call or system policy. */
export function memoryVerifyNode(state: typeof MemoryState.State) {
  if (!state.snapshot || state.snapshot.preferences.length > 7 ||
      JSON.stringify(state.snapshot).length > 2500 ||
      state.snapshot.preferences.some(p => typeof p.key !== "string" || typeof p.value !== "string" || p.value.length > 120)) {
    throw Error("MEMORY_CONTEXT_INVALID");
  }
  return { verified: true };
}

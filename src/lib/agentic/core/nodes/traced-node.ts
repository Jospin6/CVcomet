import type { ExecutionScope } from "../execution/runner.ts";

/** Wrap each node with cancellation, safe events and bounded execution. */
export function tracedNode<TState, TUpdate>(
  scope: ExecutionScope,
  name: string,
  node: (state: TState) => TUpdate | Promise<TUpdate>,
): (state: TState) => Promise<TUpdate> {
  return (state) => scope.step(name, () => node(state));
}

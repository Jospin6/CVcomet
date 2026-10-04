"use client";
import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  // Preserve the initial snapshot for boundaries that hydrate after a session request completes.
  const [{ store, serverState }] = useState(() => {
    const store = makeStore();
    return { store, serverState: store.getState() };
  });
  return (
    <Provider store={store} serverState={serverState}>
      {children}
    </Provider>
  );
}

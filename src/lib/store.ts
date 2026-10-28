import { useSyncExternalStore } from "react";
import { defaultState, normalizeState, type AppState } from "./cashflow";

const KEY = "dongtien.v1";
let state: AppState | null = null;
const subs = new Set<() => void>();

function load(): AppState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch {
    state = defaultState();
  }
  return state;
}

export function setState(fn: (s: AppState) => AppState) {
  state = fn(load());
  localStorage.setItem(KEY, JSON.stringify(state));
  subs.forEach((f) => f());
}

export function useAppState(): AppState | null {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    load,
    () => null,
  );
}

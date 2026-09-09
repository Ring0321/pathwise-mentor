import { demoEventTemplates, seedState } from "../data/seed";
import type { AppState } from "../domain/types";

const storageKey = "sepath.demo.state.v1";

export function loadState(): AppState {
  if (typeof window === "undefined") return seedState;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return seedState;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return seedState;
  }
}

export function saveState(state: AppState): void {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function resetState(): AppState {
  window.localStorage.removeItem(storageKey);
  return seedState;
}

export function runNextDemoStep(state: AppState): AppState {
  const next = demoEventTemplates[state.demoStep];
  if (!next) return state;
  const events = state.events.some((event) => event.id === next.id) ? state.events : [...state.events, next];
  return {
    ...state,
    events,
    demoStep: state.demoStep + 1,
  };
}

export function runAllDemoSteps(state: AppState): AppState {
  let nextState = state;
  while (nextState.demoStep < demoEventTemplates.length) {
    nextState = runNextDemoStep(nextState);
  }
  return nextState;
}

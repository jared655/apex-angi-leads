import type { AppEvent } from "./types.ts";

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export function emit(event: AppEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("event listener failed", err);
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

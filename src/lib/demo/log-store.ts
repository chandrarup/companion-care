import { useSyncExternalStore } from "react";

// In-memory demo log store. Lives for the lifetime of the page so the caregiver
// and patient can add entries that show up everywhere in Demo Mode without a backend.

export type DemoEpisodeEntry = {
  id: string;
  kind: "episode";
  source: "caregiver" | "patient";
  symptom: string;
  timeOfDay: string;
  antecedent: string;
  intervention: string;
  outcome: string;
  distress: number | null;
  flags: string[];
  createdAt: number;
};

export type DemoNoteEntry = {
  id: string;
  kind: "note";
  source: "caregiver" | "patient";
  mood: 1 | 2 | 3 | 4 | 5 | null;
  sleep: "well" | "okay" | "poorly" | null;
  symptom?: string;
  note: string;
  createdAt: number;
};

export type DemoEntry = DemoEpisodeEntry | DemoNoteEntry;

let entries: DemoEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot() { return entries; }
function getServerSnapshot() { return entries; }

export function useDemoEntries(): DemoEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function id() {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function addDemoEpisode(e: Omit<DemoEpisodeEntry, "id" | "kind" | "createdAt">) {
  entries = [{ ...e, id: id(), kind: "episode", createdAt: Date.now() }, ...entries];
  emit();
}

export function addDemoNote(e: Omit<DemoNoteEntry, "id" | "kind" | "createdAt">) {
  entries = [{ ...e, id: id(), kind: "note", createdAt: Date.now() }, ...entries];
  emit();
}
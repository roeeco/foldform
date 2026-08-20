"use client";

import { produce } from "immer";
import { create } from "zustand";
import { DEFAULT_PROJECT, type Micrometres, type ParameterId, type ProjectDocument, type Unit, um, validateProject } from "./dieline";

const STORAGE_KEY = "foldform.project.v1";

interface ProjectState {
  project: ProjectDocument;
  past: ProjectDocument[];
  future: ProjectDocument[];
  hydrated: boolean;
  savedAt?: number;
  hydrate: () => void;
  commit: (mutator: (draft: ProjectDocument) => void) => void;
  previewParameter: (id: ParameterId, value: Micrometres) => void;
  commitParameterDrag: (id: ParameterId, original: Micrometres, value: Micrometres) => void;
  setParameter: (id: ParameterId, value: Micrometres) => void;
  setName: (name: string) => void;
  setUnit: (unit: Unit) => void;
  setSheetPreset: (preset: ProjectDocument["sheet"]["preset"]) => void;
  setOrientation: (orientation: ProjectDocument["sheet"]["orientation"]) => void;
  setCreaseMode: (mode: ProjectDocument["exportProfile"]["creaseMode"]) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

function persist(project: ProjectDocument): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

const sheetPresets = {
  A4: [210_000, 297_000],
  A3: [297_000, 420_000],
  Letter: [215_900, 279_400],
  Custom: [210_000, 297_000],
} as const;

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: DEFAULT_PROJECT,
  past: [],
  future: [],
  hydrated: false,
  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) set({ project: validateProject(JSON.parse(raw)), hydrated: true, savedAt: Date.now() });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  commit: (mutator) => {
    const current = get().project;
    const next = produce(current, mutator);
    if (next === current) return;
    persist(next);
    set((state) => ({ project: next, past: [...state.past.slice(-49), current], future: [], savedAt: Date.now() }));
  },
  previewParameter: (id, value) => set((state) => ({ project: produce(state.project, (draft) => { draft.parameters[id] = value; }) })),
  commitParameterDrag: (id, original, value) => {
    if (original === value) return;
    const preview = get().project;
    const before = produce(preview, (draft) => { draft.parameters[id] = original; });
    const final = produce(preview, (draft) => { draft.parameters[id] = value; });
    persist(final);
    set((state) => ({ project: final, past: [...state.past.slice(-49), before], future: [], savedAt: Date.now() }));
  },
  setParameter: (id, value) => get().commit((draft) => { draft.parameters[id] = value; }),
  setName: (name) => get().commit((draft) => { draft.name = name.trim() || "Untitled carton"; }),
  setUnit: (unit) => get().commit((draft) => { draft.display.unit = unit; draft.display.precision = unit === "in" ? 3 : 1; }),
  setSheetPreset: (preset) => get().commit((draft) => {
    const size = sheetPresets[preset]; draft.sheet.preset = preset; draft.sheet.widthUm = um(size[0]); draft.sheet.heightUm = um(size[1]);
  }),
  setOrientation: (orientation) => get().commit((draft) => { draft.sheet.orientation = orientation; }),
  setCreaseMode: (mode) => get().commit((draft) => { draft.exportProfile.creaseMode = mode; }),
  undo: () => {
    const { past, project, future } = get();
    const previous = past.at(-1); if (!previous) return;
    persist(previous); set({ project: previous, past: past.slice(0, -1), future: [project, ...future].slice(0, 50), savedAt: Date.now() });
  },
  redo: () => {
    const { past, project, future } = get();
    const next = future[0]; if (!next) return;
    persist(next); set({ project: next, past: [...past, project].slice(-50), future: future.slice(1), savedAt: Date.now() });
  },
  reset: () => {
    const current = get().project;
    persist(DEFAULT_PROJECT); set((state) => ({ project: DEFAULT_PROJECT, past: [...state.past, current].slice(-50), future: [], savedAt: Date.now() }));
  },
}));

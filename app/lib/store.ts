"use client";

import { produce } from "immer";
import { create } from "zustand";
import { DEFAULT_PROJECT, estimateScoreAllowance, type Micrometres, type ParameterId, type ProjectDocument, type TemplateId, type Unit, um, validateProject } from "./dieline";

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
  setTemplate: (id: TemplateId) => void;
  setName: (name: string) => void;
  setUnit: (unit: Unit) => void;
  setOpeningStyle: (value: ProjectDocument["construction"]["openingStyle"]) => void;
  setTuckPanel: (value: ProjectDocument["construction"]["tuckPanel"]) => void;
  setLockStyle: (value: ProjectDocument["construction"]["lockStyle"]) => void;
  setGlueAngle: (value: number) => void;
  setDustTaper: (value: number) => void;
  setSliceAngle: (value: number) => void;
  setMaterialThickness: (value: Micrometres) => void;
  setSheetPreset: (preset: ProjectDocument["sheet"]["preset"]) => void;
  setCustomSheetSize: (width: Micrometres, height: Micrometres) => void;
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
  "600x400": [600_000, 400_000],
  "700x500": [700_000, 500_000],
} as const;

const templateDefaults: Record<TemplateId, Partial<Record<ParameterId, Micrometres>>> = {
  "tuck-end-carton": { width: um(60_000), depth: um(30_000), height: um(90_000), glueFlap: um(15_000), clearance: um(1_000) },
  "crash-lock-carton": { width: um(60_000), depth: um(30_000), height: um(90_000), tuckFlap: um(20_000), bottomFlap: um(28_000), lockOverlap: um(10_000), glueFlap: um(15_000), clearance: um(1_000) },
  "auto-lock-bottom": { width: um(60_000), depth: um(30_000), height: um(90_000), tuckFlap: um(20_000), bottomFlap: um(30_000), lockOverlap: um(12_000), glueFlap: um(15_000), clearance: um(1_000) },
  "box-with-lid": { width: um(170_000), depth: um(110_000), height: um(70_000), lidHeight: um(40_000), glueFlap: um(10_000), clearance: um(2_000) },
  "match-box": { width: um(70_000), depth: um(40_000), height: um(10_000), glueFlap: um(8_000), clearance: um(2_000) },
  "cake-slice-box": { width: um(140_000), height: um(40_000), lidHeight: um(25_000), glueFlap: um(10_000), clearance: um(2_000) },
};

function applyTemplate(draft: ProjectDocument, id: TemplateId): void {
  draft.template = { id, version: id === "tuck-end-carton" ? "2.0.0" : "1.0.0" };
  Object.assign(draft.parameters, templateDefaults[id]);
  draft.construction.glueAngleMilliDegrees = id === "tuck-end-carton" || id === "crash-lock-carton" || id === "auto-lock-bottom" ? 80_000 : 45_000;
  if (id === "cake-slice-box") draft.construction.sliceAngleMilliDegrees = 30_000;
}

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
  setTemplate: (id) => get().commit((draft) => { applyTemplate(draft, id); }),
  setName: (name) => get().commit((draft) => { draft.name = name.trim() || "Untitled carton"; }),
  setUnit: (unit) => get().commit((draft) => { draft.display.unit = unit; draft.display.precision = unit === "in" ? 3 : 1; }),
  setOpeningStyle: (value) => get().commit((draft) => { draft.construction.openingStyle = value; }),
  setTuckPanel: (value) => get().commit((draft) => { draft.construction.tuckPanel = value; }),
  setLockStyle: (value) => get().commit((draft) => { draft.construction.lockStyle = value; }),
  setGlueAngle: (value) => get().commit((draft) => { draft.construction.glueAngleMilliDegrees = Math.round(value * 1000); }),
  setDustTaper: (value) => get().commit((draft) => { draft.construction.dustTaperPercent = Math.round(value); }),
  setSliceAngle: (value) => get().commit((draft) => { draft.construction.sliceAngleMilliDegrees = Math.round(Math.max(15, Math.min(90, value)) * 1000); }),
  setMaterialThickness: (value) => get().commit((draft) => {
    const safeValue = um(Math.max(100, Math.min(10_000, value)));
    draft.material.thicknessUm = safeValue;
    draft.material.scoreAllowanceUm = estimateScoreAllowance(safeValue);
  }),
  setSheetPreset: (preset) => get().commit((draft) => {
    draft.sheet.preset = preset;
    if (preset !== "Custom") {
      const size = sheetPresets[preset]; draft.sheet.widthUm = um(size[0]); draft.sheet.heightUm = um(size[1]);
    }
  }),
  setCustomSheetSize: (width, height) => get().commit((draft) => {
    draft.sheet.preset = "Custom";
    draft.sheet.widthUm = um(Math.max(50_000, Math.min(2_000_000, width)));
    draft.sheet.heightUm = um(Math.max(50_000, Math.min(2_000_000, height)));
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
    const resetProject = produce(DEFAULT_PROJECT, (draft) => { applyTemplate(draft, current.template.id); });
    persist(resetProject); set((state) => ({ project: resetProject, past: [...state.past, current].slice(-50), future: [], savedAt: Date.now() }));
  },
}));

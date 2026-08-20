import Fraction from "fraction.js";
import { z } from "zod";
import {
  assertNetTopology, buildLockBottom, buildPanelBand, buildProfileTray, buildRectangularTray,
  type FoldConnection, type NetFace, type NetPart,
} from "./template-kernel";

export type Micrometres = number & { readonly __brand: "Micrometres" };
export type Unit = "mm" | "cm" | "in";
export type TemplateId = "tuck-end-carton" | "crash-lock-carton" | "auto-lock-bottom" | "box-with-lid" | "match-box" | "cake-slice-box";
export type ParameterId =
  | "width" | "depth" | "height" | "lidHeight"
  | "tuckFlap" | "dustFlap" | "glueFlap"
  | "thumbHole" | "cornerRadius" | "clearance"
  | "bottomFlap" | "lockOverlap";
export type LineRole =
  | "outer-cut" | "internal-cut" | "crease" | "perforation"
  | "glue-boundary" | "annotation";

export interface PointUm { x: Micrometres; y: Micrometres }
export type PathCommand =
  | { op: "move"; point: PointUm }
  | { op: "line"; point: PointUm }
  | { op: "arc"; center: PointUm; radiusUm: Micrometres; startMilliDegrees: number; sweepMilliDegrees: number }
  | { op: "close" };

export interface DielinePath {
  id: string;
  partId: string;
  role: LineRole;
  commands: PathCommand[];
  parameterRefs: ParameterId[];
  manufacturable: boolean;
}

export interface Anchor { id: string; point: PointUm }
export interface DimensionSpec {
  id: string;
  kind: "horizontal" | "vertical";
  startAnchorId: string;
  endAnchorId: string;
  parameterId: ParameterId;
  label: string;
  valueUm: Micrometres;
  offsetUm: Micrometres;
  dragDirection: "x" | "y";
  dragSign: 1 | -1;
}

export interface SceneWarning {
  id: string;
  severity: "info" | "warning" | "error";
  parameterIds: ParameterId[];
  pathIds?: string[];
  message: string;
  technicalDetails?: string;
}

export interface DielineScene {
  version: 2;
  paths: DielinePath[];
  anchors: Anchor[];
  dimensions: DimensionSpec[];
  parts?: readonly NetPart[];
  faces?: readonly NetFace[];
  foldGraph?: { connections: readonly FoldConnection[] };
  bounds: { minX: Micrometres; minY: Micrometres; maxX: Micrometres; maxY: Micrometres };
  warnings: SceneWarning[];
}

export interface ProjectDocument {
  schemaVersion: 6;
  engineVersion: "0.7.0";
  projectId: string;
  name: string;
  template: { id: TemplateId; version: "1.0.0" | "2.0.0" };
  parameters: Record<ParameterId, Micrometres>;
  construction: {
    openingStyle: "straight-tuck" | "reverse-tuck";
    tuckPanel: "front" | "back";
    lockStyle: "friction" | "slit-lock";
    glueAngleMilliDegrees: number;
    dustTaperPercent: number;
    sliceAngleMilliDegrees: number;
  };
  material: { thicknessUm: Micrometres; kerfUm: Micrometres; scoreAllowanceUm: Micrometres };
  sheet: {
    preset: "600x400" | "700x500" | "Custom";
    widthUm: Micrometres;
    heightUm: Micrometres;
    marginUm: Micrometres;
    orientation: "portrait" | "landscape" | "auto";
  };
  exportProfile: { creaseMode: "line" | "dash" | "perforation"; includeDimensions: boolean };
  display: { unit: Unit; precision: number };
}

export interface LayoutResult {
  fits: boolean;
  orientation: "portrait" | "landscape";
  sheetWidthUm: Micrometres;
  sheetHeightUm: Micrometres;
  contentWidthUm: Micrometres;
  contentHeightUm: Micrometres;
  utilization: number;
  suggestion?: string;
}

export const um = (value: number): Micrometres => {
  if (!Number.isSafeInteger(value)) throw new TypeError("Length must be a safe integer number of micrometres");
  return value as Micrometres;
};

export const PARAMETER_LIMITS: Record<ParameterId, readonly [number, number]> = {
  width: [20_000, 500_000], depth: [8_000, 300_000], height: [5_000, 700_000], lidHeight: [5_000, 300_000],
  tuckFlap: [4_000, 120_000], dustFlap: [4_000, 180_000], glueFlap: [5_000, 60_000],
  thumbHole: [2_000, 80_000], cornerRadius: [500, 40_000], clearance: [250, 5_000],
  bottomFlap: [6_000, 180_000], lockOverlap: [3_000, 60_000],
};

const parametersSchema = z.object({
  width: z.number().int().safe(), depth: z.number().int().safe(), height: z.number().int().safe(), lidHeight: z.number().int().safe(),
  tuckFlap: z.number().int().safe(), dustFlap: z.number().int().safe(), glueFlap: z.number().int().safe(),
  thumbHole: z.number().int().safe(), cornerRadius: z.number().int().safe(), clearance: z.number().int().safe(),
  bottomFlap: z.number().int().safe(), lockOverlap: z.number().int().safe(),
});

const projectSchema = z.object({
  schemaVersion: z.literal(6), engineVersion: z.literal("0.7.0"), projectId: z.string().min(1), name: z.string().min(1).max(120),
  template: z.object({ id: z.enum(["tuck-end-carton", "crash-lock-carton", "auto-lock-bottom", "box-with-lid", "match-box", "cake-slice-box"]), version: z.enum(["1.0.0", "2.0.0"]) }),
  parameters: parametersSchema,
  construction: z.object({
    openingStyle: z.enum(["straight-tuck", "reverse-tuck"]), tuckPanel: z.enum(["front", "back"]),
    lockStyle: z.enum(["friction", "slit-lock"]), glueAngleMilliDegrees: z.number().int().min(45_000).max(89_000),
    dustTaperPercent: z.number().int().min(0).max(40), sliceAngleMilliDegrees: z.number().int().min(15_000).max(90_000),
  }),
  material: z.object({ thicknessUm: z.number().int().min(100).max(10_000), kerfUm: z.number().int().safe(), scoreAllowanceUm: z.number().int().safe() }),
  sheet: z.object({
    preset: z.enum(["600x400", "700x500", "Custom"]), widthUm: z.number().int().min(50_000).max(2_000_000), heightUm: z.number().int().min(50_000).max(2_000_000),
    marginUm: z.number().int().safe(), orientation: z.enum(["portrait", "landscape", "auto"]),
  }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number().int().min(0).max(4) }),
});

const priorV5ParametersSchema = parametersSchema.omit({ bottomFlap: true, lockOverlap: true });
const priorConstructionSchema = z.object({
  openingStyle: z.enum(["straight-tuck", "reverse-tuck"]), tuckPanel: z.enum(["front", "back"]),
  lockStyle: z.enum(["friction", "slit-lock"]), glueAngleMilliDegrees: z.number().int().min(45_000).max(89_000),
  dustTaperPercent: z.number().int().min(0).max(40),
});
const priorV5ProjectSchema = z.object({
  schemaVersion: z.literal(5), engineVersion: z.literal("0.5.0"), projectId: z.string().min(1), name: z.string().min(1).max(120),
  template: z.object({ id: z.enum(["tuck-end-carton", "box-with-lid", "match-box"]), version: z.enum(["1.0.0", "2.0.0"]) }),
  parameters: priorV5ParametersSchema,
  construction: priorConstructionSchema,
  material: z.object({ thicknessUm: z.number().int().min(100).max(10_000), kerfUm: z.number().int().safe(), scoreAllowanceUm: z.number().int().safe() }),
  sheet: z.object({
    preset: z.enum(["600x400", "700x500", "Custom"]), widthUm: z.number().int().min(50_000).max(2_000_000), heightUm: z.number().int().min(50_000).max(2_000_000),
    marginUm: z.number().int().safe(), orientation: z.enum(["portrait", "landscape", "auto"]),
  }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number().int().min(0).max(4) }),
});

const priorV4ProjectSchema = z.object({
  schemaVersion: z.literal(4), engineVersion: z.literal("0.4.0"), projectId: z.string().min(1), name: z.string().min(1).max(120),
  template: z.object({ id: z.enum(["tuck-end-carton", "box-with-lid", "match-box"]), version: z.enum(["1.0.0", "2.0.0"]) }),
  parameters: priorV5ParametersSchema,
  construction: priorConstructionSchema,
  material: z.object({ thicknessUm: z.number().int().min(100).max(10_000), kerfUm: z.number().int().safe(), scoreAllowanceUm: z.number().int().safe() }),
  sheet: z.object({
    preset: z.enum(["600x400", "700x500", "Custom"]), widthUm: z.number().int().min(50_000).max(2_000_000), heightUm: z.number().int().min(50_000).max(2_000_000),
    marginUm: z.number().int().safe(), orientation: z.enum(["portrait", "landscape", "auto"]),
  }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number().int().min(0).max(4) }),
});

const priorV3ParametersSchema = priorV5ParametersSchema.omit({ lidHeight: true });
const priorV3ProjectSchema = z.object({
  schemaVersion: z.literal(3), engineVersion: z.literal("0.3.0"), projectId: z.string().min(1), name: z.string().min(1).max(120),
  template: z.object({ id: z.literal("tuck-end-carton"), version: z.literal("2.0.0") }),
  parameters: priorV3ParametersSchema,
  construction: z.object({
    openingStyle: z.enum(["straight-tuck", "reverse-tuck"]), tuckPanel: z.enum(["front", "back"]),
    lockStyle: z.enum(["friction", "slit-lock"]), glueAngleMilliDegrees: z.number().int(), dustTaperPercent: z.number().int(),
  }),
  material: z.object({ thicknessUm: z.number().int(), kerfUm: z.number().int(), scoreAllowanceUm: z.number().int() }),
  sheet: z.object({
    preset: z.enum(["600x400", "700x500", "Custom"]), widthUm: z.number().int(), heightUm: z.number().int(),
    marginUm: z.number().int(), orientation: z.enum(["portrait", "landscape", "auto"]),
  }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number().int() }),
});

const priorV2ProjectSchema = z.object({
  schemaVersion: z.literal(2), engineVersion: z.literal("0.2.0"), projectId: z.string().min(1), name: z.string().min(1).max(120),
  template: z.object({ id: z.literal("tuck-end-carton"), version: z.literal("2.0.0") }),
  parameters: priorV3ParametersSchema,
  construction: z.object({
    openingStyle: z.enum(["straight-tuck", "reverse-tuck"]), tuckPanel: z.enum(["front", "back"]),
    lockStyle: z.enum(["friction", "slit-lock"]), glueAngleMilliDegrees: z.number().int(), dustTaperPercent: z.number().int(),
  }),
  material: z.object({ thicknessUm: z.number().int(), kerfUm: z.number().int(), scoreAllowanceUm: z.number().int() }),
  sheet: z.object({
    preset: z.enum(["A4", "A3", "Letter", "Custom"]), widthUm: z.number().int(), heightUm: z.number().int(),
    marginUm: z.number().int(), orientation: z.enum(["portrait", "landscape", "auto"]),
  }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number().int() }),
});

const legacyProjectSchema = z.object({
  schemaVersion: z.literal(1), projectId: z.string(), name: z.string(),
  parameters: z.object({ width: z.number(), depth: z.number(), height: z.number(), glueFlap: z.number() }),
  material: z.object({ thicknessUm: z.number(), kerfUm: z.number(), scoreAllowanceUm: z.number() }),
  sheet: z.object({ preset: z.enum(["A4", "A3", "Letter", "Custom"]), widthUm: z.number(), heightUm: z.number(), marginUm: z.number(), orientation: z.enum(["portrait", "landscape", "auto"]) }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number() }),
}).passthrough();

export const DEFAULT_PROJECT: ProjectDocument = {
  schemaVersion: 6, engineVersion: "0.7.0", projectId: "project-tuck-carton-001", name: "Untitled carton",
  template: { id: "tuck-end-carton", version: "2.0.0" },
  parameters: {
    width: um(60_000), depth: um(30_000), height: um(90_000), lidHeight: um(40_000), tuckFlap: um(20_000), dustFlap: um(25_000),
    glueFlap: um(15_000), thumbHole: um(10_000), cornerRadius: um(8_000), clearance: um(1_000),
    bottomFlap: um(28_000), lockOverlap: um(10_000),
  },
  construction: { openingStyle: "reverse-tuck", tuckPanel: "front", lockStyle: "slit-lock", glueAngleMilliDegrees: 80_000, dustTaperPercent: 20, sliceAngleMilliDegrees: 30_000 },
  material: { thicknessUm: um(500), kerfUm: um(150), scoreAllowanceUm: um(650) },
  sheet: { preset: "600x400", widthUm: um(600_000), heightUm: um(400_000), marginUm: um(8_000), orientation: "auto" },
  exportProfile: { creaseMode: "dash", includeDimensions: false }, display: { unit: "mm", precision: 1 },
};

export function validateProject(value: unknown): ProjectDocument {
  const current = projectSchema.safeParse(value);
  if (current.success) return current.data as ProjectDocument;
  const priorV5 = priorV5ProjectSchema.safeParse(value);
  if (priorV5.success) return projectSchema.parse({
    ...priorV5.data, schemaVersion: 6, engineVersion: "0.7.0",
    parameters: { ...priorV5.data.parameters, bottomFlap: DEFAULT_PROJECT.parameters.bottomFlap, lockOverlap: DEFAULT_PROJECT.parameters.lockOverlap },
    construction: { ...priorV5.data.construction, sliceAngleMilliDegrees: DEFAULT_PROJECT.construction.sliceAngleMilliDegrees },
  }) as ProjectDocument;
  const priorV4 = priorV4ProjectSchema.safeParse(value);
  if (priorV4.success) return projectSchema.parse({
    ...priorV4.data, schemaVersion: 6, engineVersion: "0.7.0",
    parameters: { ...priorV4.data.parameters, bottomFlap: DEFAULT_PROJECT.parameters.bottomFlap, lockOverlap: DEFAULT_PROJECT.parameters.lockOverlap },
    construction: {
      ...priorV4.data.construction,
      glueAngleMilliDegrees: priorV4.data.template.id === "tuck-end-carton" ? priorV4.data.construction.glueAngleMilliDegrees : 45_000,
      sliceAngleMilliDegrees: DEFAULT_PROJECT.construction.sliceAngleMilliDegrees,
    },
  }) as ProjectDocument;
  const priorV3 = priorV3ProjectSchema.safeParse(value);
  if (priorV3.success) return projectSchema.parse({
    ...priorV3.data, schemaVersion: 6, engineVersion: "0.7.0",
    parameters: { ...priorV3.data.parameters, lidHeight: DEFAULT_PROJECT.parameters.lidHeight, bottomFlap: DEFAULT_PROJECT.parameters.bottomFlap, lockOverlap: DEFAULT_PROJECT.parameters.lockOverlap },
    construction: { ...priorV3.data.construction, sliceAngleMilliDegrees: DEFAULT_PROJECT.construction.sliceAngleMilliDegrees },
  }) as ProjectDocument;
  const prior = priorV2ProjectSchema.safeParse(value);
  if (prior.success) return projectSchema.parse({
    ...prior.data,
    schemaVersion: 6,
    engineVersion: "0.7.0",
    parameters: { ...prior.data.parameters, lidHeight: DEFAULT_PROJECT.parameters.lidHeight, bottomFlap: DEFAULT_PROJECT.parameters.bottomFlap, lockOverlap: DEFAULT_PROJECT.parameters.lockOverlap },
    construction: { ...prior.data.construction, sliceAngleMilliDegrees: DEFAULT_PROJECT.construction.sliceAngleMilliDegrees },
    sheet: { ...DEFAULT_PROJECT.sheet, marginUm: prior.data.sheet.marginUm, orientation: prior.data.sheet.orientation },
    material: { ...prior.data.material, scoreAllowanceUm: estimateScoreAllowance(um(prior.data.material.thicknessUm)) },
  }) as ProjectDocument;
  const legacy = legacyProjectSchema.safeParse(value);
  if (!legacy.success) return projectSchema.parse(value) as ProjectDocument;
  return projectSchema.parse({
    ...DEFAULT_PROJECT, projectId: legacy.data.projectId, name: legacy.data.name,
    parameters: {
      ...DEFAULT_PROJECT.parameters, width: legacy.data.parameters.width, depth: legacy.data.parameters.depth,
      height: legacy.data.parameters.height, glueFlap: legacy.data.parameters.glueFlap,
    },
    material: { ...legacy.data.material, scoreAllowanceUm: estimateScoreAllowance(um(legacy.data.material.thicknessUm)) },
    exportProfile: legacy.data.exportProfile, display: legacy.data.display,
  }) as ProjectDocument;
}

const UNIT_TO_UM: Record<Unit, number> = { mm: 1_000, cm: 10_000, in: 25_400 };

export function parseMeasurement(raw: string, fallbackUnit: Unit): { ok: true; value: Micrometres } | { ok: false; message: string } {
  const normalized = raw.trim().toLowerCase().replace(/[“”]/g, '"');
  const unitMatch = normalized.match(/\s*(mm|cm|in|")\s*$/);
  const unit: Unit = unitMatch?.[1] === '"' ? "in" : (unitMatch?.[1] as Unit | undefined) ?? fallbackUnit;
  const numeric = unitMatch ? normalized.slice(0, unitMatch.index).trim() : normalized;
  if (!numeric) return { ok: false, message: "Enter a measurement" };
  try {
    const mixed = numeric.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
    const fraction = mixed ? new Fraction(Number(mixed[1])).add(new Fraction(Number(mixed[2]), Number(mixed[3]))) : new Fraction(numeric);
    const result = Math.round(fraction.valueOf() * UNIT_TO_UM[unit]);
    if (!Number.isSafeInteger(result) || result <= 0) return { ok: false, message: "Use a positive, practical measurement" };
    return { ok: true, value: um(result) };
  } catch { return { ok: false, message: "Try 80 mm, 3.25 in, or 3 1/4 in" }; }
}

export function formatMeasurement(value: Micrometres, unit: Unit, precision = 1): string {
  return `${(value / UNIT_TO_UM[unit]).toFixed(unit === "in" ? Math.max(2, precision) : precision)} ${unit}`;
}

/** Planning estimate only; converting plants should confirm the crease rule/channel combination for the selected stock. */
export function estimateScoreAllowance(thicknessUm: Micrometres): Micrometres {
  return um(Math.max(300, Math.round((thicknessUm * 1.25) / 50) * 50));
}

const point = (x: number, y: number): PointUm => ({ x: um(Math.round(x)), y: um(Math.round(y)) });
const move = (x: number, y: number): PathCommand => ({ op: "move", point: point(x, y) });
const line = (x: number, y: number): PathCommand => ({ op: "line", point: point(x, y) });
const arc = (cx: number, cy: number, radius: number, start: number, sweep: number): PathCommand => ({
  op: "arc", center: point(cx, cy), radiusUm: um(Math.round(radius)), startMilliDegrees: start, sweepMilliDegrees: sweep,
});
const semanticPath = (id: string, role: LineRole, refs: ParameterId[], commands: PathCommand[]): DielinePath => ({
  id, partId: "body", role, parameterRefs: refs, manufacturable: role !== "annotation" && role !== "glue-boundary", commands,
});
const partPath = (partId: string, id: string, role: LineRole, refs: ParameterId[], commands: PathCommand[]): DielinePath => ({
  id, partId, role, parameterRefs: refs, manufacturable: role !== "annotation" && role !== "glue-boundary", commands,
});
const linePath = (id: string, role: LineRole, refs: ParameterId[], a: [number, number], b: [number, number]): DielinePath => semanticPath(id, role, refs, [move(...a), line(...b)]);

function arcPoint(command: Extract<PathCommand, { op: "arc" }>, atEnd: boolean): PointUm {
  const angle = ((command.startMilliDegrees + (atEnd ? command.sweepMilliDegrees : 0)) / 1000) * Math.PI / 180;
  return point(command.center.x + command.radiusUm * Math.cos(angle), command.center.y + command.radiusUm * Math.sin(angle));
}

function createTuckClosure(id: string, xStart: number, xEnd: number, baseY: number, direction: -1 | 1, project: ProjectDocument): DielinePath[] {
  const { depth, tuckFlap, clearance, cornerRadius } = project.parameters;
  const caliper = project.material.thicknessUm;
  const closingDepth = depth + caliper;
  const tongueBaseY = baseY + direction * closingDepth;
  const tipY = tongueBaseY + direction * tuckFlap;
  const sideInset = clearance;
  const tongueInset = clearance + caliper * 2;
  const tongueLeft = xStart + tongueInset;
  const tongueRight = xEnd - tongueInset;
  const maxRadius = Math.max(500, Math.min(tuckFlap, (tongueRight - tongueLeft) / 2) - 250);
  const radius = Math.max(500, Math.min(cornerRadius, maxRadius));
  const arcCenterY = tipY - direction * radius;
  const quarterSweep = direction === -1 ? 90_000 : -90_000;
  const cutCommands: PathCommand[] = [
    move(xStart, baseY), line(xStart + sideInset, baseY + direction * sideInset), line(xStart + sideInset, tongueBaseY),
    line(tongueLeft, tongueBaseY), line(tongueLeft, tipY - direction * radius),
    arc(tongueLeft + radius, arcCenterY, radius, 180_000, quarterSweep),
    line(tongueRight - radius, tipY),
    arc(tongueRight - radius, arcCenterY, radius, direction === -1 ? 270_000 : 90_000, quarterSweep),
    line(tongueRight, tongueBaseY), line(xEnd - sideInset, tongueBaseY),
    line(xEnd - sideInset, baseY + direction * sideInset), line(xEnd, baseY),
  ];
  const result = [
    semanticPath(`${id}.cut.outer`, "outer-cut", ["width", "depth", "tuckFlap", "cornerRadius", "clearance"], cutCommands),
    linePath(`${id}.fold.closing`, "crease", ["depth", "clearance"], [xStart + clearance / 2, baseY], [xEnd - clearance / 2, baseY]),
    linePath(`${id}.fold.tuck`, "crease", ["tuckFlap", "clearance"], [tongueLeft, tongueBaseY], [tongueRight, tongueBaseY]),
  ];
  if (project.construction.lockStyle === "slit-lock") {
    const lockDepth = Math.max(800, Math.min(2_500, clearance + caliper));
    result.push(
      semanticPath(`${id}.lock.left.cut`, "internal-cut", ["clearance", "tuckFlap"], [move(xStart + sideInset, tongueBaseY), line(tongueLeft, tongueBaseY), line(tongueLeft, tongueBaseY + direction * lockDepth)]),
      semanticPath(`${id}.lock.right.cut`, "internal-cut", ["clearance", "tuckFlap"], [move(xEnd - sideInset, tongueBaseY), line(tongueRight, tongueBaseY), line(tongueRight, tongueBaseY + direction * lockDepth)]),
    );
  }
  return result;
}

function createReceivingEdge(id: string, xStart: number, xEnd: number, baseY: number, direction: -1 | 1, project: ProjectDocument): DielinePath[] {
  const { thumbHole } = project.parameters;
  const radius = Math.max(1_000, Math.min(thumbHole / 2, (xEnd - xStart) / 4));
  const centerX = (xStart + xEnd) / 2;
  const sweep = direction === -1 ? -180_000 : 180_000;
  return [semanticPath(`${id}.receiving-edge.cut`, "outer-cut", ["width", "thumbHole", "clearance"], [
    move(xStart, baseY), line(centerX - radius, baseY), arc(centerX, baseY, radius, 180_000, sweep), line(xEnd, baseY),
  ])];
}

function createDustFlap(id: string, xStart: number, xEnd: number, baseY: number, direction: -1 | 1, project: ProjectDocument): DielinePath[] {
  const { dustFlap, clearance } = project.parameters;
  const caliper = project.material.thicknessUm;
  const panelWidth = xEnd - xStart;
  const taperInset = Math.min(panelWidth * project.construction.dustTaperPercent / 100, panelWidth / 2 - clearance);
  const relief = Math.max(clearance, caliper * 1.5);
  const tipY = baseY + direction * dustFlap;
  return [
    semanticPath(`${id}.dust-flap.cut`, "outer-cut", ["depth", "dustFlap", "clearance"], [
      move(xStart, baseY), line(xStart + clearance, baseY + direction * relief), line(xStart + taperInset, tipY),
      line(xEnd - taperInset, tipY), line(xEnd - clearance, baseY + direction * relief), line(xEnd, baseY),
    ]),
    linePath(`${id}.dust-flap.fold`, "crease", ["depth", "clearance"], [xStart + clearance / 2, baseY], [xEnd - clearance / 2, baseY]),
  ];
}

function createGlueFlap(xOuter: number, xFold: number, topY: number, bottomY: number, project: ProjectDocument): DielinePath[] {
  const { glueFlap, clearance } = project.parameters;
  const angle = project.construction.glueAngleMilliDegrees / 1000 * Math.PI / 180;
  const rise = Math.min((bottomY - topY) / 3, glueFlap / Math.tan(angle));
  const glueInset = Math.max(clearance, 1_500);
  return [
    semanticPath("body.glue-flap.cut.outer", "outer-cut", ["glueFlap", "height"], [move(xFold, topY), line(xOuter, topY + rise), line(xOuter, bottomY - rise), line(xFold, bottomY)]),
    linePath("body.glue-flap.fold", "crease", ["glueFlap", "height"], [xFold, topY + clearance / 2], [xFold, bottomY - clearance / 2]),
    semanticPath("body.glue-flap.area", "glue-boundary", ["glueFlap", "clearance"], [move(xOuter + glueInset, topY + rise + glueInset), line(xFold - glueInset, topY + glueInset), line(xFold - glueInset, bottomY - glueInset), line(xOuter + glueInset, bottomY - rise - glueInset), { op: "close" }]),
  ];
}

export function validateParameters(project: ProjectDocument): SceneWarning[] {
  const issues: SceneWarning[] = [];
  const p = project.parameters;
  const lockBottom = project.template.id === "crash-lock-carton" || project.template.id === "auto-lock-bottom";
  const cartonBand = project.template.id === "tuck-end-carton" || lockBottom;
  const activeParameters: ParameterId[] = lockBottom
    ? ["width", "depth", "height", "tuckFlap", "glueFlap", "thumbHole", "cornerRadius", "clearance", "bottomFlap", "lockOverlap"]
    : project.template.id === "tuck-end-carton"
      ? ["width", "depth", "height", "tuckFlap", "dustFlap", "glueFlap", "thumbHole", "cornerRadius", "clearance"]
      : project.template.id === "box-with-lid"
        ? ["width", "depth", "height", "lidHeight", "glueFlap", "clearance"]
        : project.template.id === "cake-slice-box"
          ? ["width", "height", "lidHeight", "glueFlap", "clearance"]
          : ["width", "depth", "height", "glueFlap", "clearance"];
  activeParameters.forEach((id) => {
    const [min, max] = PARAMETER_LIMITS[id];
    if (p[id] < min || p[id] > max) issues.push({ id: `parameter.${id}.range`, severity: "error", parameterIds: [id], message: `${PARAMETER_LABELS[id]} must be between ${min / 1000} and ${max / 1000} mm.` });
  });
  if (!cartonBand) {
    if (p.glueFlap > Math.min(p.height, project.template.id === "match-box" ? p.height : p.lidHeight) * .85) issues.push({ id: "tray.corner-tab.excessive", severity: "error", parameterIds: ["glueFlap", "height"], message: "Corner glue tabs exceed the available wall height.", technicalDetails: "Keep the glue tab below 85% of the shortest wall." });
    if (p.clearance < project.material.thicknessUm) issues.push({ id: "mating.clearance-below-caliper", severity: "warning", parameterIds: ["clearance"], message: "Mating clearance is smaller than board caliper.", technicalDetails: "The lid or sleeve may bind after folding." });
    if (project.template.id === "box-with-lid" && p.lidHeight > Math.min(p.width, p.depth) * .6) issues.push({ id: "lid.wall-depth.excessive", severity: "warning", parameterIds: ["lidHeight"], message: "The lid wall is unusually deep for this box profile." });
    if (project.template.id === "cake-slice-box") {
      if (project.construction.sliceAngleMilliDegrees < 20_000) issues.push({ id: "cake.tip-angle.sharp", severity: "warning", parameterIds: ["width", "clearance"], message: "The slice tip is very acute for a covered tray.", technicalDetails: "A sharp lid offset creates a long miter at the tip; prototype the fit before production." });
      const rearWidth = 2 * p.width * Math.sin(project.construction.sliceAngleMilliDegrees / 2000 * Math.PI / 180);
      if (p.glueFlap * 2 > rearWidth) issues.push({ id: "cake.rear-tabs.overlap", severity: "error", parameterIds: ["glueFlap", "width"], message: "Rear corner tabs overlap across the slice width.", technicalDetails: `Available rear edge is ${(rearWidth / 1000).toFixed(2)} mm.` });
    }
    return issues;
  }
  const tongueWidth = p.width - 2 * (p.clearance + project.material.thicknessUm * 2);
  if (tongueWidth <= p.cornerRadius * 2) issues.push({ id: "tuck-tongue.radius-overlap", severity: "error", parameterIds: ["cornerRadius", "clearance", "width"], pathIds: ["top.front.tuck.cut.outer"], message: "Corner radius leaves no straight section on the tuck tongue.", technicalDetails: `Available tongue width is ${(tongueWidth / 1000).toFixed(2)} mm.` });
  if (p.tuckFlap > p.width * .55) issues.push({ id: "tuck-tongue.excessive-depth", severity: "warning", parameterIds: ["tuckFlap", "width"], message: "The tuck tongue is unusually deep for this panel.", technicalDetails: "Keep tuck depth at or below 55% of the panel width for predictable insertion." });
  if (p.dustFlap * 2 > p.width - p.clearance * 2) issues.push({ id: "dust-flaps.overlap", severity: "error", parameterIds: ["dustFlap", "width", "clearance"], pathIds: ["top.side-a.dust-flap.cut", "top.side-b.dust-flap.cut"], message: "Opposing dust flaps overlap past the centerline.", technicalDetails: `Maximum dust flap depth is ${((p.width - p.clearance * 2) / 2000).toFixed(2)} mm.` });
  if (p.thumbHole > p.width * .45) issues.push({ id: "receiving-edge.thumb-hole-too-large", severity: "error", parameterIds: ["thumbHole", "width"], message: "Thumb notch removes too much of the receiving edge." });
  if (p.glueFlap > Math.min(p.width, p.depth) * .7) issues.push({ id: "glue-flap.excessive", severity: "error", parameterIds: ["glueFlap"], pathIds: ["body.glue-flap.cut.outer"], message: "Glue flap is too wide for the adjoining panel." });
  if (p.clearance < project.material.thicknessUm) issues.push({ id: "construction.clearance-below-caliper", severity: "warning", parameterIds: ["clearance"], message: "Flap clearance is smaller than board thickness.", technicalDetails: "Increase clearance to reduce binding at the tuck and dust-flap shoulders." });
  if (lockBottom) {
    if (p.bottomFlap < p.depth * .65) issues.push({ id: "lock-bottom.insufficient-depth", severity: "error", parameterIds: ["bottomFlap", "depth"], message: "Lock-bottom flaps are too shallow to close the base.", technicalDetails: "Use at least 65% of the finished depth." });
    if (p.bottomFlap > p.width * .58) issues.push({ id: "lock-bottom.excessive-depth", severity: "warning", parameterIds: ["bottomFlap", "width"], message: "Lock-bottom flaps are unusually deep for the major panel." });
    if (p.lockOverlap >= Math.min(p.width, p.depth) * .45) issues.push({ id: "lock-bottom.overlap-excessive", severity: "error", parameterIds: ["lockOverlap", "width", "depth"], message: "Lock overlap removes too much working flap width." });
  }
  return issues;
}

function calculateBounds(paths: DielinePath[]): DielineScene["bounds"] {
  const points: PointUm[] = [];
  for (const pathValue of paths.filter((candidate) => candidate.manufacturable)) {
    for (const command of pathValue.commands) {
      if (command.op === "move" || command.op === "line") points.push(command.point);
      if (command.op === "arc") {
        points.push(arcPoint(command, false), arcPoint(command, true));
        for (const angle of [0, 90, 180, 270]) {
          const start = command.startMilliDegrees / 1000;
          const sweep = command.sweepMilliDegrees / 1000;
          const normalized = ((angle - start) % 360 + 360) % 360;
          const inside = sweep >= 0 ? normalized <= sweep : ((start - angle) % 360 + 360) % 360 <= -sweep;
          if (inside) points.push(point(command.center.x + command.radiusUm * Math.cos(angle * Math.PI / 180), command.center.y + command.radiusUm * Math.sin(angle * Math.PI / 180)));
        }
      }
    }
  }
  return { minX: um(Math.min(...points.map((p) => p.x))), minY: um(Math.min(...points.map((p) => p.y))), maxX: um(Math.max(...points.map((p) => p.x))), maxY: um(Math.max(...points.map((p) => p.y))) };
}

function generateCartonBand(project: ProjectDocument, bottomStyle: "tuck" | "crash-lock" | "auto-lock"): DielineScene {
  const { width: w, depth: d, height: h, glueFlap: g, tuckFlap: tuck } = project.parameters;
  const closureDepth = d + project.material.thicknessUm;
  const top = closureDepth + tuck;
  const bottom = top + h;
  const x0 = 0, x1 = g, x2 = x1 + w, x3 = x2 + d, x4 = x3 + w, x5 = x4 + d;
  const front = [x1, x2] as const, back = [x3, x4] as const;
  const topTuck = project.construction.tuckPanel === "front" ? front : back;
  const topReceive = project.construction.tuckPanel === "front" ? back : front;
  const bottomUsesFront = project.construction.openingStyle === "straight-tuck"
    ? project.construction.tuckPanel === "front"
    : project.construction.tuckPanel !== "front";
  const bottomTuck = bottomUsesFront ? front : back;
  const bottomReceive = bottomUsesFront ? back : front;
  const panelName = (span: readonly [number, number]) => span[0] === front[0] ? "front" : "back";
  const band = buildPanelBand({
    id: "body",
    origin: point(x1, top),
    heightUm: h,
    heightParameter: "height",
    panels: [
      { id: "panel.front", widthUm: w, widthParameter: "width", foldAfterPathId: "body.panel.front.fold.right" },
      { id: "panel.side-a", widthUm: d, widthParameter: "depth", foldAfterPathId: "body.panel.side-a.fold.right" },
      { id: "panel.back", widthUm: w, widthParameter: "width", foldAfterPathId: "body.panel.back.fold.right" },
      { id: "panel.side-b", widthUm: d, widthParameter: "depth" },
    ],
    rightFreeEdgePathId: "body.side-b.free-edge.cut",
  });

  const lockBottom = bottomStyle === "tuck" ? undefined : buildLockBottom({
    id: `bottom.${bottomStyle}`,
    partId: "body",
    baseYUm: um(bottom),
    direction: 1,
    style: bottomStyle,
    panels: [
      { id: "front", faceId: "body.panel.front", xStartUm: um(x1), xEndUm: um(x2), widthParameter: "width", kind: "major" },
      { id: "side-a", faceId: "body.panel.side-a", xStartUm: um(x2), xEndUm: um(x3), widthParameter: "depth", kind: "minor" },
      { id: "back", faceId: "body.panel.back", xStartUm: um(x3), xEndUm: um(x4), widthParameter: "width", kind: "major" },
      { id: "side-b", faceId: "body.panel.side-b", xStartUm: um(x4), xEndUm: um(x5), widthParameter: "depth", kind: "minor" },
    ],
    flapDepthUm: project.parameters.bottomFlap,
    overlapUm: project.parameters.lockOverlap,
    clearanceUm: project.parameters.clearance,
  });

  const paths: DielinePath[] = [
    ...createGlueFlap(x0, x1, top, bottom, project),
    ...band.paths,
    ...createTuckClosure(`top.${panelName(topTuck)}.tuck`, topTuck[0], topTuck[1], top, -1, project),
    ...createReceivingEdge(`top.${panelName(topReceive)}`, topReceive[0], topReceive[1], top, -1, project),
    ...createDustFlap("top.side-a", x2, x3, top, -1, project),
    ...createDustFlap("top.side-b", x4, x5, top, -1, project),
    ...(lockBottom ? lockBottom.paths : [
      ...createTuckClosure(`bottom.${panelName(bottomTuck)}.tuck`, bottomTuck[0], bottomTuck[1], bottom, 1, project),
      ...createReceivingEdge(`bottom.${panelName(bottomReceive)}`, bottomReceive[0], bottomReceive[1], bottom, 1, project),
      ...createDustFlap("bottom.side-a", x2, x3, bottom, 1, project),
      ...createDustFlap("bottom.side-b", x4, x5, bottom, 1, project),
    ]),
  ];
  const topTuckTipY = top - closureDepth - tuck;
  const topTuckBaseY = top - closureDepth;
  const anchors: Anchor[] = [
    { id: "front.top-left", point: point(x1, top) }, { id: "front.top-right", point: point(x2, top) },
    { id: "body.right-top", point: point(x5, top) }, { id: "body.right-bottom", point: point(x5, bottom) },
    { id: "side.top-left", point: point(x2, top) }, { id: "side.top-right", point: point(x3, top) },
    { id: "glue.top-left", point: point(x0, top) }, { id: "glue.top-right", point: point(x1, top) },
    { id: "tuck.fold", point: point((topTuck[0] + topTuck[1]) / 2, topTuckBaseY) },
    { id: "tuck.tip", point: point((topTuck[0] + topTuck[1]) / 2, topTuckTipY) },
    ...(lockBottom ? [
      { id: "bottom-lock.fold", point: point((x1 + x2) / 2, bottom) },
      { id: "bottom-lock.tip", point: point((x1 + x2) / 2, bottom + project.parameters.bottomFlap) },
    ] : []),
  ];
  const dimensions: DimensionSpec[] = [
    { id: "dimension.finished-width", kind: "horizontal", startAnchorId: "front.top-left", endAnchorId: "front.top-right", parameterId: "width", label: "Width", valueUm: w, offsetUm: um(-12_000), dragDirection: "x", dragSign: 1 },
    { id: "dimension.finished-depth", kind: "horizontal", startAnchorId: "side.top-left", endAnchorId: "side.top-right", parameterId: "depth", label: "Depth", valueUm: d, offsetUm: um(-9_000), dragDirection: "x", dragSign: 1 },
    { id: "dimension.finished-height", kind: "vertical", startAnchorId: "body.right-top", endAnchorId: "body.right-bottom", parameterId: "height", label: "Height", valueUm: h, offsetUm: um(14_000), dragDirection: "y", dragSign: 1 },
    { id: "dimension.glue-flap", kind: "horizontal", startAnchorId: "glue.top-left", endAnchorId: "glue.top-right", parameterId: "glueFlap", label: "Glue flap", valueUm: g, offsetUm: um(10_000), dragDirection: "x", dragSign: 1 },
    { id: "dimension.tuck-flap", kind: "vertical", startAnchorId: "tuck.fold", endAnchorId: "tuck.tip", parameterId: "tuckFlap", label: "Tuck tongue", valueUm: tuck, offsetUm: um(-14_000), dragDirection: "y", dragSign: -1 },
    ...(lockBottom ? [{ id: "dimension.bottom-flap", kind: "vertical" as const, startAnchorId: "bottom-lock.fold", endAnchorId: "bottom-lock.tip", parameterId: "bottomFlap" as const, label: "Bottom flap", valueUm: project.parameters.bottomFlap, offsetUm: um(15_000), dragDirection: "y" as const, dragSign: 1 as const }] : []),
  ];
  const faces = [...band.faces, ...(lockBottom?.faces ?? [])];
  const folds = [...band.folds, ...(lockBottom?.folds ?? [])];
  const part: NetPart = { ...band.part, faceIds: faces.map((face) => face.id) };
  assertNetTopology([part], faces, folds);
  const scene: DielineScene = {
    version: 2, paths, anchors, dimensions, parts: [part], faces,
    foldGraph: { connections: folds }, bounds: calculateBounds(paths), warnings: validateParameters(project),
  };
  assertSceneIntegrity(scene);
  return scene;
}

export function generateTuckCarton(project: ProjectDocument): DielineScene {
  return generateCartonBand(project, "tuck");
}

export function generateCrashLockCarton(project: ProjectDocument): DielineScene {
  return generateCartonBand(project, "crash-lock");
}

export function generateAutoLockCarton(project: ProjectDocument): DielineScene {
  return generateCartonBand(project, "auto-lock");
}

export function generateBoxWithLid(project: ProjectDocument): DielineScene {
  const p = project.parameters;
  const base = buildRectangularTray({
    id: "base", role: "base", origin: point(p.height, p.height), lengthUm: p.width, widthUm: p.depth,
    wallHeightUm: p.height, glueFlapUm: p.glueFlap, glueAngleMilliDegrees: project.construction.glueAngleMilliDegrees,
    lengthParameter: "width", widthParameter: "depth", heightParameter: "height",
  });
  const matingAllowance = project.material.thicknessUm * 2 + p.clearance * 2;
  const lidLength = um(Math.round(p.width + matingAllowance));
  const lidWidth = um(Math.round(p.depth + matingAllowance));
  const gap = 15_000;
  const lidLeft = base.outerWidthUm + gap;
  const lid = buildRectangularTray({
    id: "lid", role: "lid", origin: point(lidLeft + p.lidHeight, p.lidHeight), lengthUm: lidLength, widthUm: lidWidth,
    wallHeightUm: p.lidHeight, glueFlapUm: p.glueFlap, glueAngleMilliDegrees: project.construction.glueAngleMilliDegrees,
    lengthParameter: "width", widthParameter: "depth", heightParameter: "lidHeight",
  });
  const baseX0 = p.height, baseY0 = p.height, baseX1 = baseX0 + p.width, baseY1 = baseY0 + p.depth;
  const lidX0 = lidLeft + p.lidHeight, lidY0 = p.lidHeight;
  const anchors: Anchor[] = [
    { id: "base.length.left", point: point(baseX0, baseY0) }, { id: "base.length.right", point: point(baseX1, baseY0) },
    { id: "base.width.top", point: point(baseX1, baseY0) }, { id: "base.width.bottom", point: point(baseX1, baseY1) },
    { id: "base.wall.outer", point: point(baseX0, 0) }, { id: "base.wall.fold", point: point(baseX0, baseY0) },
    { id: "lid.wall.outer", point: point(lidX0, 0) }, { id: "lid.wall.fold", point: point(lidX0, lidY0) },
  ];
  const dimensions: DimensionSpec[] = [
    { id: "dimension.finished-width", kind: "horizontal", startAnchorId: "base.length.left", endAnchorId: "base.length.right", parameterId: "width", label: "Length", valueUm: p.width, offsetUm: um(-13_000), dragDirection: "x", dragSign: 1 },
    { id: "dimension.finished-depth", kind: "vertical", startAnchorId: "base.width.top", endAnchorId: "base.width.bottom", parameterId: "depth", label: "Width", valueUm: p.depth, offsetUm: um(15_000), dragDirection: "y", dragSign: 1 },
    { id: "dimension.base-height", kind: "vertical", startAnchorId: "base.wall.outer", endAnchorId: "base.wall.fold", parameterId: "height", label: "Base height", valueUm: p.height, offsetUm: um(-15_000), dragDirection: "y", dragSign: 1 },
    { id: "dimension.lid-height", kind: "vertical", startAnchorId: "lid.wall.outer", endAnchorId: "lid.wall.fold", parameterId: "lidHeight", label: "Lid height", valueUm: p.lidHeight, offsetUm: um(-15_000), dragDirection: "y", dragSign: 1 },
  ];
  const paths = [...base.paths, ...lid.paths];
  const scene: DielineScene = {
    version: 2, paths, anchors, dimensions, parts: [base.part, lid.part], faces: [...base.faces, ...lid.faces],
    foldGraph: { connections: [...base.folds, ...lid.folds] }, bounds: calculateBounds(paths), warnings: validateParameters(project),
  };
  assertSceneIntegrity(scene);
  return scene;
}

function translateProfile(profile: readonly PointUm[], dx: number, dy: number): PointUm[] {
  return profile.map((value) => point(value.x + dx, value.y + dy));
}

/** Uniform convex-polygon offset used to derive a mating lid from one nominal profile. */
export function offsetConvexProfile(profile: readonly PointUm[], distanceUm: Micrometres): PointUm[] {
  if (profile.length < 3 || distanceUm <= 0) throw new Error("A profile offset needs a positive distance and at least three vertices");
  const area2 = profile.reduce((sum, current, index) => {
    const next = profile[(index + 1) % profile.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0);
  if (Math.abs(area2) < 1) throw new Error("Cannot offset a degenerate profile");
  const orientation = area2 > 0 ? 1 : -1;
  const offsetLines = profile.map((current, index) => {
    const next = profile[(index + 1) % profile.length]!;
    const dx = next.x - current.x, dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) throw new Error("Cannot offset a zero-length profile edge");
    const nx = orientation > 0 ? dy / length : -dy / length;
    const ny = orientation > 0 ? -dx / length : dx / length;
    return { x: current.x + nx * distanceUm, y: current.y + ny * distanceUm, dx, dy };
  });
  return profile.map((_, index) => {
    const previous = offsetLines[(index - 1 + offsetLines.length) % offsetLines.length]!;
    const current = offsetLines[index]!;
    const denominator = previous.dx * current.dy - previous.dy * current.dx;
    if (Math.abs(denominator) < 1e-9) throw new Error("Cannot offset a profile with parallel adjacent edges");
    const qx = current.x - previous.x, qy = current.y - previous.y;
    const t = (qx * current.dy - qy * current.dx) / denominator;
    return point(previous.x + previous.dx * t, previous.y + previous.dy * t);
  });
}

export function generateCakeSliceBox(project: ProjectDocument): DielineScene {
  const p = project.parameters;
  const angle = project.construction.sliceAngleMilliDegrees / 1000 * Math.PI / 180;
  const length = Number(p.width);
  const rawProfile = [point(0, 0), point(length, 0), point(length * Math.cos(angle), length * Math.sin(angle))];
  const margin = Math.max(p.height, p.lidHeight) + p.glueFlap + 5_000;
  const baseProfile = translateProfile(rawProfile, margin, margin);
  const base = buildProfileTray({
    id: "base", role: "base", profile: baseProfile, wallHeightUm: p.height, glueFlapUm: p.glueFlap,
    profileParameterRefs: ["width"], heightParameter: "height",
  });

  const lidOffset = um(project.material.thicknessUm + p.clearance);
  const rawLidProfile = offsetConvexProfile(rawProfile, lidOffset);
  const rawMinX = Math.min(...rawLidProfile.map((value) => value.x));
  const rawMinY = Math.min(...rawLidProfile.map((value) => value.y));
  const lidProfile = translateProfile(rawLidProfile, base.bounds.maxX + 20_000 - rawMinX, margin - rawMinY);
  const lid = buildProfileTray({
    id: "lid", role: "lid", profile: lidProfile, wallHeightUm: p.lidHeight, glueFlapUm: p.glueFlap,
    profileParameterRefs: ["width", "clearance"], heightParameter: "lidHeight",
  });

  const tip = baseProfile[0]!, radialEnd = baseProfile[1]!;
  const lidTopA = lidProfile[0]!, lidTopB = lidProfile[1]!;
  const anchors: Anchor[] = [
    { id: "base.radial.tip", point: tip }, { id: "base.radial.end", point: radialEnd },
    { id: "base.wall.outer", point: point((tip.x + radialEnd.x) / 2, tip.y - p.height) },
    { id: "base.wall.fold", point: point((tip.x + radialEnd.x) / 2, tip.y) },
    { id: "lid.wall.outer", point: point((lidTopA.x + lidTopB.x) / 2, Math.min(lidTopA.y, lidTopB.y) - p.lidHeight) },
    { id: "lid.wall.fold", point: point((lidTopA.x + lidTopB.x) / 2, Math.min(lidTopA.y, lidTopB.y)) },
  ];
  const dimensions: DimensionSpec[] = [
    { id: "dimension.slice-length", kind: "horizontal", startAnchorId: "base.radial.tip", endAnchorId: "base.radial.end", parameterId: "width", label: "Radial length", valueUm: p.width, offsetUm: um(-13_000), dragDirection: "x", dragSign: 1 },
    { id: "dimension.base-height", kind: "vertical", startAnchorId: "base.wall.outer", endAnchorId: "base.wall.fold", parameterId: "height", label: "Base height", valueUm: p.height, offsetUm: um(-15_000), dragDirection: "y", dragSign: 1 },
    { id: "dimension.lid-height", kind: "vertical", startAnchorId: "lid.wall.outer", endAnchorId: "lid.wall.fold", parameterId: "lidHeight", label: "Lid height", valueUm: p.lidHeight, offsetUm: um(-15_000), dragDirection: "y", dragSign: 1 },
  ];
  const paths = [...base.paths, ...lid.paths];
  const scene: DielineScene = {
    version: 2, paths, anchors, dimensions, parts: [base.part, lid.part], faces: [...base.faces, ...lid.faces],
    foldGraph: { connections: [...base.folds, ...lid.folds] }, bounds: calculateBounds(paths), warnings: validateParameters(project),
  };
  assertSceneIntegrity(scene);
  return scene;
}

export function generateMatchBox(project: ProjectDocument): DielineScene {
  const p = project.parameters;
  const caliper = project.material.thicknessUm;
  const tray = buildRectangularTray({
    id: "tray", role: "tray", origin: point(p.height, p.height), lengthUm: p.width, widthUm: p.depth,
    wallHeightUm: p.height, glueFlapUm: p.glueFlap, glueAngleMilliDegrees: project.construction.glueAngleMilliDegrees,
    lengthParameter: "width", widthParameter: "depth", heightParameter: "height",
  });
  const sleeveDepth = um(Math.round(p.depth + caliper * 2 + p.clearance * 2));
  const sleeveHeight = um(Math.round(p.height + caliper + p.clearance));
  const sleeveLength = um(Math.round(p.width + caliper * 2 + p.clearance));
  const sleeveLeft = tray.outerWidthUm + 20_000;
  const sleeveFoldX = sleeveLeft + p.glueFlap;
  const sleeve = buildPanelBand({
    id: "sleeve", role: "sleeve", origin: point(sleeveFoldX, 0), heightUm: sleeveLength, heightParameter: "width",
    panels: [
      { id: "panel.face", widthUm: sleeveDepth, widthParameter: "depth", foldAfterPathId: "sleeve.panel.face.fold.right" },
      { id: "panel.edge-a", widthUm: sleeveHeight, widthParameter: "height", foldAfterPathId: "sleeve.panel.edge-a.fold.right" },
      { id: "panel.back", widthUm: sleeveDepth, widthParameter: "depth", foldAfterPathId: "sleeve.panel.back.fold.right" },
      { id: "panel.edge-b", widthUm: sleeveHeight, widthParameter: "height" },
    ],
    rightFreeEdgePathId: "sleeve.panel.edge-b.free-edge.cut",
  });
  const sleeveRight = sleeveFoldX + sleeveDepth * 2 + sleeveHeight * 2;
  const sleeveBottom = sleeveLength;
  const glueOuterX = sleeveFoldX - p.glueFlap;
  const glueInset = Math.max(1_000, p.clearance);
  const glueAngle = project.construction.glueAngleMilliDegrees / 1000 * Math.PI / 180;
  const seamRise = Math.min(p.glueFlap / Math.tan(glueAngle), sleeveBottom / 3);
  const sleevePaths: DielinePath[] = [
    ...sleeve.paths,
    partPath("sleeve", "sleeve.glue-flap.cut.outer", "outer-cut", ["glueFlap", "width"], [move(sleeveFoldX, 0), line(glueOuterX, seamRise), line(glueOuterX, sleeveBottom - seamRise), line(sleeveFoldX, sleeveBottom)]),
    partPath("sleeve", "sleeve.glue-flap.fold", "crease", ["glueFlap", "width"], [move(sleeveFoldX, 0), line(sleeveFoldX, sleeveBottom)]),
    partPath("sleeve", "sleeve.top.cut", "outer-cut", ["width", "depth", "height"], [move(sleeveFoldX, 0), line(sleeveRight, 0)]),
    partPath("sleeve", "sleeve.bottom.cut", "outer-cut", ["width", "depth", "height"], [move(sleeveRight, sleeveBottom), line(sleeveFoldX, sleeveBottom)]),
    partPath("sleeve", "sleeve.glue-flap.area", "glue-boundary", ["glueFlap", "clearance"], [move(glueOuterX + glueInset, seamRise + glueInset), line(sleeveFoldX - glueInset, glueInset), line(sleeveFoldX - glueInset, sleeveBottom - glueInset), line(glueOuterX + glueInset, sleeveBottom - seamRise - glueInset), { op: "close" }]),
  ];
  const trayX0 = p.height, trayY0 = p.height, trayX1 = trayX0 + p.width, trayY1 = trayY0 + p.depth;
  const anchors: Anchor[] = [
    { id: "tray.length.left", point: point(trayX0, trayY0) }, { id: "tray.length.right", point: point(trayX1, trayY0) },
    { id: "tray.width.top", point: point(trayX1, trayY0) }, { id: "tray.width.bottom", point: point(trayX1, trayY1) },
    { id: "tray.wall.outer", point: point(trayX0, 0) }, { id: "tray.wall.fold", point: point(trayX0, trayY0) },
  ];
  const dimensions: DimensionSpec[] = [
    { id: "dimension.finished-width", kind: "horizontal", startAnchorId: "tray.length.left", endAnchorId: "tray.length.right", parameterId: "width", label: "Length", valueUm: p.width, offsetUm: um(-13_000), dragDirection: "x", dragSign: 1 },
    { id: "dimension.finished-depth", kind: "vertical", startAnchorId: "tray.width.top", endAnchorId: "tray.width.bottom", parameterId: "depth", label: "Width", valueUm: p.depth, offsetUm: um(15_000), dragDirection: "y", dragSign: 1 },
    { id: "dimension.finished-height", kind: "vertical", startAnchorId: "tray.wall.outer", endAnchorId: "tray.wall.fold", parameterId: "height", label: "Height", valueUm: p.height, offsetUm: um(-15_000), dragDirection: "y", dragSign: 1 },
  ];
  const paths = [...tray.paths, ...sleevePaths];
  const scene: DielineScene = {
    version: 2, paths, anchors, dimensions, parts: [tray.part, sleeve.part], faces: [...tray.faces, ...sleeve.faces],
    foldGraph: { connections: [...tray.folds, ...sleeve.folds] }, bounds: calculateBounds(paths), warnings: validateParameters(project),
  };
  assertSceneIntegrity(scene);
  return scene;
}

const PROJECT_GENERATORS: Record<TemplateId, (document: ProjectDocument) => DielineScene> = {
  "tuck-end-carton": generateTuckCarton,
  "crash-lock-carton": generateCrashLockCarton,
  "auto-lock-bottom": generateAutoLockCarton,
  "box-with-lid": generateBoxWithLid,
  "match-box": generateMatchBox,
  "cake-slice-box": generateCakeSliceBox,
};

export function generateProjectScene(project: ProjectDocument): DielineScene {
  return PROJECT_GENERATORS[project.template.id](project);
}

export function assertSceneIntegrity(scene: DielineScene): void {
  const ids = new Set<string>();
  for (const pathValue of scene.paths) {
    if (ids.has(pathValue.id)) throw new Error(`Duplicate semantic path ID: ${pathValue.id}`);
    ids.add(pathValue.id);
    if (!pathValue.commands.length || pathValue.commands[0]?.op !== "move") throw new Error(`Path ${pathValue.id} has no move command`);
    let previous: PointUm | undefined;
    for (const command of pathValue.commands) {
      if (command.op === "close") continue;
      if (command.op === "arc") {
        if (!Number.isSafeInteger(command.center.x) || !Number.isSafeInteger(command.center.y) || command.radiusUm <= 0) throw new Error(`Invalid arc in ${pathValue.id}`);
        const start = arcPoint(command, false);
        if (previous && Math.hypot(previous.x - start.x, previous.y - start.y) > 2) throw new Error(`Disconnected arc in ${pathValue.id}`);
        previous = arcPoint(command, true);
        continue;
      }
      if (!Number.isSafeInteger(command.point.x) || !Number.isSafeInteger(command.point.y)) throw new Error(`Invalid coordinate in ${pathValue.id}`);
      if (command.op === "line" && previous && command.point.x === previous.x && command.point.y === previous.y) throw new Error(`Zero-length edge in ${pathValue.id}`);
      previous = command.point;
    }
  }
  const anchorIds = new Set(scene.anchors.map((anchor) => anchor.id));
  for (const dimension of scene.dimensions) if (!anchorIds.has(dimension.startAnchorId) || !anchorIds.has(dimension.endAnchorId)) throw new Error(`Broken dimension anchors: ${dimension.id}`);
}

export function calculateSheetFit(scene: DielineScene, project: ProjectDocument): LayoutResult {
  const contentWidth = scene.bounds.maxX - scene.bounds.minX + project.sheet.marginUm * 2;
  const contentHeight = scene.bounds.maxY - scene.bounds.minY + project.sheet.marginUm * 2;
  const portrait = project.sheet.widthUm <= project.sheet.heightUm ? [project.sheet.widthUm, project.sheet.heightUm] as const : [project.sheet.heightUm, project.sheet.widthUm] as const;
  const candidates = project.sheet.orientation === "auto"
    ? [{ orientation: "portrait" as const, w: portrait[0], h: portrait[1] }, { orientation: "landscape" as const, w: portrait[1], h: portrait[0] }]
    : project.sheet.orientation === "portrait" ? [{ orientation: "portrait" as const, w: portrait[0], h: portrait[1] }] : [{ orientation: "landscape" as const, w: portrait[1], h: portrait[0] }];
  const results = candidates.map((candidate) => ({ ...candidate, fits: contentWidth <= candidate.w && contentHeight <= candidate.h, waste: candidate.w * candidate.h - contentWidth * contentHeight }));
  results.sort((a, b) => Number(b.fits) - Number(a.fits) || a.waste - b.waste || a.orientation.localeCompare(b.orientation));
  const best = results[0]!;
  return {
    fits: best.fits, orientation: best.orientation, sheetWidthUm: um(best.w), sheetHeightUm: um(best.h), contentWidthUm: um(contentWidth), contentHeightUm: um(contentHeight),
    utilization: Math.min(1, (contentWidth * contentHeight) / (best.w * best.h)),
    suggestion: best.fits ? `Best deterministic fit: ${best.orientation}.` : "Choose a larger sheet, reduce margins, or revise the carton dimensions.",
  };
}

export const ROLE_LABELS: Record<LineRole, string> = { "outer-cut": "Cut", "internal-cut": "Lock cuts", crease: "Crease", perforation: "Perforation", "glue-boundary": "Glue area", annotation: "Dimensions" };
export const PARAMETER_LABELS: Record<ParameterId, string> = {
  width: "Width", depth: "Depth", height: "Height", lidHeight: "Lid height", tuckFlap: "Tuck tongue", dustFlap: "Dust flap", glueFlap: "Glue flap",
  thumbHole: "Thumb notch", cornerRadius: "Tuck radius", clearance: "Flap clearance",
  bottomFlap: "Bottom flap", lockOverlap: "Lock overlap",
};

export function pointMm(value: Micrometres): number { return value / 1000; }

export function pathToSvg(pathValue: DielinePath): string {
  return pathValue.commands.map((command) => {
    if (command.op === "close") return "Z";
    if (command.op === "arc") {
      const end = arcPoint(command, true);
      return `A ${(command.radiusUm / 1000).toFixed(3)} ${(command.radiusUm / 1000).toFixed(3)} 0 ${Math.abs(command.sweepMilliDegrees) > 180_000 ? 1 : 0} ${command.sweepMilliDegrees > 0 ? 1 : 0} ${(end.x / 1000).toFixed(3)} ${(end.y / 1000).toFixed(3)}`;
    }
    return `${command.op === "move" ? "M" : "L"} ${(command.point.x / 1000).toFixed(3)} ${(command.point.y / 1000).toFixed(3)}`;
  }).join(" ");
}

export function flattenPath(pathValue: DielinePath, maxAngleDegrees = 7.5): PointUm[] {
  const points: PointUm[] = [];
  for (const command of pathValue.commands) {
    if (command.op === "move" || command.op === "line") points.push(command.point);
    if (command.op === "arc") {
      const segments = Math.max(2, Math.ceil(Math.abs(command.sweepMilliDegrees / 1000) / maxAngleDegrees));
      for (let index = 1; index <= segments; index += 1) {
        const angle = (command.startMilliDegrees + command.sweepMilliDegrees * index / segments) / 1000 * Math.PI / 180;
        points.push(point(command.center.x + command.radiusUm * Math.cos(angle), command.center.y + command.radiusUm * Math.sin(angle)));
      }
    }
  }
  return points;
}

export function anchorMap(scene: DielineScene): Map<string, Anchor> { return new Map(scene.anchors.map((anchor) => [anchor.id, anchor])); }

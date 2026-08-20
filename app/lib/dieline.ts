import Fraction from "fraction.js";
import { z } from "zod";

export type Micrometres = number & { readonly __brand: "Micrometres" };
export type Unit = "mm" | "cm" | "in";
export type ParameterId = "width" | "depth" | "height" | "glueFlap";
export type LineRole =
  | "outer-cut"
  | "internal-cut"
  | "crease"
  | "perforation"
  | "glue-boundary"
  | "annotation";

export interface PointUm { x: Micrometres; y: Micrometres }
export type PathCommand =
  | { op: "move"; point: PointUm }
  | { op: "line"; point: PointUm }
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
  version: 1;
  paths: DielinePath[];
  anchors: Anchor[];
  dimensions: DimensionSpec[];
  bounds: { minX: Micrometres; minY: Micrometres; maxX: Micrometres; maxY: Micrometres };
  warnings: SceneWarning[];
}

export interface ProjectDocument {
  schemaVersion: 1;
  engineVersion: "0.1.0";
  projectId: string;
  name: string;
  template: { id: "straight-tuck-box"; version: "1.0.0" };
  parameters: Record<ParameterId, Micrometres>;
  material: { thicknessUm: Micrometres; kerfUm: Micrometres; scoreAllowanceUm: Micrometres };
  sheet: {
    preset: "A4" | "A3" | "Letter" | "Custom";
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

const projectSchema = z.object({
  schemaVersion: z.literal(1),
  engineVersion: z.literal("0.1.0"),
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  template: z.object({ id: z.literal("straight-tuck-box"), version: z.literal("1.0.0") }),
  parameters: z.object({ width: z.number().int().safe(), depth: z.number().int().safe(), height: z.number().int().safe(), glueFlap: z.number().int().safe() }),
  material: z.object({ thicknessUm: z.number().int().safe(), kerfUm: z.number().int().safe(), scoreAllowanceUm: z.number().int().safe() }),
  sheet: z.object({
    preset: z.enum(["A4", "A3", "Letter", "Custom"]),
    widthUm: z.number().int().safe(),
    heightUm: z.number().int().safe(),
    marginUm: z.number().int().safe(),
    orientation: z.enum(["portrait", "landscape", "auto"]),
  }),
  exportProfile: z.object({ creaseMode: z.enum(["line", "dash", "perforation"]), includeDimensions: z.boolean() }),
  display: z.object({ unit: z.enum(["mm", "cm", "in"]), precision: z.number().int().min(0).max(4) }),
});

export function validateProject(value: unknown): ProjectDocument {
  return projectSchema.parse(value) as ProjectDocument;
}

export const DEFAULT_PROJECT: ProjectDocument = {
  schemaVersion: 1,
  engineVersion: "0.1.0",
  projectId: "project-straight-tuck-001",
  name: "Untitled carton",
  template: { id: "straight-tuck-box", version: "1.0.0" },
  parameters: { width: um(80_000), depth: um(30_000), height: um(120_000), glueFlap: um(15_000) },
  material: { thicknessUm: um(450), kerfUm: um(150), scoreAllowanceUm: um(300) },
  sheet: { preset: "A4", widthUm: um(210_000), heightUm: um(297_000), marginUm: um(8_000), orientation: "auto" },
  exportProfile: { creaseMode: "dash", includeDimensions: false },
  display: { unit: "mm", precision: 1 },
};

const UNIT_TO_UM: Record<Unit, number> = { mm: 1_000, cm: 10_000, in: 25_400 };

export function parseMeasurement(raw: string, fallbackUnit: Unit): { ok: true; value: Micrometres } | { ok: false; message: string } {
  const normalized = raw.trim().toLowerCase().replace(/[“”]/g, '"');
  const unitMatch = normalized.match(/\s*(mm|cm|in|")\s*$/);
  const unit: Unit = unitMatch?.[1] === '"' ? "in" : (unitMatch?.[1] as Unit | undefined) ?? fallbackUnit;
  const numeric = unitMatch ? normalized.slice(0, unitMatch.index).trim() : normalized;
  if (!numeric) return { ok: false, message: "Enter a measurement" };
  try {
    const mixed = numeric.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
    const fraction = mixed
      ? new Fraction(Number(mixed[1])).add(new Fraction(Number(mixed[2]), Number(mixed[3])))
      : new Fraction(numeric);
    const result = Math.round(fraction.valueOf() * UNIT_TO_UM[unit]);
    if (!Number.isSafeInteger(result) || result <= 0) return { ok: false, message: "Use a positive, practical measurement" };
    return { ok: true, value: um(result) };
  } catch {
    return { ok: false, message: "Try 80 mm, 3.25 in, or 3 1/4 in" };
  }
}

export function formatMeasurement(value: Micrometres, unit: Unit, precision = 1): string {
  return `${(value / UNIT_TO_UM[unit]).toFixed(unit === "in" ? Math.max(2, precision) : precision)} ${unit}`;
}

const point = (x: number, y: number): PointUm => ({ x: um(Math.round(x)), y: um(Math.round(y)) });
const path = (id: string, role: LineRole, refs: ParameterId[], points: Array<[number, number]>, close = false): DielinePath => ({
  id,
  partId: "body",
  role,
  parameterRefs: refs,
  manufacturable: role !== "annotation" && role !== "glue-boundary",
  commands: [
    { op: "move", point: point(points[0]![0], points[0]![1]) },
    ...points.slice(1).map(([x, y]) => ({ op: "line" as const, point: point(x, y) })),
    ...(close ? [{ op: "close" as const }] : []),
  ],
});

export function validateParameters(parameters: ProjectDocument["parameters"]): SceneWarning[] {
  const issues: SceneWarning[] = [];
  const limits: Record<ParameterId, [number, number]> = {
    width: [15_000, 500_000], depth: [8_000, 300_000], height: [20_000, 700_000], glueFlap: [5_000, 60_000],
  };
  (Object.keys(limits) as ParameterId[]).forEach((id) => {
    const [min, max] = limits[id];
    if (parameters[id] < min || parameters[id] > max) {
      issues.push({ id: `parameter.${id}.range`, severity: "error", parameterIds: [id], message: `${id === "glueFlap" ? "Glue flap" : id[0]!.toUpperCase() + id.slice(1)} must be between ${min / 1000} and ${max / 1000} mm.` });
    }
  });
  if (parameters.depth * 2 > parameters.width) {
    issues.push({ id: "tuck-flap.crosses-opposite-fold", severity: "warning", parameterIds: ["depth", "width"], pathIds: ["body.top.front-flap.cut"], message: "Deep tuck flaps may overlap the opposite fold during closing.", technicalDetails: `Requested depth ${parameters.depth / 1000} mm; recommended maximum ${parameters.width / 2000} mm.` });
  }
  if (parameters.glueFlap > Math.min(parameters.width, parameters.depth) * 0.7) {
    issues.push({ id: "glue-flap.excessive", severity: "error", parameterIds: ["glueFlap"], pathIds: ["body.glue-flap.cut.outer"], message: "Glue flap is too wide for the adjoining panel.", technicalDetails: "Reduce the glue flap below 70% of the smallest panel dimension." });
  }
  return issues;
}

export function generateStraightTuck(project: ProjectDocument): DielineScene {
  const { width: w, depth: d, height: h, glueFlap: g } = project.parameters;
  const top = d;
  const bottom = d + h;
  const x0 = 0, x1 = g, x2 = g + w, x3 = x2 + d, x4 = x3 + w, x5 = x4 + d;
  const dust = Math.round(d * 0.68);
  const shoulder = Math.min(4_000, Math.round(w * 0.08));
  const outline: Array<[number, number]> = [
    [x0, top], [x1, top], [x1 + shoulder, 0], [x2 - shoulder, 0], [x2, top],
    [x3, top - dust], [x4, top], [x4 + shoulder, 0], [x5 - shoulder, 0], [x5, top],
    [x5, bottom], [x5, bottom + dust], [x4, bottom], [x4 - shoulder, bottom + d], [x3 + shoulder, bottom + d],
    [x3, bottom], [x2, bottom + dust], [x2, bottom], [x2 - shoulder, bottom + d], [x1 + shoulder, bottom + d],
    [x1, bottom], [x0, bottom],
  ];
  const paths: DielinePath[] = [
    path("body.outer-cut", "outer-cut", ["width", "depth", "height", "glueFlap"], outline, true),
    path("body.glue-flap.fold", "crease", ["glueFlap", "height"], [[x1, top], [x1, bottom]]),
    path("body.panel.front.fold.right", "crease", ["width", "height"], [[x2, top], [x2, bottom]]),
    path("body.panel.side.fold.right", "crease", ["depth", "height"], [[x3, top], [x3, bottom]]),
    path("body.panel.back.fold.right", "crease", ["width", "height"], [[x4, top], [x4, bottom]]),
    path("body.panel.front.fold.top", "crease", ["width", "depth"], [[x1, top], [x2, top]]),
    path("body.panel.side-a.fold.top", "crease", ["depth"], [[x2, top], [x3, top]]),
    path("body.panel.back.fold.top", "crease", ["width", "depth"], [[x3, top], [x4, top]]),
    path("body.panel.side-b.fold.top", "crease", ["depth"], [[x4, top], [x5, top]]),
    path("body.panel.front.fold.bottom", "crease", ["width", "depth"], [[x1, bottom], [x2, bottom]]),
    path("body.panel.side-a.fold.bottom", "crease", ["depth"], [[x2, bottom], [x3, bottom]]),
    path("body.panel.back.fold.bottom", "crease", ["width", "depth"], [[x3, bottom], [x4, bottom]]),
    path("body.panel.side-b.fold.bottom", "crease", ["depth"], [[x4, bottom], [x5, bottom]]),
    path("body.glue-boundary", "glue-boundary", ["glueFlap"], [[x0 + 2_000, top + 3_000], [x1 - 2_000, top + 3_000], [x1 - 2_000, bottom - 3_000], [x0 + 2_000, bottom - 3_000]], true),
  ];
  const anchors: Anchor[] = [
    { id: "front.top-left", point: point(x1, top) }, { id: "front.top-right", point: point(x2, top) },
    { id: "body.right-top", point: point(x5, top) }, { id: "body.right-bottom", point: point(x5, bottom) },
    { id: "side.top-left", point: point(x2, top) }, { id: "side.top-right", point: point(x3, top) },
    { id: "glue.top-left", point: point(x0, top) }, { id: "glue.top-right", point: point(x1, top) },
  ];
  const dimensions: DimensionSpec[] = [
    { id: "dimension.finished-width", kind: "horizontal", startAnchorId: "front.top-left", endAnchorId: "front.top-right", parameterId: "width", label: "Width", valueUm: w, offsetUm: um(-13_000), dragDirection: "x" },
    { id: "dimension.finished-depth", kind: "horizontal", startAnchorId: "side.top-left", endAnchorId: "side.top-right", parameterId: "depth", label: "Depth", valueUm: d, offsetUm: um(-10_000), dragDirection: "x" },
    { id: "dimension.finished-height", kind: "vertical", startAnchorId: "body.right-top", endAnchorId: "body.right-bottom", parameterId: "height", label: "Height", valueUm: h, offsetUm: um(14_000), dragDirection: "y" },
    { id: "dimension.glue-flap", kind: "horizontal", startAnchorId: "glue.top-left", endAnchorId: "glue.top-right", parameterId: "glueFlap", label: "Glue flap", valueUm: g, offsetUm: um(10_000), dragDirection: "x" },
  ];
  const scene: DielineScene = { version: 1, paths, anchors, dimensions, bounds: { minX: um(x0), minY: um(0), maxX: um(x5), maxY: um(bottom + d) }, warnings: validateParameters(project.parameters) };
  assertSceneIntegrity(scene);
  return scene;
}

export function assertSceneIntegrity(scene: DielineScene): void {
  const ids = new Set<string>();
  for (const p of scene.paths) {
    if (ids.has(p.id)) throw new Error(`Duplicate semantic path ID: ${p.id}`);
    ids.add(p.id);
    if (!p.commands.length || p.commands[0]?.op !== "move") throw new Error(`Path ${p.id} has no move command`);
    let previous: PointUm | undefined;
    for (const command of p.commands) {
      if (command.op === "close") continue;
      if (!Number.isSafeInteger(command.point.x) || !Number.isSafeInteger(command.point.y)) throw new Error(`Invalid coordinate in ${p.id}`);
      if (command.op === "line" && previous && command.point.x === previous.x && command.point.y === previous.y) throw new Error(`Zero-length edge in ${p.id}`);
      previous = command.point;
    }
  }
  const anchorIds = new Set(scene.anchors.map((a) => a.id));
  for (const dimension of scene.dimensions) {
    if (!anchorIds.has(dimension.startAnchorId) || !anchorIds.has(dimension.endAnchorId)) throw new Error(`Broken dimension anchors: ${dimension.id}`);
  }
}

export function calculateSheetFit(scene: DielineScene, project: ProjectDocument): LayoutResult {
  const contentWidth = scene.bounds.maxX - scene.bounds.minX + project.sheet.marginUm * 2;
  const contentHeight = scene.bounds.maxY - scene.bounds.minY + project.sheet.marginUm * 2;
  const basePortrait = project.sheet.widthUm <= project.sheet.heightUm
    ? [project.sheet.widthUm, project.sheet.heightUm] as const
    : [project.sheet.heightUm, project.sheet.widthUm] as const;
  const candidates = project.sheet.orientation === "auto"
    ? [{ orientation: "portrait" as const, w: basePortrait[0], h: basePortrait[1] }, { orientation: "landscape" as const, w: basePortrait[1], h: basePortrait[0] }]
    : project.sheet.orientation === "portrait"
      ? [{ orientation: "portrait" as const, w: basePortrait[0], h: basePortrait[1] }]
      : [{ orientation: "landscape" as const, w: basePortrait[1], h: basePortrait[0] }];
  const results = candidates.map((c) => ({ ...c, fits: contentWidth <= c.w && contentHeight <= c.h, waste: c.w * c.h - contentWidth * contentHeight }));
  results.sort((a, b) => Number(b.fits) - Number(a.fits) || a.waste - b.waste || a.orientation.localeCompare(b.orientation));
  const best = results[0]!;
  const alternate = results.find((r) => r.fits && r.orientation !== best.orientation);
  return {
    fits: best.fits,
    orientation: best.orientation,
    sheetWidthUm: um(best.w), sheetHeightUm: um(best.h),
    contentWidthUm: um(contentWidth), contentHeightUm: um(contentHeight),
    utilization: Math.min(1, (contentWidth * contentHeight) / (best.w * best.h)),
    suggestion: best.fits
      ? alternate ? `Also fits in ${alternate.orientation}.` : project.sheet.orientation === "auto" ? `Best fit: ${best.orientation}.` : undefined
      : "Choose a larger sheet, reduce margins, or scale the carton dimensions.",
  };
}

export const ROLE_LABELS: Record<LineRole, string> = {
  "outer-cut": "Cut", "internal-cut": "Internal cut", crease: "Crease", perforation: "Perforation", "glue-boundary": "Glue area", annotation: "Dimensions",
};

export function pointMm(value: Micrometres): number { return value / 1000; }

export function pathToSvg(pathValue: DielinePath): string {
  return pathValue.commands.map((command) => {
    if (command.op === "close") return "Z";
    return `${command.op === "move" ? "M" : "L"} ${(command.point.x / 1000).toFixed(3)} ${(command.point.y / 1000).toFixed(3)}`;
  }).join(" ");
}

export function anchorMap(scene: DielineScene): Map<string, Anchor> {
  return new Map(scene.anchors.map((anchor) => [anchor.id, anchor]));
}

export const PARAMETER_LABELS: Record<ParameterId, string> = { width: "Width", depth: "Depth", height: "Height", glueFlap: "Glue flap" };

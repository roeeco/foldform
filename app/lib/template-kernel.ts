import type { DielinePath, Micrometres, ParameterId, PointUm } from "./dieline";

export type TopologyFamily =
  | "panel-band"
  | "tray-cover"
  | "tray-sleeve"
  | "gusseted-band"
  | "planar-wrap"
  | "curved-band"
  | "developable-shell"
  | "tapered-shell";

export type TemplateParameterKind = "length" | "angle" | "integer" | "percentage" | "boolean" | "enum";
export type TemplateParameterRole = "finished-size" | "construction" | "material" | "manufacturing";

export interface TemplateParameterDefinition {
  id: string;
  label: string;
  kind: TemplateParameterKind;
  role: TemplateParameterRole;
  defaultValue: number | string | boolean;
  simpleMode: boolean;
}

export interface TemplateManifest {
  id: string;
  name: string;
  topology: TopologyFamily;
  implementationKey: string;
  parts: readonly string[];
  components: readonly string[];
  parameters: readonly TemplateParameterDefinition[];
  aliases?: readonly string[];
}

const length = (id: string, label: string, defaultMm: number, role: TemplateParameterRole = "finished-size", simpleMode = true): TemplateParameterDefinition => ({ id, label, kind: "length", role, defaultValue: defaultMm, simpleMode });
const angle = (id: string, label: string, degrees: number, simpleMode = false): TemplateParameterDefinition => ({ id, label, kind: "angle", role: "construction", defaultValue: degrees, simpleMode });
const percentage = (id: string, label: string, value: number, simpleMode = false): TemplateParameterDefinition => ({ id, label, kind: "percentage", role: "construction", defaultValue: value, simpleMode });

/**
 * Product-level registry. Templates that share an implementationKey are variants
 * of one generator rather than independent geometry implementations.
 */
export const TEMPLATE_MANIFESTS: readonly TemplateManifest[] = [
  {
    id: "tuck-end-carton", name: "Tuck-end carton", topology: "panel-band", implementationKey: "rectangular-carton-band",
    parts: ["body"], components: ["panel-band", "glue-seam", "tuck-closure", "receiving-edge", "dust-flap"],
    parameters: [length("width", "Width", 60), length("depth", "Depth", 30), length("height", "Height", 90), length("tuckFlap", "Tuck tongue", 20, "construction", false)],
  },
  {
    id: "gift-box", name: "Gift box", topology: "panel-band", implementationKey: "rectangular-carton-band",
    aliases: ["card box"], parts: ["body"], components: ["panel-band", "glue-seam", "tuck-closure", "receiving-edge", "dust-flap"],
    parameters: [length("length", "Length", 50), length("width", "Width", 40), length("height", "Height", 60), length("thumbHole", "Thumb hole", 15, "construction", false), length("materialThickness", "Material thickness", .5, "material", false)],
  },
  {
    id: "shallow-box", name: "Shallow box", topology: "panel-band", implementationKey: "rectangular-carton-band",
    parts: ["body"], components: ["panel-band", "glue-seam", "broad-tuck-closure", "dust-flap"],
    parameters: [length("length", "Length", 150), length("width", "Width", 100), length("height", "Height", 20), length("dustFlap", "Dust flap", 20, "construction", false)],
  },
  {
    id: "crash-lock-carton", name: "Crash-lock carton", topology: "panel-band", implementationKey: "rectangular-carton-band",
    parts: ["body"], components: ["panel-band", "glue-seam", "tuck-closure", "crash-lock-bottom"],
    parameters: [length("width", "Width", 60), length("depth", "Depth", 30), length("height", "Height", 90), length("bottomFlap", "Bottom flap", 28, "construction", false), length("lockOverlap", "Lock overlap", 10, "construction", false)],
  },
  {
    id: "auto-lock-bottom", name: "Auto-lock bottom", topology: "panel-band", implementationKey: "rectangular-carton-band",
    parts: ["body"], components: ["panel-band", "glue-seam", "tuck-closure", "auto-lock-bottom"],
    parameters: [length("width", "Width", 60), length("depth", "Depth", 30), length("height", "Height", 90), length("bottomFlap", "Bottom flap", 30, "construction", false), length("lockOverlap", "Lock overlap", 12, "construction", false)],
  },
  {
    id: "box-with-lid", name: "Box with lid", topology: "tray-cover", implementationKey: "profile-tray-cover",
    aliases: ["two-piece box"], parts: ["base", "lid"], components: ["profile-face", "tray-wall", "corner-join", "clearance-offset", "fold-over-wall", "liner-glue", "locking-tab", "receiving-slot"],
    parameters: [length("length", "Length", 170), length("width", "Width", 110), length("height", "Base height", 70), length("lidHeight", "Lid height", 40), percentage("clearance", "Lid clearance", 4), length("lockTab", "Lock tab depth", 6, "construction", false)],
  },
  {
    id: "cake-slice-box", name: "Cake slice box", topology: "tray-cover", implementationKey: "profile-tray-cover",
    parts: ["base", "lid"], components: ["triangular-profile", "tray-wall", "corner-join", "clearance-offset", "fold-over-wall", "liner-glue", "locking-tab", "receiving-slot"],
    parameters: [length("width", "Radial length", 140), length("height", "Base wall", 40), length("lidHeight", "Lid wall", 25), angle("sliceAngle", "Slice angle", 30), length("clearance", "Clearance", 2, "construction", false), length("glueFlap", "Corner glue tab", 10, "construction", false), length("lockTab", "Lock tab depth", 5, "construction", false)],
  },
  {
    id: "match-box", name: "Match box", topology: "tray-sleeve", implementationKey: "profile-tray-sleeve",
    aliases: ["tray and sleeve"], parts: ["tray", "sleeve"], components: ["profile-face", "tray-wall", "panel-band", "glue-seam", "clearance-offset", "fold-over-wall", "liner-glue", "locking-tab", "receiving-slot"],
    parameters: [length("length", "Length", 70), length("width", "Width", 40), length("height", "Height", 10), length("materialThickness", "Material thickness", .5, "material", false), length("clearance", "Clearance", 2, "construction", false), length("lockTab", "Lock tab depth", 4, "construction", false)],
  },
  {
    id: "bag", name: "Bag", topology: "gusseted-band", implementationKey: "gusseted-panel-band",
    parts: ["body"], components: ["panel-band", "glue-seam", "derived-side-gusset", "diagonal-bottom-fold", "top-return"],
    parameters: [length("width", "Face width", 80), length("depth", "Bag depth", 50), length("height", "Height", 150), length("topFold", "Top reinforcement fold", 20, "construction", false), length("glueFlap", "Glue flap", 15, "construction", false)],
  },
  {
    id: "envelope", name: "Envelope", topology: "planar-wrap", implementationKey: "profile-edge-wrap",
    parts: ["body"], components: ["profile-face", "side-flap", "bottom-flap", "cover-flap", "overlap"],
    parameters: [length("width", "Width", 150), length("height", "Height", 100), length("overlap", "Overlap", 12.5, "construction", false), length("cornerRadius", "Corner radius", 7, "construction", false)],
  },
  {
    id: "pillow-pack", name: "Pillow pack", topology: "curved-band", implementationKey: "curved-panel-band",
    parts: ["body"], components: ["panel-band", "glue-seam", "arc-score-closure", "thumb-hole"],
    parameters: [length("width", "Pack width", 80), length("depth", "Pack length", 140), length("height", "Crown height", 15), length("thumbHole", "Thumb hole", 10, "construction", false)],
  },
  {
    id: "cone", name: "Cone", topology: "developable-shell", implementationKey: "conical-frustum-development",
    parts: ["shell"], components: ["annular-sector", "glue-seam"],
    parameters: [length("topDiameter", "Top diameter", 40), length("bottomDiameter", "Bottom diameter", 100), length("height", "Height", 120), angle("glueAngle", "Glue flap angle", 90)],
  },
  {
    id: "trapezoid-box", name: "Trapezoid box", topology: "tapered-shell", implementationKey: "tapered-profile-shell",
    parts: ["body"], components: ["rectangular-frustum", "tapered-wall", "corner-join", "tuck-closure", "receiving-edge", "dust-flap"],
    parameters: [length("topLength", "Top length", 70), length("bottomLength", "Bottom length", 40), length("topWidth", "Top width", 40), length("bottomWidth", "Bottom width", 30), length("height", "Height", 40), length("tuckFlap", "Tuck tongue", 15, "construction", false), length("dustFlap", "Dust flap", 20, "construction", false), length("glueFlap", "Corner glue tab", 10, "construction", false)],
  },
] as const;

export function manifestsForImplementation(implementationKey: string): readonly TemplateManifest[] {
  return TEMPLATE_MANIFESTS.filter((manifest) => manifest.implementationKey === implementationKey);
}

export interface NetFace {
  id: string;
  partId: string;
  boundary: readonly PointUm[];
  parameterRefs: readonly ParameterId[];
}

export interface NetPart {
  id: string;
  role: "shell" | "base" | "lid" | "tray" | "sleeve" | "insert";
  faceIds: readonly string[];
}

export interface FoldConnection {
  id: string;
  partId: string;
  faceAId: string;
  faceBId: string;
  edge: readonly [PointUm, PointUm];
  parameterRefs: readonly ParameterId[];
  foldSense: "unspecified" | "mountain" | "valley";
}

export interface PanelBandPanel {
  id: string;
  widthUm: Micrometres;
  widthParameter: ParameterId;
  foldAfterPathId?: string;
}

export interface PanelBandSpec {
  id: string;
  role?: NetPart["role"];
  origin: PointUm;
  heightUm: Micrometres;
  heightParameter: ParameterId;
  panels: readonly PanelBandPanel[];
  rightFreeEdgePathId: string;
}

export interface PanelBandResult {
  part: NetPart;
  faces: readonly NetFace[];
  folds: readonly FoldConnection[];
  paths: readonly DielinePath[];
}

export interface RectangularTraySpec {
  id: string;
  role: "base" | "lid" | "tray";
  origin: PointUm;
  lengthUm: Micrometres;
  widthUm: Micrometres;
  wallHeightUm: Micrometres;
  glueFlapUm: Micrometres;
  glueAngleMilliDegrees: number;
  lengthParameter: ParameterId;
  widthParameter: ParameterId;
  heightParameter: ParameterId;
  wallConstruction?: WallConstruction;
  materialThicknessUm?: Micrometres;
  scoreAllowanceUm?: Micrometres;
  lockTabUm?: Micrometres;
  clearanceUm?: Micrometres;
}

export interface RectangularTrayResult {
  part: NetPart;
  faces: readonly NetFace[];
  folds: readonly FoldConnection[];
  paths: readonly DielinePath[];
  outerWidthUm: Micrometres;
  outerHeightUm: Micrometres;
  bounds: { minX: Micrometres; minY: Micrometres; maxX: Micrometres; maxY: Micrometres };
}

export type WallConstruction = "single-wall" | "fold-over-tuck" | "fold-over-lock";

export type LockBottomStyle = "crash-lock" | "auto-lock";

export interface LockBottomPanelSpec {
  id: string;
  faceId: string;
  xStartUm: Micrometres;
  xEndUm: Micrometres;
  widthParameter: ParameterId;
  kind: "major" | "minor";
}

export interface LockBottomSpec {
  id: string;
  partId: string;
  baseYUm: Micrometres;
  direction: 1 | -1;
  style: LockBottomStyle;
  panels: readonly LockBottomPanelSpec[];
  flapDepthUm: Micrometres;
  overlapUm: Micrometres;
  clearanceUm: Micrometres;
}

export interface LockBottomResult {
  faces: readonly NetFace[];
  folds: readonly FoldConnection[];
  paths: readonly DielinePath[];
}

export interface ProfileTraySpec {
  id: string;
  role: "base" | "lid" | "tray";
  profile: readonly PointUm[];
  wallHeightUm: Micrometres;
  glueFlapUm: Micrometres;
  profileParameterRefs: readonly ParameterId[];
  heightParameter: ParameterId;
  wallConstruction?: WallConstruction;
  materialThicknessUm?: Micrometres;
  scoreAllowanceUm?: Micrometres;
  lockTabUm?: Micrometres;
  clearanceUm?: Micrometres;
  glueAngleMilliDegrees?: number;
}

export interface ProfileTrayResult {
  part: NetPart;
  faces: readonly NetFace[];
  folds: readonly FoldConnection[];
  paths: readonly DielinePath[];
  bounds: { minX: Micrometres; minY: Micrometres; maxX: Micrometres; maxY: Micrometres };
}

export interface TaperedBoxSpec {
  id: string;
  origin: PointUm;
  bottomLengthUm: Micrometres;
  bottomWidthUm: Micrometres;
  topLengthUm: Micrometres;
  topWidthUm: Micrometres;
  heightUm: Micrometres;
  tuckFlapUm: Micrometres;
  dustFlapUm: Micrometres;
  glueFlapUm: Micrometres;
  thumbHoleUm: Micrometres;
  clearanceUm: Micrometres;
  materialThicknessUm: Micrometres;
  glueAngleMilliDegrees: number;
}

export interface TaperedBoxResult {
  part: NetPart;
  faces: readonly NetFace[];
  folds: readonly FoldConnection[];
  paths: readonly DielinePath[];
  bounds: { minX: Micrometres; minY: Micrometres; maxX: Micrometres; maxY: Micrometres };
  metrics: { lengthSlantUm: Micrometres; widthSlantUm: Micrometres; lateralEdgeUm: Micrometres };
  anchors: {
    bottomTopLeft: PointUm; bottomTopRight: PointUm; bottomBottomRight: PointUm;
    rearTopLeft: PointUm; rearTopRight: PointUm; leftTopStart: PointUm; leftTopEnd: PointUm;
  };
}

const point = (x: number, y: number): PointUm => ({ x: Math.round(x) as Micrometres, y: Math.round(y) as Micrometres });

/** Builds the reusable shell skeleton used by rectangular cartons, sleeves, and gusseted variants. */
export function buildPanelBand(spec: PanelBandSpec): PanelBandResult {
  if (!spec.id || spec.panels.length < 2 || spec.heightUm <= 0) throw new Error("A panel band needs an ID, positive height, and at least two panels");
  if (spec.panels.some((panel) => !panel.id || panel.widthUm <= 0)) throw new Error("Panel IDs and widths must be positive");
  if (new Set(spec.panels.map((panel) => panel.id)).size !== spec.panels.length) throw new Error("Panel IDs must be unique inside a band");

  const y1: number = spec.origin.y;
  const y2: number = spec.origin.y + spec.heightUm;
  let x: number = spec.origin.x;
  const faces: NetFace[] = [];
  const folds: FoldConnection[] = [];
  const paths: DielinePath[] = [];

  for (let index = 0; index < spec.panels.length; index += 1) {
    const panel = spec.panels[index]!;
    const nextX = x + panel.widthUm;
    const faceId = `${spec.id}.${panel.id}`;
    faces.push({ id: faceId, partId: spec.id, boundary: [point(x, y1), point(nextX, y1), point(nextX, y2), point(x, y2)], parameterRefs: [panel.widthParameter, spec.heightParameter] });
    const nextPanel = spec.panels[index + 1];
    if (nextPanel) {
      const pathId = panel.foldAfterPathId ?? `${faceId}.fold.right`;
      const refs = [panel.widthParameter, spec.heightParameter];
      const edge = [point(nextX, y1), point(nextX, y2)] as const;
      paths.push({ id: pathId, partId: spec.id, role: "crease", commands: [{ op: "move", point: edge[0] }, { op: "line", point: edge[1] }], parameterRefs: refs, manufacturable: true });
      folds.push({ id: `${faceId}.to.${spec.id}.${nextPanel.id}`, partId: spec.id, faceAId: faceId, faceBId: `${spec.id}.${nextPanel.id}`, edge, parameterRefs: refs, foldSense: "unspecified" });
    }
    x = nextX;
  }

  paths.push({ id: spec.rightFreeEdgePathId, partId: spec.id, role: "outer-cut", commands: [{ op: "move", point: point(x, y1) }, { op: "line", point: point(x, y2) }], parameterRefs: [spec.heightParameter], manufacturable: true });
  const part: NetPart = { id: spec.id, role: spec.role ?? "shell", faceIds: faces.map((face) => face.id) };
  assertNetTopology([part], faces, folds);
  return { part, faces, folds, paths };
}

const pathFromPoints = (partId: string, id: string, role: DielinePath["role"], refs: ParameterId[], points: readonly PointUm[], close = false): DielinePath => ({
  id, partId, role, parameterRefs: refs, manufacturable: role !== "glue-boundary" && role !== "annotation",
  commands: [...points.map((value, index) => ({ op: index === 0 ? "move" as const : "line" as const, point: value })), ...(close ? [{ op: "close" as const }] : [])],
});

/** Builds a glue-corner tray around a rectangular finished profile. Base, lid, and sliding trays share this component. */
export function buildRectangularTray(spec: RectangularTraySpec): RectangularTrayResult {
  if (!spec.id || spec.lengthUm <= 0 || spec.widthUm <= 0 || spec.wallHeightUm <= 0 || spec.glueFlapUm <= 0) throw new Error("A rectangular tray needs positive dimensions and a stable ID");
  const x0 = spec.origin.x, y0 = spec.origin.y;
  const x1 = x0 + spec.lengthUm, y1 = y0 + spec.widthUm;
  if (spec.wallConstruction && spec.wallConstruction !== "single-wall") {
    const reinforced = buildProfileTray({
      id: spec.id, role: spec.role,
      profile: [point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)],
      wallHeightUm: spec.wallHeightUm, glueFlapUm: spec.glueFlapUm,
      profileParameterRefs: [spec.lengthParameter, spec.widthParameter], heightParameter: spec.heightParameter,
      wallConstruction: spec.wallConstruction, materialThicknessUm: spec.materialThicknessUm,
      scoreAllowanceUm: spec.scoreAllowanceUm, lockTabUm: spec.lockTabUm, clearanceUm: spec.clearanceUm,
      glueAngleMilliDegrees: spec.glueAngleMilliDegrees,
    });
    return {
      ...reinforced,
      outerWidthUm: Math.round(reinforced.bounds.maxX - reinforced.bounds.minX) as Micrometres,
      outerHeightUm: Math.round(reinforced.bounds.maxY - reinforced.bounds.minY) as Micrometres,
    };
  }
  const wall = spec.wallHeightUm;
  const clearance = Number(spec.clearanceUm ?? 0);
  const angle = Math.max(45_000, Math.min(90_000, spec.glueAngleMilliDegrees)) / 1000 * Math.PI / 180;
  const tab = Math.max(500, Math.min(spec.glueFlapUm, Math.round(wall * .72), Math.round(Math.min(spec.lengthUm, spec.widthUm) * .42 - clearance)));
  const bevel = Math.max(0, Math.min(Math.round(wall / 2 - 250), Math.round(tab / Math.tan(angle))));
  const p = point;
  const refs = [spec.lengthParameter, spec.widthParameter, spec.heightParameter];
  const faces: NetFace[] = [
    { id: `${spec.id}.face.base`, partId: spec.id, boundary: [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)], parameterRefs: [spec.lengthParameter, spec.widthParameter] },
    { id: `${spec.id}.wall.top`, partId: spec.id, boundary: [p(x0, y0 - wall), p(x1, y0 - wall), p(x1, y0), p(x0, y0)], parameterRefs: [spec.lengthParameter, spec.heightParameter] },
    { id: `${spec.id}.wall.right`, partId: spec.id, boundary: [p(x1, y0), p(x1 + wall, y0), p(x1 + wall, y1), p(x1, y1)], parameterRefs: [spec.widthParameter, spec.heightParameter] },
    { id: `${spec.id}.wall.bottom`, partId: spec.id, boundary: [p(x0, y1), p(x1, y1), p(x1, y1 + wall), p(x0, y1 + wall)], parameterRefs: [spec.lengthParameter, spec.heightParameter] },
    { id: `${spec.id}.wall.left`, partId: spec.id, boundary: [p(x0 - wall, y0), p(x0, y0), p(x0, y1), p(x0 - wall, y1)], parameterRefs: [spec.widthParameter, spec.heightParameter] },
    { id: `${spec.id}.tab.top-left`, partId: spec.id, boundary: [p(x0 - wall, y0), p(x0 - wall + bevel, y0 - tab), p(x0 - bevel, y0 - tab), p(x0, y0)], parameterRefs: [spec.heightParameter, "glueFlap"] },
    { id: `${spec.id}.tab.top-right`, partId: spec.id, boundary: [p(x1, y0), p(x1 + bevel, y0 - tab), p(x1 + wall - bevel, y0 - tab), p(x1 + wall, y0)], parameterRefs: [spec.heightParameter, "glueFlap"] },
    { id: `${spec.id}.tab.bottom-left`, partId: spec.id, boundary: [p(x0, y1), p(x0 - bevel, y1 + tab), p(x0 - wall + bevel, y1 + tab), p(x0 - wall, y1)], parameterRefs: [spec.heightParameter, "glueFlap"] },
    { id: `${spec.id}.tab.bottom-right`, partId: spec.id, boundary: [p(x1 + wall, y1), p(x1 + wall - bevel, y1 + tab), p(x1 + bevel, y1 + tab), p(x1, y1)], parameterRefs: [spec.heightParameter, "glueFlap"] },
  ];
  const folds: FoldConnection[] = [];
  const paths: DielinePath[] = [];
  const addFold = (id: string, faceAId: string, faceBId: string, a: PointUm, b: PointUm, parameterRefs: ParameterId[]) => {
    paths.push(pathFromPoints(spec.id, `${spec.id}.${id}.fold`, "crease", parameterRefs, [a, b]));
    folds.push({ id: `${spec.id}.${id}`, partId: spec.id, faceAId, faceBId, edge: [a, b], parameterRefs, foldSense: "unspecified" });
  };
  addFold("base-to-top", `${spec.id}.face.base`, `${spec.id}.wall.top`, p(x0, y0), p(x1, y0), [spec.lengthParameter, spec.heightParameter]);
  addFold("base-to-right", `${spec.id}.face.base`, `${spec.id}.wall.right`, p(x1, y0), p(x1, y1), [spec.widthParameter, spec.heightParameter]);
  addFold("base-to-bottom", `${spec.id}.face.base`, `${spec.id}.wall.bottom`, p(x0, y1), p(x1, y1), [spec.lengthParameter, spec.heightParameter]);
  addFold("base-to-left", `${spec.id}.face.base`, `${spec.id}.wall.left`, p(x0, y0), p(x0, y1), [spec.widthParameter, spec.heightParameter]);
  addFold("left-to-top-tab", `${spec.id}.wall.left`, `${spec.id}.tab.top-left`, p(x0 - wall, y0), p(x0, y0), [spec.heightParameter, "glueFlap"]);
  addFold("right-to-top-tab", `${spec.id}.wall.right`, `${spec.id}.tab.top-right`, p(x1, y0), p(x1 + wall, y0), [spec.heightParameter, "glueFlap"]);
  addFold("left-to-bottom-tab", `${spec.id}.wall.left`, `${spec.id}.tab.bottom-left`, p(x0 - wall, y1), p(x0, y1), [spec.heightParameter, "glueFlap"]);
  addFold("right-to-bottom-tab", `${spec.id}.wall.right`, `${spec.id}.tab.bottom-right`, p(x1, y1), p(x1 + wall, y1), [spec.heightParameter, "glueFlap"]);

  paths.push(
    pathFromPoints(spec.id, `${spec.id}.wall.top.cut`, "outer-cut", refs, [p(x0, y0), p(x0, y0 - wall), p(x1, y0 - wall), p(x1, y0)]),
    pathFromPoints(spec.id, `${spec.id}.wall.right.cut`, "outer-cut", refs, [p(x1, y0), p(x1 + bevel, y0 - tab), p(x1 + wall - bevel, y0 - tab), p(x1 + wall, y0), p(x1 + wall, y1), p(x1 + wall - bevel, y1 + tab), p(x1 + bevel, y1 + tab), p(x1, y1)]),
    pathFromPoints(spec.id, `${spec.id}.wall.bottom.cut`, "outer-cut", refs, [p(x1, y1), p(x1, y1 + wall), p(x0, y1 + wall), p(x0, y1)]),
    pathFromPoints(spec.id, `${spec.id}.wall.left.cut`, "outer-cut", refs, [p(x0, y1), p(x0 - bevel, y1 + tab), p(x0 - wall + bevel, y1 + tab), p(x0 - wall, y1), p(x0 - wall, y0), p(x0 - wall + bevel, y0 - tab), p(x0 - bevel, y0 - tab), p(x0, y0)]),
  );
  for (const face of faces.filter((candidate) => candidate.id.includes(".tab."))) paths.push(pathFromPoints(spec.id, `${face.id}.glue-area`, "glue-boundary", [spec.heightParameter, "glueFlap"], face.boundary, true));
  const part: NetPart = { id: spec.id, role: spec.role, faceIds: faces.map((face) => face.id) };
  assertNetTopology([part], faces, folds);
  const allPoints = faces.flatMap((face) => face.boundary);
  const bounds = {
    minX: Math.min(...allPoints.map((value) => value.x)) as Micrometres,
    minY: Math.min(...allPoints.map((value) => value.y)) as Micrometres,
    maxX: Math.max(...allPoints.map((value) => value.x)) as Micrometres,
    maxY: Math.max(...allPoints.map((value) => value.y)) as Micrometres,
  };
  return { part, faces, folds, paths, outerWidthUm: Math.round(bounds.maxX - bounds.minX) as Micrometres, outerHeightUm: Math.round(bounds.maxY - bounds.minY) as Micrometres, bounds };
}

/**
 * Builds the fold-and-glue base used by crash-lock and auto-lock carton variants.
 * Major flaps are split into fixed and collapse faces by a real diagonal fold;
 * minor flaps remain single tapered faces. The style only changes the locking
 * cut and diagonal handedness, so both variants share one topology component.
 */
export function buildLockBottom(spec: LockBottomSpec): LockBottomResult {
  if (!spec.id || spec.panels.length !== 4 || spec.flapDepthUm <= 0 || spec.overlapUm <= 0) throw new Error("A lock bottom needs four panels and positive flap dimensions");
  const faces: NetFace[] = [];
  const folds: FoldConnection[] = [];
  const paths: DielinePath[] = [];
  const y = Number(spec.baseYUm);
  const direction = spec.direction;
  const refs: ParameterId[] = ["bottomFlap", "lockOverlap", "clearance"];

  spec.panels.forEach((panel, index) => {
    const x0 = Number(panel.xStartUm), x1 = Number(panel.xEndUm);
    const width = x1 - x0;
    if (width <= 0) throw new Error(`Lock-bottom panel ${panel.id} has no width`);
    const relief = Math.min(Number(spec.clearanceUm), width * .1);
    const depth = panel.kind === "major" ? Number(spec.flapDepthUm) : Math.min(Number(spec.flapDepthUm) * .68, width * .82);
    const tipY = y + direction * depth;
    const shoulder = Math.min(Math.max(Number(spec.overlapUm) * .35, relief), width * .26);
    const p0 = point(x0 + relief, y), p1 = point(x1 - relief, y);
    const p2 = point(x1 - shoulder, tipY), p3 = point(x0 + shoulder, tipY);
    const baseId = `${spec.id}.${panel.id}`;

    if (panel.kind === "minor") {
      const faceId = `${baseId}.face`;
      faces.push({ id: faceId, partId: spec.partId, boundary: [p0, p1, p2, p3], parameterRefs: [panel.widthParameter, ...refs] });
      paths.push(pathFromPoints(spec.partId, `${baseId}.cut.outer`, "outer-cut", [panel.widthParameter, ...refs], [p0, p3, p2, p1]));
      const edge = [p0, p1] as const;
      paths.push(pathFromPoints(spec.partId, `${baseId}.fold`, "crease", [panel.widthParameter, "bottomFlap"], edge));
      folds.push({ id: `${baseId}.fold`, partId: spec.partId, faceAId: panel.faceId, faceBId: faceId, edge, parameterRefs: [panel.widthParameter, "bottomFlap"], foldSense: "valley" });
      return;
    }

    const diagonalFromStart = spec.style === "crash-lock" ? index % 4 === 0 : index % 4 !== 0;
    const diagonal = diagonalFromStart ? [p0, p2] as const : [p1, p3] as const;
    const fixedId = `${baseId}.fixed`, collapseId = `${baseId}.collapse`;
    const fixedBoundary = diagonalFromStart ? [p0, p1, p2] : [p0, p1, p3];
    const collapseBoundary = diagonalFromStart ? [p0, p2, p3] : [p1, p2, p3];
    faces.push(
      { id: fixedId, partId: spec.partId, boundary: fixedBoundary, parameterRefs: [panel.widthParameter, ...refs] },
      { id: collapseId, partId: spec.partId, boundary: collapseBoundary, parameterRefs: [panel.widthParameter, ...refs] },
    );
    paths.push(
      pathFromPoints(spec.partId, `${baseId}.cut.outer`, "outer-cut", [panel.widthParameter, ...refs], [p0, p3, p2, p1]),
      pathFromPoints(spec.partId, `${baseId}.fold`, "crease", [panel.widthParameter, "bottomFlap"], [p0, p1]),
      pathFromPoints(spec.partId, `${baseId}.diagonal.fold`, "crease", [panel.widthParameter, "bottomFlap", "lockOverlap"], diagonal),
      pathFromPoints(spec.partId, `${baseId}.preglue.area`, "glue-boundary", ["lockOverlap", "glueFlap"], collapseBoundary, true),
    );
    folds.push(
      { id: `${baseId}.fold`, partId: spec.partId, faceAId: panel.faceId, faceBId: fixedId, edge: [p0, p1], parameterRefs: [panel.widthParameter, "bottomFlap"], foldSense: "valley" },
      { id: `${baseId}.diagonal`, partId: spec.partId, faceAId: fixedId, faceBId: collapseId, edge: diagonal, parameterRefs: [panel.widthParameter, "bottomFlap", "lockOverlap"], foldSense: "mountain" },
    );
    if (spec.style === "auto-lock") {
      const center = (x0 + x1) / 2;
      const hookHalf = Math.min(Number(spec.overlapUm) * .45, width * .12);
      const hookRise = Math.min(Number(spec.overlapUm) * .55, depth * .24);
      paths.push(pathFromPoints(spec.partId, `${baseId}.hook.cut`, "internal-cut", ["lockOverlap", panel.widthParameter], [
        point(center - hookHalf, tipY), point(center, tipY - direction * hookRise), point(center + hookHalf, tipY),
      ]));
    }
  });
  return { faces, folds, paths };
}

function polygonArea2(profile: readonly PointUm[]): number {
  return profile.reduce((sum, current, index) => {
    const next = profile[(index + 1) % profile.length]!;
    return sum + current.x * next.y - next.x * current.y;
  }, 0);
}

/** Builds either a quick single-wall tray or a reinforced fold-over locking tray around any convex profile. */
export function buildProfileTray(spec: ProfileTraySpec): ProfileTrayResult {
  if (!spec.id || spec.profile.length < 3 || spec.wallHeightUm <= 0 || spec.glueFlapUm <= 0) throw new Error("A profile tray needs a stable ID, a convex profile, and positive construction dimensions");
  const area2 = polygonArea2(spec.profile);
  if (Math.abs(area2) < 1) throw new Error("Profile tray base is degenerate");
  const orientation = area2 > 0 ? 1 : -1;
  let turnSign = 0;
  for (let index = 0; index < spec.profile.length; index += 1) {
    const a = spec.profile[index]!, b = spec.profile[(index + 1) % spec.profile.length]!, c = spec.profile[(index + 2) % spec.profile.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1) continue;
    const sign = Math.sign(cross);
    if (turnSign && sign !== turnSign) throw new Error("Profile tray requires a convex profile");
    turnSign = sign;
  }
  if (turnSign && turnSign !== orientation) throw new Error("Profile tray has an inconsistent winding");

  const faces: NetFace[] = [{ id: `${spec.id}.face.base`, partId: spec.id, boundary: [...spec.profile], parameterRefs: [...spec.profileParameterRefs] }];
  const folds: FoldConnection[] = [];
  const paths: DielinePath[] = [];
  const wall = Number(spec.wallHeightUm);
  const glueAngle = Math.max(45_000, Math.min(90_000, spec.glueAngleMilliDegrees ?? 90_000)) / 1000 * Math.PI / 180;
  const refs = [...spec.profileParameterRefs, spec.heightParameter];
  const reinforced = spec.wallConstruction === "fold-over-tuck" || spec.wallConstruction === "fold-over-lock";
  const locking = spec.wallConstruction === "fold-over-lock";
  const thickness = Number(spec.materialThicknessUm ?? 0);
  const scoreAllowance = Number(spec.scoreAllowanceUm ?? 0);
  const terminalDepth = Number(spec.lockTabUm ?? 0);
  const clearance = Number(spec.clearanceUm ?? 0);
  if (reinforced && (thickness <= 0 || scoreAllowance <= 0 || clearance <= 0) || locking && terminalDepth <= 0) throw new Error("Fold-over walls require material, score, and clearance; locking walls also require a lock depth");
  const rimWidth = thickness * 2 + scoreAllowance;
  const innerHeight = wall - thickness;
  if (reinforced && innerHeight <= thickness) throw new Error("Fold-over inner walls need more height than two board calipers");

  for (let index = 0; index < spec.profile.length; index += 1) {
    const a = spec.profile[index]!, b = spec.profile[(index + 1) % spec.profile.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) throw new Error(`Profile edge ${index} is degenerate`);
    const ux = dx / length, uy = dy / length;
    const next = spec.profile[(index + 2) % spec.profile.length]!;
    const nextEdgeLength = Math.hypot(next.x - b.x, next.y - b.y);
    const tabReach = Math.max(500, Math.min(Number(spec.glueFlapUm), wall * .72, nextEdgeLength * .42 - clearance));
    const tabTaper = Math.min(tabReach - 250, wall / Math.tan(glueAngle));
    const tabOuterReach = Math.max(250, tabReach - tabTaper);
    const nx = orientation > 0 ? dy / length : -dy / length;
    const ny = orientation > 0 ? -dx / length : dx / length;
    const aOuter = point(a.x + nx * wall, a.y + ny * wall);
    const bOuter = point(b.x + nx * wall, b.y + ny * wall);
    const tabBase = point(b.x + ux * tabReach, b.y + uy * tabReach);
    const tabOuter = point(bOuter.x + ux * tabOuterReach, bOuter.y + uy * tabOuterReach);
    const wallId = `${spec.id}.wall.${index + 1}`, tabId = `${spec.id}.tab.${index + 1}`;
    if (reinforced) {
      const aRim = point(a.x + nx * (wall + rimWidth), a.y + ny * (wall + rimWidth));
      const bRim = point(b.x + nx * (wall + rimWidth), b.y + ny * (wall + rimWidth));
      const aInner = point(a.x + nx * (wall + rimWidth + innerHeight), a.y + ny * (wall + rimWidth + innerHeight));
      const bInner = point(b.x + nx * (wall + rimWidth + innerHeight), b.y + ny * (wall + rimWidth + innerHeight));
      const rimId = `${spec.id}.rim.${index + 1}`, innerId = `${spec.id}.inner-wall.${index + 1}`;
      const outline: PointUm[] = [a, aOuter, aRim, aInner];
      const terminalFaces: NetFace[] = [];
      const terminalFolds: FoldConnection[] = [];
      const terminalPaths: DielinePath[] = [];

      if (locking) {
        const preferredLockWidth = Math.min(14_000, Math.max(4_000, length * .16));
        const maxTwoTabWidth = length * .36 - clearance * 2 - 500;
        const lockCenters = maxTwoTabWidth >= 2_000 ? [length * .3, length * .7] : [length * .5];
        const maxLockWidth = lockCenters.length === 2 ? maxTwoTabWidth : length * .7 - clearance * 2;
        const lockWidth = Math.max(1_000, Math.min(preferredLockWidth, maxLockWidth));
        lockCenters.forEach((center, lockIndex) => {
          const half = lockWidth / 2;
          const q0 = point(aInner.x + ux * (center - half), aInner.y + uy * (center - half));
          const q1 = point(aInner.x + ux * (center + half), aInner.y + uy * (center + half));
          const r0 = point(q0.x + ux * lockWidth * .18 + nx * terminalDepth, q0.y + uy * lockWidth * .18 + ny * terminalDepth);
          const r1 = point(q1.x - ux * lockWidth * .18 + nx * terminalDepth, q1.y - uy * lockWidth * .18 + ny * terminalDepth);
          const lockId = `${spec.id}.lock-tab.${index + 1}.${lockIndex + 1}`;
          outline.push(q0, r0, r1, q1);
          terminalFaces.push({ id: lockId, partId: spec.id, boundary: [q0, q1, r1, r0], parameterRefs: [spec.heightParameter, "lockTab", "clearance"] });
          terminalPaths.push(pathFromPoints(spec.id, `${lockId}.fold`, "crease", [spec.heightParameter, "lockTab"], [q0, q1]));
          terminalFolds.push({ id: `${lockId}.fold`, partId: spec.id, faceAId: innerId, faceBId: lockId, edge: [q0, q1], parameterRefs: [spec.heightParameter, "lockTab"], foldSense: "valley" });

          const slotHalf = lockWidth / 2 + clearance;
          const slotAperture = thickness + clearance;
          const slotApertureHalf = slotAperture / 2;
          const slotCenterInset = thickness + clearance + scoreAllowance / 2;
          const slotStart = point(a.x + ux * (center - slotHalf) - nx * slotCenterInset, a.y + uy * (center - slotHalf) - ny * slotCenterInset);
          const slotEnd = point(a.x + ux * (center + slotHalf) - nx * slotCenterInset, a.y + uy * (center + slotHalf) - ny * slotCenterInset);
          const slotCorners = [
            point(slotStart.x - nx * slotApertureHalf, slotStart.y - ny * slotApertureHalf),
            point(slotEnd.x - nx * slotApertureHalf, slotEnd.y - ny * slotApertureHalf),
            point(slotEnd.x + nx * slotApertureHalf, slotEnd.y + ny * slotApertureHalf),
            point(slotStart.x + nx * slotApertureHalf, slotStart.y + ny * slotApertureHalf),
          ];
          terminalPaths.push(pathFromPoints(spec.id, `${spec.id}.lock-slot.${index + 1}.${lockIndex + 1}.cut`, "internal-cut", ["lockTab", "clearance"], slotCorners, true));
        });
      }
      outline.push(bInner, bRim, bOuter, tabOuter, tabBase, b);
      faces.push(
        { id: wallId, partId: spec.id, boundary: [a, b, bOuter, aOuter], parameterRefs: refs },
        { id: rimId, partId: spec.id, boundary: [aOuter, bOuter, bRim, aRim], parameterRefs: [spec.heightParameter] },
        { id: innerId, partId: spec.id, boundary: [aRim, bRim, bInner, aInner], parameterRefs: [spec.heightParameter, "clearance"] },
        { id: tabId, partId: spec.id, boundary: [b, bOuter, tabOuter, tabBase], parameterRefs: [spec.heightParameter, "glueFlap"] },
        ...terminalFaces,
      );
      paths.push(
        pathFromPoints(spec.id, `${wallId}.cut`, "outer-cut", [...refs, "lockTab", "clearance"], outline),
        pathFromPoints(spec.id, `${wallId}.fold`, "crease", refs, [a, b]),
        pathFromPoints(spec.id, `${rimId}.outer.fold`, "crease", [spec.heightParameter], [aOuter, bOuter]),
        pathFromPoints(spec.id, `${rimId}.inner.fold`, "crease", [spec.heightParameter, "clearance"], [aRim, bRim]),
        pathFromPoints(spec.id, `${tabId}.fold`, "crease", [spec.heightParameter, "glueFlap"], [b, bOuter]),
        pathFromPoints(spec.id, `${tabId}.glue-area`, "glue-boundary", [spec.heightParameter, "glueFlap"], [b, bOuter, tabOuter, tabBase], true),
        ...(!locking ? [pathFromPoints(spec.id, `${innerId}.glue-area`, "glue-boundary", [spec.heightParameter, "glueFlap", "clearance"], [aRim, bRim, bInner, aInner], true)] : []),
        ...terminalPaths,
      );
      folds.push(
        { id: `${wallId}.fold`, partId: spec.id, faceAId: `${spec.id}.face.base`, faceBId: wallId, edge: [a, b], parameterRefs: refs, foldSense: "valley" },
        { id: `${rimId}.outer.fold`, partId: spec.id, faceAId: wallId, faceBId: rimId, edge: [aOuter, bOuter], parameterRefs: [spec.heightParameter], foldSense: "valley" },
        { id: `${rimId}.inner.fold`, partId: spec.id, faceAId: rimId, faceBId: innerId, edge: [aRim, bRim], parameterRefs: [spec.heightParameter, "clearance"], foldSense: "valley" },
        { id: `${tabId}.fold`, partId: spec.id, faceAId: wallId, faceBId: tabId, edge: [b, bOuter], parameterRefs: [spec.heightParameter, "glueFlap"], foldSense: "valley" },
        ...terminalFolds,
      );
      continue;
    }
    faces.push(
      { id: wallId, partId: spec.id, boundary: [a, b, bOuter, aOuter], parameterRefs: refs },
      { id: tabId, partId: spec.id, boundary: [b, bOuter, tabOuter, tabBase], parameterRefs: [spec.heightParameter, "glueFlap"] },
    );
    paths.push(
      pathFromPoints(spec.id, `${wallId}.cut`, "outer-cut", refs, [a, aOuter, bOuter, tabOuter, tabBase, b]),
      pathFromPoints(spec.id, `${wallId}.fold`, "crease", refs, [a, b]),
      pathFromPoints(spec.id, `${tabId}.fold`, "crease", [spec.heightParameter, "glueFlap"], [b, bOuter]),
      pathFromPoints(spec.id, `${tabId}.glue-area`, "glue-boundary", [spec.heightParameter, "glueFlap"], [b, bOuter, tabOuter, tabBase], true),
    );
    folds.push(
      { id: `${wallId}.fold`, partId: spec.id, faceAId: `${spec.id}.face.base`, faceBId: wallId, edge: [a, b], parameterRefs: refs, foldSense: "valley" },
      { id: `${tabId}.fold`, partId: spec.id, faceAId: wallId, faceBId: tabId, edge: [b, bOuter], parameterRefs: [spec.heightParameter, "glueFlap"], foldSense: "valley" },
    );
  }
  const part: NetPart = { id: spec.id, role: spec.role, faceIds: faces.map((face) => face.id) };
  assertNetTopology([part], faces, folds);
  const points = faces.flatMap((face) => face.boundary);
  const bounds = {
    minX: Math.min(...points.map((value) => value.x)) as Micrometres,
    minY: Math.min(...points.map((value) => value.y)) as Micrometres,
    maxX: Math.max(...points.map((value) => value.x)) as Micrometres,
    maxY: Math.max(...points.map((value) => value.y)) as Micrometres,
  };
  return { part, faces, folds, paths, bounds };
}

/** Develops a centered rectangular frustum as a cross net with a tuck-top closure. */
export function buildTaperedBox(spec: TaperedBoxSpec): TaperedBoxResult {
  const values = [spec.bottomLengthUm, spec.bottomWidthUm, spec.topLengthUm, spec.topWidthUm, spec.heightUm, spec.tuckFlapUm, spec.dustFlapUm, spec.glueFlapUm, spec.thumbHoleUm, spec.clearanceUm, spec.materialThicknessUm];
  if (!spec.id || values.some((value) => value <= 0)) throw new Error("A tapered box needs a stable ID and positive construction dimensions");

  const bottomLength = Number(spec.bottomLengthUm), bottomWidth = Number(spec.bottomWidthUm);
  const topLength = Number(spec.topLengthUm), topWidth = Number(spec.topWidthUm), height = Number(spec.heightUm);
  const lengthInset = (bottomLength - topLength) / 2;
  const widthInset = (bottomWidth - topWidth) / 2;
  const lengthSlant = Math.hypot(height, lengthInset);
  const widthSlant = Math.hypot(height, widthInset);
  const lateralEdge = Math.hypot(height, lengthInset, widthInset);
  const x0 = Number(spec.origin.x), y0 = Number(spec.origin.y), x1 = x0 + bottomLength, y1 = y0 + bottomWidth;
  const p00 = point(x0, y0), p10 = point(x1, y0), p11 = point(x1, y1), p01 = point(x0, y1);
  const rearTopLeft = point(x0 + lengthInset, y0 - widthSlant);
  const rearTopRight = point(x1 - lengthInset, y0 - widthSlant);
  const frontTopLeft = point(x0 + lengthInset, y1 + widthSlant);
  const frontTopRight = point(x1 - lengthInset, y1 + widthSlant);
  const leftTopStart = point(x0 - lengthSlant, y0 + widthInset);
  const leftTopEnd = point(x0 - lengthSlant, y1 - widthInset);
  const rightTopStart = point(x1 + lengthSlant, y0 + widthInset);
  const rightTopEnd = point(x1 + lengthSlant, y1 - widthInset);

  const faces: NetFace[] = [
    { id: `${spec.id}.face.bottom`, partId: spec.id, boundary: [p00, p10, p11, p01], parameterRefs: ["bottomLength", "bottomWidth"] },
    { id: `${spec.id}.wall.rear`, partId: spec.id, boundary: [p00, p10, rearTopRight, rearTopLeft], parameterRefs: ["bottomLength", "topLength", "bottomWidth", "topWidth", "height"] },
    { id: `${spec.id}.wall.right`, partId: spec.id, boundary: [p10, p11, rightTopEnd, rightTopStart], parameterRefs: ["bottomLength", "topLength", "bottomWidth", "topWidth", "height"] },
    { id: `${spec.id}.wall.front`, partId: spec.id, boundary: [p11, p01, frontTopLeft, frontTopRight], parameterRefs: ["bottomLength", "topLength", "bottomWidth", "topWidth", "height"] },
    { id: `${spec.id}.wall.left`, partId: spec.id, boundary: [p01, p00, leftTopStart, leftTopEnd], parameterRefs: ["bottomLength", "topLength", "bottomWidth", "topWidth", "height"] },
  ];
  const folds: FoldConnection[] = [];
  const paths: DielinePath[] = [];
  const addFold = (id: string, faceAId: string, faceBId: string, a: PointUm, b: PointUm, refs: ParameterId[]) => {
    paths.push(pathFromPoints(spec.id, id, "crease", refs, [a, b]));
    folds.push({ id, partId: spec.id, faceAId, faceBId, edge: [a, b], parameterRefs: refs, foldSense: "valley" });
  };

  addFold(`${spec.id}.bottom-to-rear.fold`, `${spec.id}.face.bottom`, `${spec.id}.wall.rear`, p00, p10, ["bottomLength", "height"]);
  addFold(`${spec.id}.bottom-to-right.fold`, `${spec.id}.face.bottom`, `${spec.id}.wall.right`, p10, p11, ["bottomWidth", "height"]);
  addFold(`${spec.id}.bottom-to-front.fold`, `${spec.id}.face.bottom`, `${spec.id}.wall.front`, p11, p01, ["bottomLength", "height"]);
  addFold(`${spec.id}.bottom-to-left.fold`, `${spec.id}.face.bottom`, `${spec.id}.wall.left`, p01, p00, ["bottomWidth", "height"]);

  const addCornerTab = (id: string, wallId: string, rootA: PointUm, rootB: PointUm, interior: PointUm) => {
    const dx = rootB.x - rootA.x, dy = rootB.y - rootA.y, rootLength = Math.hypot(dx, dy);
    const ux = dx / rootLength, uy = dy / rootLength;
    const candidateNx = -uy, candidateNy = ux;
    const midX = (rootA.x + rootB.x) / 2, midY = (rootA.y + rootB.y) / 2;
    const candidatePointsInward = candidateNx * (interior.x - midX) + candidateNy * (interior.y - midY) > 0;
    const nx = candidatePointsInward ? -candidateNx : candidateNx;
    const ny = candidatePointsInward ? -candidateNy : candidateNy;
    const effectiveDepth = Math.min(Number(spec.glueFlapUm), rootLength * .45);
    const angleRadians = Math.max(45_000, Math.min(90_000, spec.glueAngleMilliDegrees)) / 1000 * Math.PI / 180;
    const taper = Math.min(effectiveDepth / Math.tan(angleRadians), rootLength * .42);
    const outerA = point(rootA.x + ux * taper + nx * effectiveDepth, rootA.y + uy * taper + ny * effectiveDepth);
    const outerB = point(rootB.x - ux * taper + nx * effectiveDepth, rootB.y - uy * taper + ny * effectiveDepth);
    faces.push({ id, partId: spec.id, boundary: [rootA, rootB, outerB, outerA], parameterRefs: ["glueFlap", "height", "topLength", "topWidth"] });
    addFold(`${id}.fold`, wallId, id, rootA, rootB, ["glueFlap", "height"]);
    paths.push(
      pathFromPoints(spec.id, `${id}.cut`, "outer-cut", ["glueFlap", "height"], [rootA, outerA, outerB, rootB]),
      pathFromPoints(spec.id, `${id}.glue-area`, "glue-boundary", ["glueFlap"], [rootA, rootB, outerB, outerA], true),
    );
  };
  const rearInterior = point((p00.x + p10.x + rearTopRight.x + rearTopLeft.x) / 4, (p00.y + p10.y + rearTopRight.y + rearTopLeft.y) / 4);
  const frontInterior = point((p11.x + p01.x + frontTopLeft.x + frontTopRight.x) / 4, (p11.y + p01.y + frontTopLeft.y + frontTopRight.y) / 4);
  addCornerTab(`${spec.id}.corner-tab.rear-left`, `${spec.id}.wall.rear`, p00, rearTopLeft, rearInterior);
  addCornerTab(`${spec.id}.corner-tab.rear-right`, `${spec.id}.wall.rear`, rearTopRight, p10, rearInterior);
  addCornerTab(`${spec.id}.corner-tab.front-right`, `${spec.id}.wall.front`, p11, frontTopRight, frontInterior);
  addCornerTab(`${spec.id}.corner-tab.front-left`, `${spec.id}.wall.front`, frontTopLeft, p01, frontInterior);

  paths.push(
    pathFromPoints(spec.id, `${spec.id}.wall.left.rear-side.cut`, "outer-cut", ["height", "bottomLength", "topLength"], [p00, leftTopStart]),
    pathFromPoints(spec.id, `${spec.id}.wall.left.front-side.cut`, "outer-cut", ["height", "bottomLength", "topLength"], [leftTopEnd, p01]),
    pathFromPoints(spec.id, `${spec.id}.wall.right.rear-side.cut`, "outer-cut", ["height", "bottomLength", "topLength"], [p10, rightTopStart]),
    pathFromPoints(spec.id, `${spec.id}.wall.right.front-side.cut`, "outer-cut", ["height", "bottomLength", "topLength"], [rightTopEnd, p11]),
  );

  const closureDepth = topWidth + Number(spec.materialThicknessUm);
  const closureFarLeft = point(rearTopLeft.x, rearTopLeft.y - closureDepth);
  const closureFarRight = point(rearTopRight.x, rearTopRight.y - closureDepth);
  const tongueInset = Number(spec.clearanceUm) + Number(spec.materialThicknessUm) * 2;
  const tongueRootLeft = point(closureFarLeft.x + tongueInset, closureFarLeft.y);
  const tongueRootRight = point(closureFarRight.x - tongueInset, closureFarRight.y);
  const tongueTaper = Math.min(Number(spec.tuckFlapUm) * .22, (tongueRootRight.x - tongueRootLeft.x) * .08);
  const tongueTipLeft = point(tongueRootLeft.x + tongueTaper, tongueRootLeft.y - spec.tuckFlapUm);
  const tongueTipRight = point(tongueRootRight.x - tongueTaper, tongueRootRight.y - spec.tuckFlapUm);
  const closureId = `${spec.id}.top-closure`, tongueId = `${spec.id}.tuck-tongue`;
  faces.push(
    { id: closureId, partId: spec.id, boundary: [rearTopLeft, rearTopRight, closureFarRight, closureFarLeft], parameterRefs: ["topLength", "topWidth", "height"] },
    { id: tongueId, partId: spec.id, boundary: [tongueRootLeft, tongueRootRight, tongueTipRight, tongueTipLeft], parameterRefs: ["topLength", "tuckFlap", "clearance"] },
  );
  addFold(`${closureId}.fold`, `${spec.id}.wall.rear`, closureId, rearTopLeft, rearTopRight, ["topLength", "topWidth", "height"]);
  addFold(`${tongueId}.fold`, closureId, tongueId, tongueRootLeft, tongueRootRight, ["tuckFlap", "clearance"]);
  paths.push(pathFromPoints(spec.id, `${closureId}.cut`, "outer-cut", ["topLength", "topWidth", "tuckFlap", "clearance"], [rearTopLeft, closureFarLeft, tongueRootLeft, tongueTipLeft, tongueTipRight, tongueRootRight, closureFarRight, rearTopRight]));

  const thumbRadius = Math.min(Number(spec.thumbHoleUm) / 2, topLength * .22);
  const frontCenterX = (frontTopLeft.x + frontTopRight.x) / 2;
  paths.push({
    id: `${spec.id}.receiving-edge.cut`, partId: spec.id, role: "outer-cut", parameterRefs: ["topLength", "thumbHole"], manufacturable: true,
    commands: [
      { op: "move", point: frontTopLeft },
      { op: "line", point: point(frontCenterX - thumbRadius, frontTopLeft.y) },
      { op: "arc", center: point(frontCenterX, frontTopLeft.y), radiusUm: point(thumbRadius, 0).x, startMilliDegrees: 180_000, sweepMilliDegrees: 180_000 },
      { op: "line", point: frontTopRight },
    ],
  });

  const addDustFlap = (id: string, wallId: string, rootA: PointUm, rootB: PointUm, direction: -1 | 1) => {
    const rootLength = Math.hypot(rootB.x - rootA.x, rootB.y - rootA.y);
    const ux = (rootB.x - rootA.x) / rootLength, uy = (rootB.y - rootA.y) / rootLength;
    const nx = -uy * direction, ny = ux * direction;
    const taper = Math.min(rootLength * .2, Number(spec.dustFlapUm) * .35);
    const tipA = point(rootA.x + ux * taper + nx * spec.dustFlapUm, rootA.y + uy * taper + ny * spec.dustFlapUm);
    const tipB = point(rootB.x - ux * taper + nx * spec.dustFlapUm, rootB.y - uy * taper + ny * spec.dustFlapUm);
    faces.push({ id, partId: spec.id, boundary: [rootA, rootB, tipB, tipA], parameterRefs: ["topWidth", "dustFlap", "clearance"] });
    addFold(`${id}.fold`, wallId, id, rootA, rootB, ["topWidth", "dustFlap"]);
    paths.push(pathFromPoints(spec.id, `${id}.cut`, "outer-cut", ["topWidth", "dustFlap", "clearance"], [rootA, tipA, tipB, rootB]));
  };
  addDustFlap(`${spec.id}.dust-flap.left`, `${spec.id}.wall.left`, leftTopStart, leftTopEnd, 1);
  addDustFlap(`${spec.id}.dust-flap.right`, `${spec.id}.wall.right`, rightTopEnd, rightTopStart, 1);

  const part: NetPart = { id: spec.id, role: "shell", faceIds: faces.map((face) => face.id) };
  assertNetTopology([part], faces, folds);
  const allPoints = faces.flatMap((face) => face.boundary);
  const bounds = {
    minX: Math.min(...allPoints.map((value) => value.x)) as Micrometres,
    minY: Math.min(...allPoints.map((value) => value.y)) as Micrometres,
    maxX: Math.max(...allPoints.map((value) => value.x)) as Micrometres,
    maxY: Math.max(...allPoints.map((value) => value.y)) as Micrometres,
  };
  return {
    part, faces, folds, paths, bounds,
    metrics: { lengthSlantUm: point(lengthSlant, 0).x, widthSlantUm: point(widthSlant, 0).x, lateralEdgeUm: point(lateralEdge, 0).x },
    anchors: { bottomTopLeft: p00, bottomTopRight: p10, bottomBottomRight: p11, rearTopLeft, rearTopRight, leftTopStart, leftTopEnd },
  };
}

export function assertNetTopology(parts: readonly NetPart[], faces: readonly NetFace[], folds: readonly FoldConnection[]): void {
  const partIds = new Set(parts.map((part) => part.id));
  const faceIds = new Set(faces.map((face) => face.id));
  if (partIds.size !== parts.length) throw new Error("Duplicate part ID in net topology");
  if (faceIds.size !== faces.length) throw new Error("Duplicate face ID in net topology");
  if (new Set(folds.map((fold) => fold.id)).size !== folds.length) throw new Error("Duplicate fold ID in net topology");
  for (const face of faces) {
    if (!partIds.has(face.partId) || face.boundary.length < 3) throw new Error(`Invalid face topology: ${face.id}`);
    if (face.boundary.some((p) => !Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y))) throw new Error(`Non-integer face coordinate: ${face.id}`);
    const area2 = face.boundary.reduce((sum, p, index) => { const q = face.boundary[(index + 1) % face.boundary.length]!; return sum + p.x * q.y - q.x * p.y; }, 0);
    if (Math.abs(area2) < 1) throw new Error(`Degenerate face: ${face.id}`);
  }
  for (const fold of folds) {
    if (!partIds.has(fold.partId) || !faceIds.has(fold.faceAId) || !faceIds.has(fold.faceBId) || fold.faceAId === fold.faceBId) throw new Error(`Invalid fold topology: ${fold.id}`);
    if (fold.edge[0].x === fold.edge[1].x && fold.edge[0].y === fold.edge[1].y) throw new Error(`Zero-length fold: ${fold.id}`);
  }
  for (const part of parts) if (part.faceIds.some((faceId) => !faceIds.has(faceId))) throw new Error(`Part ${part.id} references an unknown face`);
}

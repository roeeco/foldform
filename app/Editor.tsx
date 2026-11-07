"use client";

import {
  AlertTriangle, Box, Check, ChevronDown, CircleHelp, Download, Eye, EyeOff,
  FileCode2, FileImage, FileText, Grid3X3, Layers3, LockKeyhole,
  Maximize2, Menu, Minus, MousePointer2, PackageOpen, Plus,
  Redo2, RotateCcw, Ruler, Save, Search, Settings2, Sparkles, Undo2, X, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  PARAMETER_LABELS, PARAMETER_LIMITS, ROLE_LABELS, calculateSheetFit, formatMeasurement,
  anchorMap, generateProjectScene, parseMeasurement, pathToSvg, pointMm,
  type DielinePath, type DielineScene, type LayoutResult, type LineRole, type Micrometres, type ParameterId, type ProjectDocument, type TemplateId, um,
} from "./lib/dieline";
import { downloadDxf, downloadPdf, downloadPng, downloadProject, downloadSvg } from "./lib/exporters";
import { useProjectStore } from "./lib/store";
import { TemplateIcon } from "./TemplateIcon";

type LeftTab = "templates" | "layers";
type InspectorTab = "design" | "material" | "sheet";
type SliderId = ParameterId | "glue-angle" | "dust-taper" | "slice-angle" | "material-thickness" | "sheet-width" | "sheet-height";
const VISIBLE_ROLES: LineRole[] = ["outer-cut", "internal-cut", "crease", "glue-boundary"];
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 8;
const TEMPLATE_UI: Record<TemplateId, { title: string; subtitle: string }> = {
  "tuck-end-carton": { title: "Tuck-end carton", subtitle: "Straight / reverse tuck · glued seam" },
  "crash-lock-carton": { title: "Crash-lock carton", subtitle: "Tuck top · pre-glued collapsing base" },
  "auto-lock-bottom": { title: "Auto-lock bottom", subtitle: "Tuck top · hooked automatic base" },
  "box-with-lid": { title: "Box with lid", subtitle: "Two-piece base and material-compensated lid" },
  "match-box": { title: "Match box", subtitle: "Glue-corner tray and sliding sleeve" },
  "cake-slice-box": { title: "Cake slice box", subtitle: "Two-piece triangular tray and fitted lid" },
  "trapezoid-box": { title: "Trapezoid box", subtitle: "Centered rectangular frustum · tuck-top closure" },
  bag: { title: "Bag", subtitle: "Reinforced top · flat gussets · diagonal bottom" },
  envelope: { title: "Envelope", subtitle: "Rounded four-flap wrap · controlled overlap" },
  "pillow-pack": { title: "Pillow pack", subtitle: "Curved analytic closure scores" },
};
const WORKING_TEMPLATES: readonly { id: TemplateId; title: string; meta: string }[] = [
  { id: "tuck-end-carton", title: "Tuck-end carton", meta: "Straight / reverse · glued seam" },
  { id: "crash-lock-carton", title: "Crash-lock carton", meta: "Pre-glued diagonal base" },
  { id: "auto-lock-bottom", title: "Auto-lock bottom", meta: "Hooked automatic base" },
  { id: "box-with-lid", title: "Box with lid", meta: "Two-piece base + lid" },
  { id: "match-box", title: "Match box", meta: "Tray + sliding sleeve" },
  { id: "cake-slice-box", title: "Cake slice box", meta: "Triangular tray + fitted lid" },
  { id: "trapezoid-box", title: "Trapezoid box", meta: "Tapered shell + tuck top" },
  { id: "bag", title: "Bag", meta: "Top return + flat-folding bottom" },
  { id: "envelope", title: "Envelope", meta: "Rounded four-flap wrap" },
  { id: "pillow-pack", title: "Pillow pack", meta: "Curved score closures" },
];
const UPCOMING_TEMPLATES = [
  { title: "Cone", meta: "Developable annular shell" },
  { title: "Gift box", meta: "Specialized panel-band closure" },
] as const;

function calculateDielineFitZoom(scene: DielineScene, layout: LayoutResult): number {
  const sheetW = pointMm(layout.sheetWidthUm), sheetH = pointMm(layout.sheetHeightUm);
  const sceneW = pointMm(um(scene.bounds.maxX - scene.bounds.minX)), sceneH = pointMm(um(scene.bounds.maxY - scene.bounds.minY));
  const baseScale = Math.max(0.35, Math.min(1.15, Math.min((sheetW - 16) / sceneW, (sheetH - 16) / sceneH)));
  return Math.max(1, Math.min(MAX_ZOOM, Math.min(sheetW / (sceneW * baseScale), sheetH / (sceneH * baseScale)) * 0.86));
}

function firstHighlightSegment(path: DielinePath): string {
  let cursor: DielinePath["commands"][number] extends { point: infer Point } ? Point | undefined : never;
  for (const command of path.commands) {
    if (command.op === "move") { cursor = command.point; continue; }
    if (command.op === "line" && cursor) return `M ${pointMm(cursor.x)} ${pointMm(cursor.y)} L ${pointMm(command.point.x)} ${pointMm(command.point.y)}`;
    if (command.op === "arc" && cursor) return pathToSvg({ ...path, commands: [{ op: "move", point: cursor }, command] });
  }
  return pathToSvg(path);
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function IconButton({ label, children, disabled, onClick, active }: { label: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void; active?: boolean }) {
  return <button className={`icon-button${active ? " active" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

const formatMillimetresInput = (value: Micrometres, precision = 1): string => (value / 1000).toFixed(precision);

function useOutsideDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const dismissWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onDismiss();
    };
    window.addEventListener("pointerdown", dismissWhenOutside);
    return () => window.removeEventListener("pointerdown", dismissWhenOutside);
  }, [onDismiss, open, ref]);
}

function SliderPopover({ label, value, min, max, step, unit, scale = 1, precision = 0, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; scale?: number; precision?: number; onChange: (value: number) => void }) {
  const display = (amount: number) => `${(amount / scale).toFixed(precision)}${unit ? ` ${unit}` : ""}`;
  return <span className="slider-popover" role="group" aria-label={`Adjust ${label}`}>
    <span className="slider-popover-head"><span>Fine tune</span><b>{display(value)}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} aria-label={`Adjust ${label} with slider`} />
    <span className="slider-popover-range"><span>{display(min)}</span><span>{display(max)}</span></span>
  </span>;
}

function ParameterField({ id, project, onCommit, onOpenSlider, onCloseSlider, sliderOpen = false, active = false, compact = false, label = PARAMETER_LABELS[id] }: { id: ParameterId; project: ProjectDocument; onCommit: (id: ParameterId, value: Micrometres) => void; onOpenSlider: () => void; onCloseSlider: () => void; sliderOpen?: boolean; active?: boolean; compact?: boolean; label?: string }) {
  const value = project.parameters[id];
  const [raw, setRaw] = useState(formatMillimetresInput(value, project.display.precision));
  const [error, setError] = useState<string>();
  const fieldRef = useRef<HTMLLabelElement>(null);
  useOutsideDismiss(fieldRef, sliderOpen, onCloseSlider);
  const displayedRaw = sliderOpen ? raw : formatMillimetresInput(value, project.display.precision);
  const commit = () => {
    const parsed = parseMeasurement(raw, "mm");
    if (!parsed.ok) { setError(parsed.message); return; }
    const [min, max] = PARAMETER_LIMITS[id];
    if (parsed.value < min || parsed.value > max) { setError(`Use ${min / 1000}–${max / 1000} mm`); return; }
    setRaw(formatMillimetresInput(parsed.value, project.display.precision)); setError(undefined); onCommit(id, parsed.value); onOpenSlider();
  };
  const nudge = (direction: -1 | 1) => {
    const [min, max] = PARAMETER_LIMITS[id];
    const next = um(Math.max(min, Math.min(max, value + direction * 1000)));
    setRaw(formatMillimetresInput(next, project.display.precision)); setError(undefined); onCommit(id, next); onOpenSlider();
  };
  const adjustWithSlider = (nextValue: number) => {
    const next = um(nextValue);
    setRaw(formatMillimetresInput(next, project.display.precision)); setError(undefined); onCommit(id, next); onOpenSlider();
  };
  const [min, max] = PARAMETER_LIMITS[id];
  return <label ref={fieldRef} className={`parameter-field${compact ? " compact" : ""}${active ? " active" : ""}${error ? " has-error" : ""}`}>
    <span>{label}</span>
    <span className="measurement-input">
      <button type="button" aria-label={`Decrease ${label} by 1 millimetre`} onClick={() => nudge(-1)}><Minus size={13}/></button>
      <input inputMode="decimal" value={displayedRaw} onFocus={(event) => { setRaw(event.currentTarget.value); onOpenSlider(); }} onChange={(event) => { onOpenSlider(); setRaw(event.target.value); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setRaw(formatMillimetresInput(value, project.display.precision)); setError(undefined); event.currentTarget.blur(); } }} aria-invalid={Boolean(error)} aria-label={`${label} in millimetres`} />
      <button type="button" aria-label={`Increase ${label} by 1 millimetre`} onClick={() => nudge(1)}><Plus size={13}/></button>
    </span>
    {sliderOpen && <SliderPopover label={label} value={value} min={min} max={max} step={1000} unit="mm" scale={1000} precision={project.display.precision} onChange={adjustWithSlider}/>}
    {error && <small>{error}</small>}
  </label>;
}

function MeasurementField({ label, value, project, onCommit, minUm, maxUm, stepUm = 1000, sliderOpen = false, onOpenSlider, onCloseSlider }: { label: string; value: Micrometres; project: ProjectDocument; onCommit: (value: Micrometres) => void; minUm?: number; maxUm?: number; stepUm?: number; sliderOpen?: boolean; onOpenSlider: () => void; onCloseSlider: () => void }) {
  const [raw, setRaw] = useState(formatMillimetresInput(value, project.display.precision));
  const [error, setError] = useState<string>();
  const fieldRef = useRef<HTMLLabelElement>(null);
  useOutsideDismiss(fieldRef, sliderOpen, onCloseSlider);
  const displayedRaw = sliderOpen ? raw : formatMillimetresInput(value, project.display.precision);
  const commit = () => {
    const parsed = parseMeasurement(raw, "mm");
    if (!parsed.ok) { setError(parsed.message); return; }
    if ((minUm !== undefined && parsed.value < minUm) || (maxUm !== undefined && parsed.value > maxUm)) {
      setError(`Use ${minUm !== undefined ? formatMeasurement(um(minUm), "mm", 1) : "a smaller value"} to ${maxUm !== undefined ? formatMeasurement(um(maxUm), "mm", 0) : "a larger value"}`); return;
    }
    setRaw(formatMillimetresInput(parsed.value, project.display.precision)); setError(undefined); onCommit(parsed.value); onOpenSlider();
  };
  const nudge = (direction: -1 | 1) => {
    const next = um(Math.max(minUm ?? Number.MIN_SAFE_INTEGER, Math.min(maxUm ?? Number.MAX_SAFE_INTEGER, value + direction * stepUm)));
    setRaw(formatMillimetresInput(next, project.display.precision)); setError(undefined); onCommit(next); onOpenSlider();
  };
  const min = minUm ?? 0;
  const max = maxUm ?? Math.max(value * 2, stepUm);
  return <label ref={fieldRef} className={`parameter-field${error ? " has-error" : ""}`}><span>{label}</span><span className="measurement-input"><button type="button" aria-label={`Decrease ${label}`} onClick={() => nudge(-1)}><Minus size={13}/></button><input inputMode="decimal" value={displayedRaw} onFocus={(event) => { setRaw(event.currentTarget.value); onOpenSlider(); }} onChange={(event) => { onOpenSlider(); setRaw(event.target.value); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setRaw(formatMillimetresInput(value, project.display.precision)); setError(undefined); event.currentTarget.blur(); } }} aria-label={`${label} in millimetres`}/><button type="button" aria-label={`Increase ${label}`} onClick={() => nudge(1)}><Plus size={13}/></button></span>{sliderOpen && <SliderPopover label={label} value={value} min={min} max={max} step={stepUm} unit="mm" scale={1000} precision={project.display.precision} onChange={(nextValue) => { const next = um(nextValue); setRaw(formatMillimetresInput(next, project.display.precision)); setError(undefined); onCommit(next); onOpenSlider(); }}/>} {error && <small>{error}</small>}</label>;
}

function UnitNumberField({ label, value, min, max, step = 1, unit, onCommit, sliderOpen = false, onOpenSlider, onCloseSlider, className = "" }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onCommit: (value: number) => void; sliderOpen?: boolean; onOpenSlider: () => void; onCloseSlider: () => void; className?: string }) {
  const [raw, setRaw] = useState(String(value));
  const fieldRef = useRef<HTMLLabelElement>(null);
  useOutsideDismiss(fieldRef, sliderOpen, onCloseSlider);
  const displayedRaw = sliderOpen ? raw : String(value);
  const commit = () => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) { setRaw(String(value)); return; }
    const next = Math.max(min, Math.min(max, parsed));
    setRaw(String(next)); onCommit(next); onOpenSlider();
  };
  const adjust = (next: number) => { setRaw(String(next)); onCommit(next); onOpenSlider(); };
  return <label ref={fieldRef} className={`number-field ${className}`}><span>{label}</span><div><input type="number" min={min} max={max} step={step} value={displayedRaw} onFocus={(event) => { setRaw(event.currentTarget.value); onOpenSlider(); }} onChange={(event) => { onOpenSlider(); setRaw(event.target.value); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setRaw(String(value)); event.currentTarget.blur(); } }} aria-label={`${label} in ${unit === "°" ? "degrees" : "percent"}`}/><b>{unit}</b></div>{sliderOpen && <SliderPopover label={label} value={value} min={min} max={max} step={step} unit={unit} onChange={adjust}/>}</label>;
}

function TemplateCard({ active, id, title, meta, locked, onClick }: { active?: boolean; id: TemplateId | "cone" | "gift-box"; title: string; meta: string; locked?: boolean; onClick?: () => void }) {
  return <button className={`template-card${active ? " active" : ""}${locked ? " locked" : ""}`} onClick={onClick} disabled={locked}>
    <span className="template-thumb" aria-hidden="true">
      <TemplateIcon id={id} />
      {locked && <span className="locked-chip"><LockKeyhole size={11} /> Soon</span>}
    </span>
    <span className="template-title">{title}</span>
    <span className="template-meta">{meta}</span>
    {active && <Check size={15} className="template-check" />}
  </button>;
}

interface CanvasProps {
  project: ProjectDocument;
  selectedParameter?: ParameterId;
  visibleRoles: Set<LineRole>;
  showGrid: boolean;
  onToggleGrid: () => void;
  zoom: number;
  setZoom: (value: number) => void;
  pan: { x: number; y: number };
  setPan: (value: { x: number; y: number }) => void;
  onFitDieline: () => void;
}

function DielineCanvas({ project, selectedParameter, visibleRoles, showGrid, onToggleGrid, zoom, setZoom, pan, setPan, onFitDieline }: CanvasProps) {
  const scene = useMemo(() => generateProjectScene(project), [project]);
  const layout = useMemo(() => calculateSheetFit(scene, project), [scene, project]);
  const anchors = useMemo(() => anchorMap(scene), [scene]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeDimension = selectedParameter ? scene.dimensions.find((dimension) => dimension.parameterId === selectedParameter) : undefined;
  const fallbackHighlightPath = selectedParameter && !activeDimension
    ? scene.paths.find((path) => visibleRoles.has(path.role) && path.parameterRefs.includes(selectedParameter))
    : undefined;
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | undefined>(undefined);
  const sheetW = pointMm(layout.sheetWidthUm), sheetH = pointMm(layout.sheetHeightUm);
  const sceneW = pointMm(um(scene.bounds.maxX - scene.bounds.minX)), sceneH = pointMm(um(scene.bounds.maxY - scene.bounds.minY));
  const fitScale = Math.min((sheetW - 16) / sceneW, (sheetH - 16) / sceneH);
  const baseScale = Math.max(0.35, Math.min(1.15, fitScale));
  const contentX = (sheetW - sceneW * baseScale) / 2 - pointMm(scene.bounds.minX) * baseScale;
  const contentY = (sheetH - sceneH * baseScale) / 2 - pointMm(scene.bounds.minY) * baseScale;
  const sheetName = project.sheet.preset === "600x400" ? "600 × 400 mm" : project.sheet.preset === "700x500" ? "700 × 500 mm" : "Custom sheet";
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current; if (!drag) return;
    setPan({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y });
  };
  const endDrag = () => { dragRef.current = undefined; };
  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
  };

  const wheel = (event: React.WheelEvent) => { event.preventDefault(); setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.deltaY > 0 ? 0.88 : 1.12)))); };
  return <div ref={viewportRef} className="canvas-viewport" style={{ "--pan-x": `${pan.x}px`, "--pan-y": `${pan.y}px`, "--canvas-zoom": zoom } as React.CSSProperties}>
    <div className="canvas-title-row"><div className="canvas-template-bar"><TemplateIcon id={project.template.id}/><div className="canvas-template-copy"><h1>{TEMPLATE_UI[project.template.id].title}</h1><span>{project.template.id === "tuck-end-carton" ? `${project.construction.openingStyle === "straight-tuck" ? "Straight tuck ends" : "Reverse tuck ends"} · slit-aware folding carton` : TEMPLATE_UI[project.template.id].subtitle}</span></div></div><span className={`fit-pill ${layout.fits ? "fits" : "overflow"}`}>{layout.fits ? <Check size={13} /> : <AlertTriangle size={13} />}{layout.fits ? `Fits ${sheetName} · ${layout.orientation}` : `Doesn’t fit ${sheetName}`}</span></div>
    <div className="sheet-stage">
      <svg className={`dieline-sheet${showGrid ? " show-grid" : ""}`} width={sheetW} height={sheetH} style={{ aspectRatio: `${sheetW} / ${sheetH}` }} viewBox={`0 0 ${sheetW} ${sheetH}`} onPointerDown={startPan} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={wheel} role="application" aria-label={`${TEMPLATE_UI[project.template.id].title} dieline preview. Edit measurements in the inspector; affected geometry glows.`}>
        <defs>
          <pattern id="minor-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#d8dde3" strokeWidth=".12" /></pattern>
          <pattern id="major-grid" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#minor-grid)"/><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#c7ced6" strokeWidth=".18" /></pattern>
          <pattern id="glue-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#e4b54a" strokeWidth=".6" /></pattern>
        </defs>
        <rect className="sheet-background" width={sheetW} height={sheetH} rx="1.8" />
        <rect className="grid-layer" width={sheetW} height={sheetH} rx="1.8" fill="url(#major-grid)" />
        <g transform={`translate(${contentX} ${contentY}) scale(${baseScale})`}>
          {selectedParameter && <g data-layer="active-parameter-glow" aria-hidden="true">
            {activeDimension && anchors.get(activeDimension.startAnchorId) && anchors.get(activeDimension.endAnchorId) && <line className="parameter-glow" x1={pointMm(anchors.get(activeDimension.startAnchorId)!.point.x)} y1={pointMm(anchors.get(activeDimension.startAnchorId)!.point.y)} x2={pointMm(anchors.get(activeDimension.endAnchorId)!.point.x)} y2={pointMm(anchors.get(activeDimension.endAnchorId)!.point.y)} />}
            {!activeDimension && fallbackHighlightPath && <path className="parameter-glow" d={firstHighlightSegment(fallbackHighlightPath)} />}
          </g>}
          <g data-layer="manufacturing-geometry">
            {scene.paths.filter((path) => visibleRoles.has(path.role)).map((path) => <path key={path.id} id={path.id} data-role={path.role} className={`dieline-path role-${path.role}`} d={pathToSvg(path)} />)}
          </g>
        </g>
        <text className="sheet-label" x="8" y={sheetH - 8}>{sheetName} · {formatMeasurement(layout.sheetWidthUm, "mm", 0)} × {formatMeasurement(layout.sheetHeightUm, "mm", 0)} · {Math.round(layout.utilization * 100)}% used</text>
      </svg>
    </div>
    <div className="canvas-tools" aria-label="Canvas controls"><IconButton label="Select tool" active><MousePointer2 size={16}/></IconButton><span className="tool-separator"/><IconButton label={showGrid ? "Hide grid" : "Show grid"} active={showGrid} onClick={onToggleGrid}><Grid3X3 size={16}/></IconButton><IconButton label="Fit dieline to view" onClick={onFitDieline}><Maximize2 size={16}/></IconButton><span className="tool-separator"/><IconButton label="Zoom out" onClick={() => setZoom(Math.max(MIN_ZOOM, zoom / 1.25))}><Minus size={16}/></IconButton><button className="zoom-readout" title="Reset to sheet overview" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button><IconButton label="Zoom in" onClick={() => setZoom(Math.min(MAX_ZOOM, zoom * 1.25))}><Plus size={16}/></IconButton></div>
  </div>;
}

export default function Editor() {
  const { project, past, future, savedAt, hydrate, setParameter, setTemplate, setName, setOpeningStyle, setTuckPanel, setLockStyle, setGlueAngle, setDustTaper, setSliceAngle, setWallConstruction, setMaterialThickness, setSheetPreset, setCustomSheetSize, setOrientation, setCreaseMode, undo, redo, reset } = useProjectStore();
  const [leftTab, setLeftTab] = useState<LeftTab>("templates");
  const [templateSearch, setTemplateSearch] = useState("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("design");
  const [selectedParameter, setSelectedParameter] = useState<ParameterId>();
  const [openSlider, setOpenSlider] = useState<SliderId>();
  const parameterFieldKey = (id: ParameterId) => `${project.template.id}-${id}`;
  const unitFieldKey = (id: Exclude<SliderId, ParameterId>) => id;
  const [visibleRoles, setVisibleRoles] = useState<Set<LineRole>>(new Set(VISIBLE_ROLES));
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">();
  const [advancedConstruction, setAdvancedConstruction] = useState(true);
  const scene = useMemo(() => generateProjectScene(project), [project]);
  const layout = useMemo(() => calculateSheetFit(scene, project), [scene, project]);
  const errors = scene.warnings.filter((warning) => warning.severity === "error");
  const fitDieline = () => { setZoom(calculateDielineFitZoom(scene, layout)); setPan({ x: 0, y: 0 }); };
  const closeSlider = useCallback(() => setOpenSlider(undefined), []);
  const parameterSliderProps = (id: ParameterId) => ({ active: selectedParameter === id, sliderOpen: openSlider === id, onOpenSlider: () => { setSelectedParameter(id); setOpenSlider(id); }, onCloseSlider: closeSlider });
  const selectTemplate = (id: TemplateId) => { setTemplate(id); setSelectedParameter(undefined); setOpenSlider(undefined); setZoom(1); setPan({ x: 0, y: 0 }); setInspectorTab("design"); setMobilePanel(undefined); };
  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const workingTemplates = WORKING_TEMPLATES.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(normalizedTemplateSearch));
  const upcomingTemplates = UPCOMING_TEMPLATES.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(normalizedTemplateSearch));
  const isLockBottom = project.template.id === "crash-lock-carton" || project.template.id === "auto-lock-bottom";
  const isTaperedBox = project.template.id === "trapezoid-box";
  const isBag = project.template.id === "bag";
  const isEnvelope = project.template.id === "envelope";
  const isPillowPack = project.template.id === "pillow-pack";
  const isCartonBand = project.template.id === "tuck-end-carton" || isLockBottom;
  const isFoldOverWall = project.construction.wallConstruction !== "single-wall";
  const isLockingWall = project.construction.wallConstruction === "fold-over-lock";
  const isTuckWall = project.construction.wallConstruction === "fold-over-tuck";
  const finishedFields: readonly { id: ParameterId; label: string }[] = isBag
    ? [{ id: "width", label: "Face width" }, { id: "depth", label: "Bag depth" }, { id: "height", label: "Bag height" }]
    : isEnvelope
      ? [{ id: "width", label: "Envelope width" }, { id: "height", label: "Envelope height" }]
      : isPillowPack
        ? [{ id: "width", label: "Pack width" }, { id: "depth", label: "Pack length" }, { id: "height", label: "Crown height" }]
        : isTaperedBox
    ? [{ id: "topLength", label: "Top length" }, { id: "topWidth", label: "Top width" }, { id: "bottomLength", label: "Bottom length" }, { id: "bottomWidth", label: "Bottom width" }, { id: "height", label: "Vertical height" }]
    : project.template.id === "box-with-lid"
    ? [{ id: "width", label: "Length" }, { id: "depth", label: "Width" }, { id: "height", label: "Base height" }, { id: "lidHeight", label: "Lid height" }]
    : project.template.id === "cake-slice-box"
      ? [{ id: "width", label: "Radial length" }, { id: "height", label: "Base wall" }, { id: "lidHeight", label: "Lid wall" }]
    : project.template.id === "match-box"
      ? [{ id: "width", label: "Length" }, { id: "depth", label: "Width" }, { id: "height", label: "Tray height" }]
      : [{ id: "width", label: "Width" }, { id: "depth", label: "Depth" }, { id: "height", label: "Height" }];
  const matingLength = um(project.parameters.width + project.material.thicknessUm * 2 + project.parameters.clearance * (project.template.id === "box-with-lid" ? 2 : 1));
  const matingWidth = um(project.parameters.depth + project.material.thicknessUm * 2 + project.parameters.clearance * 2);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); setNotice("Project saved locally"); }
      if (event.key === "Escape") { setExportOpen(false); setSelectedParameter(undefined); }
    };
    window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard);
  }, [redo, undo]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(undefined), 2400); return () => window.clearTimeout(timer); }, [notice]);

  const exportAction = useCallback(async (kind: "svg" | "pdf" | "dxf" | "png" | "json") => {
    if (errors.length && kind !== "json") { setNotice("Resolve geometry errors before exporting"); return; }
    try {
      if (kind === "svg") downloadSvg(scene, layout, project);
      if (kind === "pdf") await downloadPdf(scene, layout, project);
      if (kind === "dxf") downloadDxf(scene, project);
      if (kind === "png") await downloadPng(scene, layout, project);
      if (kind === "json") downloadProject(project);
      setExportOpen(false); setNotice(`${kind.toUpperCase()} prepared from the current parametric model`);
    } catch { setNotice(`Could not prepare ${kind.toUpperCase()}`); }
  }, [errors.length, layout, project, scene]);

  const toggleRole = (role: LineRole) => setVisibleRoles((current) => { const next = new Set(current); if (next.has(role)) next.delete(role); else next.add(role); return next; });

  return <main className="studio-shell">
    <header className="topbar">
      <div className="topbar-brand"><button className="mobile-menu" onClick={() => setMobilePanel("left")} aria-label="Open templates"><Menu size={19}/></button><BrandMark/><span>Foldform</span><span className="product-tag">STUDIO</span></div>
      <div className="document-title"><input defaultValue={project.name} onBlur={(e) => setName(e.target.value)} aria-label="Project name"/><span>·</span><span className="saved-state"><Save size={12}/>{savedAt ? "Saved locally" : "New project"}</span></div>
      <div className="topbar-actions">
        <div className="history-controls"><IconButton label="Undo" disabled={!past.length} onClick={undo}><Undo2 size={17}/></IconButton><IconButton label="Redo" disabled={!future.length} onClick={redo}><Redo2 size={17}/></IconButton></div>
        <span className="unit-badge" title="Editor measurements use millimetres">mm</span>
        <div className="export-wrap"><button className="export-button" onClick={() => setExportOpen(!exportOpen)}><Download size={16}/> Export <ChevronDown size={14}/></button>{exportOpen && <div className="export-menu"><div className="export-menu-head"><strong>Export manufacturing file</strong><span>Generated from the current model</span></div><button onClick={() => exportAction("svg")}><FileCode2/><span><strong>SVG</strong><small>Layered vector · cutters</small></span></button><button onClick={() => exportAction("pdf")}><FileText/><span><strong>PDF</strong><small>Vector print sheet · 1:1 scale</small></span></button><button onClick={() => exportAction("dxf")}><Maximize2/><span><strong>DXF</strong><small>CAD layers · millimetres</small></span></button><button onClick={() => exportAction("png")}><FileImage/><span><strong>PNG</strong><small>180 DPI proof image</small></span></button><div className="export-divider"/><button onClick={() => exportAction("json")}><Save/><span><strong>Project JSON</strong><small>Versioned parameters</small></span></button></div>}</div>
        <button className="mobile-inspector" onClick={() => setMobilePanel("right")} aria-label="Open inspector"><Settings2 size={18}/></button>
      </div>
    </header>

    <div className="workspace-grid">
      <aside className={`left-sidebar${mobilePanel === "left" ? " mobile-open" : ""}`}>
        <div className="mobile-panel-head"><strong>Project</strong><button onClick={() => setMobilePanel(undefined)}><X size={18}/></button></div>
        <div className="sidebar-tabs"><button className={leftTab === "templates" ? "active" : ""} onClick={() => setLeftTab("templates")}><Box size={15}/> Templates</button><button className={leftTab === "layers" ? "active" : ""} onClick={() => setLeftTab("layers")}><Layers3 size={15}/> Layers</button></div>
        {leftTab === "templates" ? <div className="sidebar-content">
          <label className="search-field"><Search size={15}/><input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Search templates" aria-label="Search templates"/>{templateSearch && <button type="button" aria-label="Clear template search" onClick={() => setTemplateSearch("")}><X size={13}/></button>}</label>
          <div className="section-heading"><span>WORKING TEMPLATES</span><small>{workingTemplates.length} available</small></div>
          <div className="template-list">{workingTemplates.map((item) => <TemplateCard key={item.id} active={project.template.id === item.id} id={item.id} title={item.title} meta={item.meta} onClick={() => selectTemplate(item.id)}/>)}</div>
          {upcomingTemplates.length > 0 && <><div className="section-heading second"><span>NEXT CLOSURES</span></div><div className="template-list">{upcomingTemplates.map((item) => <TemplateCard key={item.title} id={item.title === "Cone" ? "cone" : "gift-box"} locked title={item.title} meta={item.meta}/>)}</div></>}
          {!workingTemplates.length && !upcomingTemplates.length && <div className="template-empty"><Search size={18}/><strong>No matching templates</strong><span>Try box, sleeve, tuck, or lock.</span></div>}
          <button className="request-template"><Sparkles size={15}/> Request a template</button>
        </div> : <div className="sidebar-content layer-panel">
          <div className="section-heading"><span>MANUFACTURING LAYERS</span><small>{visibleRoles.size} visible</small></div>
          {VISIBLE_ROLES.map((role) => <button className="layer-row" key={role} onClick={() => toggleRole(role)}><span className={`role-swatch swatch-${role}`}/><span><strong>{ROLE_LABELS[role]}</strong><small>{scene.paths.filter((path) => path.role === role).length} semantic paths</small></span>{visibleRoles.has(role) ? <Eye size={16}/> : <EyeOff size={16}/>}</button>)}
          <div className="layer-note"><LockKeyhole size={15}/><p><strong>Semantic layers are protected</strong><span>Roles travel with the geometry into SVG, PDF, and DXF exports.</span></p></div>
        </div>}
      </aside>

      <section className="canvas-area">
        <DielineCanvas project={project} selectedParameter={selectedParameter} visibleRoles={visibleRoles} showGrid={showGrid} onToggleGrid={() => setShowGrid((value) => !value)} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} onFitDieline={fitDieline}/>
      </section>

      <aside className={`inspector${mobilePanel === "right" ? " mobile-open" : ""}`}>
        <div className="mobile-panel-head"><strong>Inspector</strong><button onClick={() => setMobilePanel(undefined)}><X size={18}/></button></div>
        <div className="inspector-tabs">{(["design", "material", "sheet"] as const).map((tab) => <button key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>)}</div>
        <div className="inspector-scroll">
          {inspectorTab === "design" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>FINISHED SIZE</span><small>Inside dimensions · mm</small></div><Ruler size={16}/></div><div className="parameter-grid">{finishedFields.map(({ id, label }) => <ParameterField key={parameterFieldKey(id)} id={id} label={label} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div><div className="parameter-hint"><MousePointer2 size={14}/> The measured edge glows on the dieline</div></section>
            {isCartonBand ? <section className="inspector-section"><div className="inspector-heading"><div><span>{isLockBottom ? "LOCK-BOTTOM CONSTRUCTION" : "END CONSTRUCTION"}</span><small>{isLockBottom ? "Tuck top and controlled collapsing base" : "Independent closing and tuck geometry"}</small></div><Settings2 size={16}/></div>
              {!isLockBottom && <><span className="control-label">Opening style</span><div className="segmented-control two-up"><button className={project.construction.openingStyle === "straight-tuck" ? "active" : ""} onClick={() => setOpeningStyle("straight-tuck")}>Straight tuck</button><button className={project.construction.openingStyle === "reverse-tuck" ? "active" : ""} onClick={() => setOpeningStyle("reverse-tuck")}>Reverse tuck</button></div></>}
              {isLockBottom && <div className="construction-badge"><LockKeyhole size={14}/><span><strong>{project.template.id === "crash-lock-carton" ? "Crash-lock base" : "Hooked auto-lock base"}</strong><small>Two diagonal collapse folds · pre-glued major flaps</small></span></div>}
              <div className="parameter-grid construction-grid">{(["tuckFlap", "glueFlap", ...(isLockBottom ? ["bottomFlap", "lockOverlap"] : [])] as ParameterId[]).map((id) => <ParameterField key={parameterFieldKey(id)} id={id} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div>
              <button className={`advanced-toggle${advancedConstruction ? " open" : ""}`} onClick={() => setAdvancedConstruction(!advancedConstruction)}><Settings2 size={13}/> Advanced construction <ChevronDown size={13}/></button>
              {advancedConstruction && <div className="advanced-controls">
                <div className="parameter-grid">{(["dustFlap", "thumbHole", "cornerRadius", "clearance"] as ParameterId[]).map((id) => <ParameterField key={parameterFieldKey(id)} id={id} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div>
                <span className="control-label">Tuck panel</span><div className="segmented-control two-up"><button className={project.construction.tuckPanel === "front" ? "active" : ""} onClick={() => setTuckPanel("front")}>Front</button><button className={project.construction.tuckPanel === "back" ? "active" : ""} onClick={() => setTuckPanel("back")}>Back</button></div>
                <span className="control-label">Lock geometry</span><div className="segmented-control two-up"><button className={project.construction.lockStyle === "slit-lock" ? "active" : ""} onClick={() => setLockStyle("slit-lock")}>Slit lock</button><button className={project.construction.lockStyle === "friction" ? "active" : ""} onClick={() => setLockStyle("friction")}>Friction</button></div>
                <div className="numeric-grid"><UnitNumberField key={unitFieldKey("glue-angle")} label="Glue angle" value={project.construction.glueAngleMilliDegrees / 1000} min={45} max={90} unit="°" onCommit={setGlueAngle} sliderOpen={openSlider === "glue-angle"} onOpenSlider={() => setOpenSlider("glue-angle")} onCloseSlider={closeSlider}/><UnitNumberField key={unitFieldKey("dust-taper")} label="Dust taper / side" value={project.construction.dustTaperPercent} min={0} max={40} unit="%" onCommit={setDustTaper} sliderOpen={openSlider === "dust-taper"} onOpenSlider={() => setOpenSlider("dust-taper")} onCloseSlider={closeSlider}/></div>
              </div>}
            </section> : isBag ? <section className="inspector-section"><div className="inspector-heading"><div><span>GUSSETED BAG</span><small>Four-panel band · paired gusset folds · folded bottom</small></div><Settings2 size={16}/></div>
              <div className="parameter-grid construction-grid">{(["topFold", "glueFlap"] as ParameterId[]).map((id) => <ParameterField key={parameterFieldKey(id)} id={id} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div>
              <div className="material-stats"><div><span>Derived side gusset</span><strong>{formatMeasurement(um(Math.round(project.parameters.depth / 2)), "mm", 2)}</strong></div><div><span>Interlocking bottom depth</span><strong>{formatMeasurement(um(Math.round(project.parameters.width / 2)), "mm", 2)}</strong></div><div><span>Band circumference</span><strong>{formatMeasurement(um(project.parameters.width * 2 + project.parameters.depth * 2), "mm", 2)}</strong></div></div>
              <p className="section-copy">The top fold is a real reinforcement return and may be set to 0 mm. Side gussets derive from half the bag depth; the bottom uses paired face diagonals, side-panel centers, and a seam relief fold so the bag collapses flat and opens square.</p>
            </section> : isEnvelope ? <section className="inspector-section"><div className="inspector-heading"><div><span>PLANAR WRAP</span><small>Central face · four independently folded flaps</small></div><Settings2 size={16}/></div>
              <div className="parameter-grid construction-grid">{(["overlap", "cornerRadius"] as ParameterId[]).map((id) => <ParameterField key={parameterFieldKey(id)} id={id} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div>
              <div className="material-stats"><div><span>Side-flap reach</span><strong>{formatMeasurement(um(Math.round(project.parameters.width / 2 + project.parameters.overlap / 2)), "mm", 2)}</strong></div><div><span>Bottom overlap</span><strong>{formatMeasurement(project.parameters.overlap, "mm", 2)}</strong></div></div>
              <p className="section-copy">Four closing flaps surround one finished rectangle. Side flaps cross by the selected overlap; the bottom flap carries the two glue regions, and all four exposed tips use the selected analytic corner radius.</p>
            </section> : isPillowPack ? <section className="inspector-section"><div className="inspector-heading"><div><span>CURVED CLOSURE</span><small>Two-panel band · analytic circular score arcs</small></div><Settings2 size={16}/></div>
              <div className="parameter-grid construction-grid">{(["glueFlap", "clearance"] as ParameterId[]).map((id) => <ParameterField key={parameterFieldKey(id)} id={id} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div>
              <div className="material-stats"><div><span>Closure radius</span><strong>{formatMeasurement(um(Math.round(project.parameters.width ** 2 / (8 * project.parameters.height) + project.parameters.height / 2)), "mm", 2)}</strong></div><div><span>Body circumference</span><strong>{formatMeasurement(um(project.parameters.width * 2), "mm", 2)}</strong></div></div>
              <p className="section-copy">Crown height is the circular-arc sagitta. Changing it regenerates the exact score radius instead of approximating the closure with Bézier or straight segments.</p>
            </section> : isTaperedBox ? <section className="inspector-section"><div className="inspector-heading"><div><span>TAPERED SHELL</span><small>Centered rectangular frustum · true developed wall slopes</small></div><Settings2 size={16}/></div>
              <div className="construction-badge"><PackageOpen size={14}/><span><strong>Parametric frustum net</strong><small>Four tapered walls · glued corners · tuck-top closure</small></span></div>
              <div className="parameter-grid construction-grid">{(["tuckFlap", "dustFlap", "glueFlap", "thumbHole", "clearance"] as ParameterId[]).map((id) => <ParameterField key={parameterFieldKey(id)} id={id} project={project} onCommit={setParameter} {...parameterSliderProps(id)}/>)}</div>
              <div className="material-stats"><div><span>Length-side slant</span><strong>{formatMeasurement(um(Math.round(Math.hypot(project.parameters.height, (project.parameters.bottomLength - project.parameters.topLength) / 2))), "mm", 2)}</strong></div><div><span>Width-side slant</span><strong>{formatMeasurement(um(Math.round(Math.hypot(project.parameters.height, (project.parameters.bottomWidth - project.parameters.topWidth) / 2))), "mm", 2)}</strong></div><div><span>Lateral corner edge</span><strong>{formatMeasurement(um(Math.round(Math.hypot(project.parameters.height, (project.parameters.bottomLength - project.parameters.topLength) / 2, (project.parameters.bottomWidth - project.parameters.topWidth) / 2))), "mm", 2)}</strong></div></div>
              <p className="section-copy">The top and bottom rectangles stay centered. Their offsets and the vertical height derive both wall slants and every corner edge. The rear wall carries a full closing panel and tuck tongue; side walls carry tapered dust flaps.</p>
            </section> : <section className="inspector-section"><div className="inspector-heading"><div><span>ASSEMBLY FIT</span><small>{isLockingWall ? "Reinforced returned walls · mechanical base locks" : isTuckWall ? "Reinforced returned walls · glued return" : project.template.id === "box-with-lid" ? "Single-wall base and lid · four glued corners" : project.template.id === "cake-slice-box" ? "Convex triangular profile · three glued corners per part" : "Single-wall tray and sliding sleeve"}</small></div><Settings2 size={16}/></div>
              <span className="control-label">Wall construction</span><div className="segmented-control"><button className={project.construction.wallConstruction === "single-wall" ? "active" : ""} onClick={() => setWallConstruction("single-wall")}>Quick</button><button className={isTuckWall ? "active" : ""} onClick={() => setWallConstruction("fold-over-tuck")}>Glue wall</button><button className={isLockingWall ? "active" : ""} onClick={() => setWallConstruction("fold-over-lock")}>Lock wall</button></div>
              <div className={`wall-choice-note ${isFoldOverWall ? "reinforced" : "quick"}`}><span>{isLockingWall ? <LockKeyhole size={14}/> : isTuckWall ? <RotateCcw size={14}/> : <Zap size={14}/>}</span><p><strong>{isLockingWall ? "Fold-over locking walls" : isTuckWall ? "Glued fold-over walls" : "Single-wall glued corners"}</strong><small>{isLockingWall ? "Returned inner wall with one or two fitted locks per edge." : isTuckWall ? "Returned liner glues over the corner flap and first wall; no terminal tab or slot." : "Less material and fewer folds for fast manual assembly."}</small></p></div>
              {project.template.id === "cake-slice-box" && <UnitNumberField key={unitFieldKey("slice-angle")} className="assembly-angle" label="Slice angle" value={project.construction.sliceAngleMilliDegrees / 1000} min={15} max={90} unit="°" onCommit={setSliceAngle} sliderOpen={openSlider === "slice-angle"} onOpenSlider={() => setOpenSlider("slice-angle")} onCloseSlider={closeSlider}/>}
              <div className="parameter-grid construction-grid"><ParameterField key={parameterFieldKey("glueFlap")} id="glueFlap" label={project.template.id === "match-box" ? "Corner / seam glue" : "Corner glue tab"} project={project} onCommit={setParameter} {...parameterSliderProps("glueFlap")}/><ParameterField key={parameterFieldKey("clearance")} id="clearance" label={`${project.template.id === "match-box" ? "Sleeve" : "Lid"}${isLockingWall ? " / slot" : ""} clearance`} project={project} onCommit={setParameter} {...parameterSliderProps("clearance")}/>{isLockingWall && <ParameterField key={parameterFieldKey("lockTab")} id="lockTab" label="Lock tab depth" project={project} onCommit={setParameter} {...parameterSliderProps("lockTab")}/>}</div>
              <UnitNumberField key={unitFieldKey("glue-angle")} className="assembly-angle" label="Glue tab angle" value={project.construction.glueAngleMilliDegrees / 1000} min={45} max={90} unit="°" onCommit={setGlueAngle} sliderOpen={openSlider === "glue-angle"} onOpenSlider={() => setOpenSlider("glue-angle")} onCloseSlider={closeSlider}/>
              <div className="material-stats">{project.template.id === "cake-slice-box" ? <><div><span>Rear slice width</span><strong>{formatMeasurement(um(Math.round(2 * project.parameters.width * Math.sin(project.construction.sliceAngleMilliDegrees / 2000 * Math.PI / 180))), "mm", 2)}</strong></div><div><span>Uniform lid offset</span><strong>{formatMeasurement(um(project.material.thicknessUm + project.parameters.clearance), "mm", 2)}</strong></div></> : <><div><span>{project.template.id === "box-with-lid" ? "Lid inside length" : "Sleeve inside length"}</span><strong>{formatMeasurement(matingLength, "mm", 2)}</strong></div><div><span>{project.template.id === "box-with-lid" ? "Lid inside width" : "Sleeve inside width"}</span><strong>{formatMeasurement(matingWidth, "mm", 2)}</strong></div></>}{isFoldOverWall && <div><span>Fold-over rim allowance</span><strong>{formatMeasurement(um(project.material.thicknessUm * 2 + project.material.scoreAllowanceUm), "mm", 2)}</strong></div>}{isLockingWall && <div><span>Lock-slot aperture</span><strong>{formatMeasurement(um(project.material.thicknessUm + project.parameters.clearance), "mm", 2)}</strong></div>}<div><span>Caliper compensation</span><strong>{formatMeasurement(um(project.material.thicknessUm * 2), "mm", 2)}</strong></div></div>
              <p className="section-copy">{isLockingWall ? "Each edge is generated as an outer wall, material-compensated rim bridge, returned inner wall, fitted locking tabs, and closed base slots sized to board caliper plus clearance. Narrow edges automatically use one centered lock; wider edges use two. Corner tabs remain available for maximum rigidity." : isTuckWall ? "Each edge receives a material-compensated rim and returned inner wall. The liner is glued over the corner flap and first wall, so no terminal tuck tab, locking tab, or receiving slot is generated." : project.template.id === "cake-slice-box" ? "The lid is a true uniform offset of the nominal triangular profile. Each profile edge receives one wall and one semantically folded corner tab." : "Each wall is one finished-height flap with one base crease. The corner tabs secure the quick-fold construction."}</p>
            </section>}
            <section className="inspector-section constraint-section"><div className="inspector-heading"><div><span>INTEGRITY CHECK</span><small>{scene.warnings.length ? `${scene.warnings.length} issue${scene.warnings.length === 1 ? "" : "s"}` : "All checks passed"}</small></div>{scene.warnings.length ? <AlertTriangle size={16}/> : <Check size={16}/>}</div>{scene.warnings.length ? scene.warnings.map((warning) => <button key={warning.id} className={`constraint-card ${warning.severity}`} onClick={() => { setSelectedParameter(warning.parameterIds[0]); closeSlider(); }}><AlertTriangle size={15}/><span><strong>{warning.message}</strong>{warning.technicalDetails && <small>{warning.technicalDetails}</small>}<code>{warning.id}</code></span></button>) : <div className="integrity-ok"><span><Check size={16}/></span><p><strong>Manufacturable geometry</strong><small>{scene.parts?.length ?? 1} part{(scene.parts?.length ?? 1) === 1 ? "" : "s"} · {scene.foldGraph?.connections.length ?? 0} verified folds · all anchors resolved</small></p></div>}</section>
          </>}
          {inspectorTab === "material" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>MATERIAL PROFILE</span><small>Thickness drives shoulders, clearance, and scoring · mm</small></div><Layers3 size={16}/></div><label className="select-field"><span>Stock</span><select defaultValue="SBS"><option>SBS paperboard</option><option>FBB paperboard</option><option>Recycled chipboard</option></select></label><div className="material-edit"><MeasurementField key={unitFieldKey("material-thickness")} label="Material thickness" value={project.material.thicknessUm} project={project} onCommit={setMaterialThickness} minUm={100} maxUm={10_000} stepUm={100} sliderOpen={openSlider === "material-thickness"} onOpenSlider={() => setOpenSlider("material-thickness")} onCloseSlider={closeSlider}/></div><div className="material-stats"><div><span>Board caliper</span><strong>{formatMeasurement(project.material.thicknessUm, "mm", 2)}</strong></div><div><span>Estimated score allowance</span><strong>{formatMeasurement(project.material.scoreAllowanceUm, "mm", 2)}</strong></div><div><span>Cut kerf</span><strong>{formatMeasurement(project.material.kerfUm, "mm", 2)}</strong></div></div><p className="section-copy material-note">Board caliper is the physical material thickness. Score allowance is estimated at 1.25× caliper and rounded to 0.05 mm; confirm the crease rule and channel with your board supplier.</p></section>
            <section className="inspector-section"><div className="inspector-heading"><div><span>CREASE OUTPUT</span><small>Manufacturing convention</small></div><Zap size={16}/></div><div className="segmented-control">{(["line", "dash", "perforation"] as const).map((mode) => <button key={mode} className={project.exportProfile.creaseMode === mode ? "active" : ""} onClick={() => setCreaseMode(mode)}>{mode}</button>)}</div><p className="section-copy">Crease roles stay semantic in the project; this only changes their output representation.</p></section>
          </>}
          {inspectorTab === "sheet" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>SHEET LAYOUT</span><small>Production sheet dimensions · mm</small></div><FileText size={16}/></div><label className="select-field"><span>Sheet preset</span><select value={project.sheet.preset} onChange={(event) => setSheetPreset(event.target.value as ProjectDocument["sheet"]["preset"])}><option value="600x400">600 × 400 mm</option><option value="700x500">700 × 500 mm</option><option value="Custom">Custom size</option></select></label>{project.sheet.preset === "Custom" && <div className="custom-sheet-grid"><MeasurementField key={unitFieldKey("sheet-width")} label="Sheet width" value={project.sheet.widthUm} project={project} onCommit={(value) => setCustomSheetSize(value, project.sheet.heightUm)} minUm={50_000} maxUm={2_000_000} sliderOpen={openSlider === "sheet-width"} onOpenSlider={() => setOpenSlider("sheet-width")} onCloseSlider={closeSlider}/><MeasurementField key={unitFieldKey("sheet-height")} label="Sheet height" value={project.sheet.heightUm} project={project} onCommit={(value) => setCustomSheetSize(project.sheet.widthUm, value)} minUm={50_000} maxUm={2_000_000} sliderOpen={openSlider === "sheet-height"} onOpenSlider={() => setOpenSlider("sheet-height")} onCloseSlider={closeSlider}/></div>}<label className="select-field"><span>Orientation</span><select value={project.sheet.orientation} onChange={(event) => setOrientation(event.target.value as ProjectDocument["sheet"]["orientation"])}><option value="auto">Auto — best fit</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><div className={`sheet-result ${layout.fits ? "fits" : "overflow"}`}><span>{layout.fits ? <Check size={18}/> : <AlertTriangle size={18}/>}</span><p><strong>{layout.fits ? `Fits in ${layout.orientation}` : "Sheet overflow"}</strong><small>{formatMeasurement(layout.contentWidthUm, "mm", 0)} × {formatMeasurement(layout.contentHeightUm, "mm", 0)} content · {Math.round(layout.utilization * 100)}% sheet use</small></p></div>{layout.suggestion && <p className="section-copy">{layout.suggestion}</p>}</section>
            <section className="inspector-section"><div className="inspector-heading"><div><span>OUTPUT CALIBRATION</span><small>Physical size controls</small></div><CircleHelp size={16}/></div><div className="calibration-row"><span>Document scale</span><strong>1:1</strong></div><div className="calibration-row"><span>Document units</span><strong>Millimetres</strong></div><div className="calibration-row"><span>Registration</span><strong>Off</strong></div></section>
          </>}
          <button className="reset-button" onClick={reset}><RotateCcw size={15}/> Reset template defaults</button>
        </div>
      </aside>
    </div>
    {mobilePanel && <button className="mobile-scrim" aria-label="Close panel" onClick={() => setMobilePanel(undefined)}/>} 
    {notice && <div className="toast" role="status"><Check size={15}/>{notice}</div>}
  </main>;
}

"use client";

import {
  AlertTriangle, Box, Check, ChevronDown, CircleHelp, Download, Eye, EyeOff,
  FileCode2, FileImage, FileText, Grid3X3, Layers3, LockKeyhole,
  Maximize2, Menu, Minus, MousePointer2, PackageOpen, Plus,
  Redo2, RotateCcw, Ruler, Save, Search, Settings2, Sparkles, Undo2, X, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  PARAMETER_LABELS, PARAMETER_LIMITS, ROLE_LABELS, anchorMap, calculateSheetFit, formatMeasurement,
  generateProjectScene, parseMeasurement, pathToSvg, pointMm, type DimensionSpec,
  type DielineScene, type LayoutResult, type LineRole, type Micrometres, type ParameterId, type ProjectDocument, type TemplateId, um,
} from "./lib/dieline";
import { downloadDxf, downloadPdf, downloadPng, downloadProject, downloadSvg } from "./lib/exporters";
import { useProjectStore } from "./lib/store";

type LeftTab = "templates" | "layers";
type InspectorTab = "design" | "material" | "sheet";
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
};
const WORKING_TEMPLATES: readonly { id: TemplateId; title: string; meta: string }[] = [
  { id: "tuck-end-carton", title: "Tuck-end carton", meta: "Straight / reverse · glued seam" },
  { id: "crash-lock-carton", title: "Crash-lock carton", meta: "Pre-glued diagonal base" },
  { id: "auto-lock-bottom", title: "Auto-lock bottom", meta: "Hooked automatic base" },
  { id: "box-with-lid", title: "Box with lid", meta: "Two-piece base + lid" },
  { id: "match-box", title: "Match box", meta: "Tray + sliding sleeve" },
  { id: "cake-slice-box", title: "Cake slice box", meta: "Triangular tray + fitted lid" },
];
const UPCOMING_TEMPLATES = [
  { title: "Bag", meta: "Gusseted panel band" },
  { title: "Pillow pack", meta: "Curved score closures" },
] as const;

function calculateDielineFitZoom(scene: DielineScene, layout: LayoutResult): number {
  const sheetW = pointMm(layout.sheetWidthUm), sheetH = pointMm(layout.sheetHeightUm);
  const sceneW = pointMm(um(scene.bounds.maxX - scene.bounds.minX)), sceneH = pointMm(um(scene.bounds.maxY - scene.bounds.minY));
  const baseScale = Math.max(0.35, Math.min(1.15, Math.min((sheetW - 16) / sceneW, (sheetH - 16) / sceneH)));
  return Math.max(1, Math.min(MAX_ZOOM, Math.min(sheetW / (sceneW * baseScale), sheetH / (sceneH * baseScale)) * 0.86));
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function IconButton({ label, children, disabled, onClick, active }: { label: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void; active?: boolean }) {
  return <button className={`icon-button${active ? " active" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function ParameterField({ id, project, onCommit, compact = false, label = PARAMETER_LABELS[id] }: { id: ParameterId; project: ProjectDocument; onCommit: (id: ParameterId, value: Micrometres) => void; compact?: boolean; label?: string }) {
  const value = project.parameters[id];
  const [raw, setRaw] = useState(formatMeasurement(value, project.display.unit, project.display.precision));
  const [error, setError] = useState<string>();
  const commit = () => {
    const parsed = parseMeasurement(raw, project.display.unit);
    if (!parsed.ok) { setError(parsed.message); return; }
    setError(undefined); onCommit(id, parsed.value);
  };
  return <label className={`parameter-field${compact ? " compact" : ""}${error ? " has-error" : ""}`}>
    <span>{label}</span>
    <input value={raw} onChange={(event) => setRaw(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setRaw(formatMeasurement(value, project.display.unit, project.display.precision)); setError(undefined); event.currentTarget.blur(); } }} aria-invalid={Boolean(error)} aria-label={`${label}, ${formatMeasurement(value, project.display.unit)}`} />
    {error && <small>{error}</small>}
  </label>;
}

function MeasurementField({ label, value, project, onCommit, minUm, maxUm }: { label: string; value: Micrometres; project: ProjectDocument; onCommit: (value: Micrometres) => void; minUm?: number; maxUm?: number }) {
  const [raw, setRaw] = useState(formatMeasurement(value, project.display.unit, project.display.precision));
  const [error, setError] = useState<string>();
  const commit = () => {
    const parsed = parseMeasurement(raw, project.display.unit);
    if (!parsed.ok) { setError(parsed.message); return; }
    if ((minUm !== undefined && parsed.value < minUm) || (maxUm !== undefined && parsed.value > maxUm)) {
      setError(`Use ${minUm !== undefined ? formatMeasurement(um(minUm), "mm", 1) : "a smaller value"} to ${maxUm !== undefined ? formatMeasurement(um(maxUm), "mm", 0) : "a larger value"}`); return;
    }
    setError(undefined); onCommit(parsed.value);
  };
  return <label className={`parameter-field${error ? " has-error" : ""}`}><span>{label}</span><input value={raw} onChange={(event) => setRaw(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { commit(); event.currentTarget.blur(); } }} />{error && <small>{error}</small>}</label>;
}

function TemplateCard({ active, title, meta, locked, onClick }: { active?: boolean; title: string; meta: string; locked?: boolean; onClick?: () => void }) {
  return <button className={`template-card${active ? " active" : ""}${locked ? " locked" : ""}`} onClick={onClick} disabled={locked}>
    <span className="template-thumb" aria-hidden="true">
      {title === "Tuck-end carton" ? <><i className="net-main" /><i className="net-side" /><i className="net-flap" /></> : <PackageOpen size={32} strokeWidth={1.25} />}
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
  onSelectParameter: (id?: ParameterId) => void;
  visibleRoles: Set<LineRole>;
  showGrid: boolean;
  zoom: number;
  setZoom: (value: number) => void;
  pan: { x: number; y: number };
  setPan: (value: { x: number; y: number }) => void;
  onFitDieline: () => void;
  previewParameter: (id: ParameterId, value: Micrometres) => void;
  commitParameterDrag: (id: ParameterId, original: Micrometres, value: Micrometres) => void;
  setParameter: (id: ParameterId, value: Micrometres) => void;
}

interface DimensionEditorState {
  id: ParameterId;
  x: number;
  y: number;
  original: Micrometres;
  value: Micrometres;
  manual: boolean;
  raw: string;
  error?: string;
}

function DielineCanvas({ project, selectedParameter, onSelectParameter, visibleRoles, showGrid, zoom, setZoom, pan, setPan, onFitDieline, previewParameter, commitParameterDrag, setParameter }: CanvasProps) {
  const scene = useMemo(() => generateProjectScene(project), [project]);
  const layout = useMemo(() => calculateSheetFit(scene, project), [scene, project]);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [dimensionEditor, setDimensionEditor] = useState<DimensionEditorState>();
  const dragRef = useRef<{ type: "pan"; x: number; y: number; ox: number; oy: number } | { type: "dimension"; id: ParameterId; startValue: Micrometres; x: number; y: number } | undefined>(undefined);
  const anchors = useMemo(() => anchorMap(scene), [scene]);
  const sheetW = pointMm(layout.sheetWidthUm), sheetH = pointMm(layout.sheetHeightUm);
  const sceneW = pointMm(um(scene.bounds.maxX - scene.bounds.minX)), sceneH = pointMm(um(scene.bounds.maxY - scene.bounds.minY));
  const fitScale = Math.min((sheetW - 16) / sceneW, (sheetH - 16) / sceneH);
  const baseScale = Math.max(0.35, Math.min(1.15, fitScale));
  const contentX = (sheetW - sceneW * baseScale) / 2 - pointMm(scene.bounds.minX) * baseScale;
  const contentY = (sheetH - sceneH * baseScale) / 2 - pointMm(scene.bounds.minY) * baseScale;
  const sheetName = project.sheet.preset === "600x400" ? "600 × 400 mm" : project.sheet.preset === "700x500" ? "700 × 500 mm" : "Custom sheet";

  useEffect(() => { if (dimensionEditor?.manual) manualInputRef.current?.focus(); }, [dimensionEditor?.manual]);

  const eventWorld = (event: ReactPointerEvent): { x: number; y: number } => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * sheetW, y: ((event.clientY - rect.top) / rect.height) * sheetH };
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current; if (!drag) return;
    if (drag.type === "pan") { setPan({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y }); return; }
  };
  const endDrag = () => { dragRef.current = undefined; };
  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).closest("[data-dimension]")) return;
    setDimensionEditor(undefined);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { type: "pan", x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
  };
  const dimensionDrag = (event: ReactPointerEvent, dimension: DimensionSpec) => {
    event.stopPropagation(); setDimensionEditor(undefined); onSelectParameter(dimension.parameterId); (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const start = eventWorld(event); const startValue = project.parameters[dimension.parameterId];
    let latestValue = startValue;
    const move = (native: PointerEvent) => {
      const svg = svgRef.current; if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const current = { x: ((native.clientX - rect.left) / rect.width) * sheetW, y: ((native.clientY - rect.top) / rect.height) * sheetH };
      const deltaMm = dimension.dragDirection === "x" ? current.x - start.x : current.y - start.y;
      const snapped = Math.round((startValue + (deltaMm / baseScale) * 1000 * dimension.dragSign) / 1000) * 1000;
      const range = PARAMETER_LIMITS[dimension.parameterId];
      latestValue = um(Math.max(range[0], Math.min(range[1], snapped)));
      previewParameter(dimension.parameterId, latestValue);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); commitParameterDrag(dimension.parameterId, startValue, latestValue); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
  };

  const openDimensionEditor = (event: React.MouseEvent, dimension: DimensionSpec) => {
    event.stopPropagation();
    const viewport = viewportRef.current?.getBoundingClientRect();
    const x = viewport ? Math.max(112, Math.min(viewport.width - 112, event.clientX - viewport.left)) : 180;
    const y = viewport ? Math.max(82, Math.min(viewport.height - 175, event.clientY - viewport.top)) : 180;
    const value = project.parameters[dimension.parameterId];
    onSelectParameter(dimension.parameterId);
    setDimensionEditor({ id: dimension.parameterId, x, y, original: value, value, manual: false, raw: formatMeasurement(value, project.display.unit, project.display.precision) });
  };

  const previewDimensionValue = (value: number) => {
    if (!dimensionEditor) return;
    const range = PARAMETER_LIMITS[dimensionEditor.id];
    const next = um(Math.max(range[0], Math.min(range[1], Math.round(value / 1000) * 1000)));
    previewParameter(dimensionEditor.id, next);
    setDimensionEditor({ ...dimensionEditor, value: next, raw: formatMeasurement(next, project.display.unit, project.display.precision), error: undefined });
  };

  const finishDimensionPreview = () => {
    if (!dimensionEditor || dimensionEditor.original === dimensionEditor.value) return;
    commitParameterDrag(dimensionEditor.id, dimensionEditor.original, dimensionEditor.value);
    setDimensionEditor({ ...dimensionEditor, original: dimensionEditor.value });
  };

  const nudgeDimension = (direction: -1 | 1) => {
    if (!dimensionEditor) return;
    const range = PARAMETER_LIMITS[dimensionEditor.id];
    const next = um(Math.max(range[0], Math.min(range[1], dimensionEditor.value + direction * 1000)));
    setParameter(dimensionEditor.id, next);
    setDimensionEditor({ ...dimensionEditor, original: next, value: next, raw: formatMeasurement(next, project.display.unit, project.display.precision), error: undefined });
  };

  const commitManualDimension = () => {
    if (!dimensionEditor) return;
    const parsed = parseMeasurement(dimensionEditor.raw, project.display.unit);
    if (!parsed.ok) { setDimensionEditor({ ...dimensionEditor, error: parsed.message }); return; }
    const range = PARAMETER_LIMITS[dimensionEditor.id];
    const next = um(Math.max(range[0], Math.min(range[1], parsed.value)));
    setParameter(dimensionEditor.id, next);
    setDimensionEditor({ ...dimensionEditor, original: next, value: next, raw: formatMeasurement(next, project.display.unit, project.display.precision), manual: false, error: undefined });
  };

  const wheel = (event: React.WheelEvent) => { event.preventDefault(); setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.deltaY > 0 ? 0.88 : 1.12)))); };
  return <div ref={viewportRef} className="canvas-viewport" style={{ "--pan-x": `${pan.x}px`, "--pan-y": `${pan.y}px`, "--canvas-zoom": zoom } as React.CSSProperties}>
    <div className="canvas-title-row"><div><h1>{TEMPLATE_UI[project.template.id].title}</h1><span>{project.template.id === "tuck-end-carton" ? `${project.construction.openingStyle === "straight-tuck" ? "Straight tuck ends" : "Reverse tuck ends"} · slit-aware folding carton` : TEMPLATE_UI[project.template.id].subtitle}</span></div><span className={`fit-pill ${layout.fits ? "fits" : "overflow"}`}>{layout.fits ? <Check size={13} /> : <AlertTriangle size={13} />}{layout.fits ? `Fits ${sheetName} · ${layout.orientation}` : `Doesn’t fit ${sheetName}`}</span></div>
    <div className="sheet-stage">
      <svg ref={svgRef} className={`dieline-sheet${showGrid ? " show-grid" : ""}`} width={sheetW} height={sheetH} style={{ aspectRatio: `${sheetW} / ${sheetH}` }} viewBox={`0 0 ${sheetW} ${sheetH}`} onPointerDown={startPan} onPointerMove={onPointerMove} onPointerUp={endDrag} onWheel={wheel} role="application" aria-label={`Interactive ${TEMPLATE_UI[project.template.id].title} dieline. Drag dimension handles or edit measurements in the inspector.`}>
        <defs>
          <pattern id="minor-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#d8dde3" strokeWidth=".12" /></pattern>
          <pattern id="major-grid" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#minor-grid)"/><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#c7ced6" strokeWidth=".18" /></pattern>
          <pattern id="glue-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#e4b54a" strokeWidth=".6" /></pattern>
        </defs>
        <rect className="sheet-background" width={sheetW} height={sheetH} rx="1.8" />
        <rect className="grid-layer" width={sheetW} height={sheetH} rx="1.8" fill="url(#major-grid)" />
        <g transform={`translate(${contentX} ${contentY}) scale(${baseScale})`}>
          <g data-layer="manufacturing-geometry">
            {scene.paths.filter((p) => visibleRoles.has(p.role)).map((p) => <path key={p.id} id={p.id} data-role={p.role} className={`dieline-path role-${p.role}${p.parameterRefs.includes(selectedParameter as ParameterId) ? " dependency-highlight" : ""}`} d={pathToSvg(p)} />)}
          </g>
          <g data-layer="dimensions">
            {scene.dimensions.map((dimension) => {
              const a = anchors.get(dimension.startAnchorId)!, b = anchors.get(dimension.endAnchorId)!;
              const offset = pointMm(dimension.offsetUm);
              const horizontal = dimension.kind === "horizontal";
              const x1 = pointMm(a.point.x), y1 = pointMm(a.point.y), x2 = pointMm(b.point.x), y2 = pointMm(b.point.y);
              const lx1 = horizontal ? x1 : x1 + offset, ly1 = horizontal ? y1 + offset : y1;
              const lx2 = horizontal ? x2 : x2 + offset, ly2 = horizontal ? y2 + offset : y2;
              const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2;
              return <g key={dimension.id} data-dimension={dimension.id} className={`dimension${selectedParameter === dimension.parameterId ? " selected" : ""}`} onClick={(event) => openDimensionEditor(event, dimension)}>
                <line x1={x1} y1={y1} x2={lx1} y2={ly1} className="extension-line"/><line x1={x2} y1={y2} x2={lx2} y2={ly2} className="extension-line"/>
                <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} className="dimension-line" />
                <circle cx={lx1} cy={ly1} r="2.5" className="dimension-handle" onPointerDown={(event) => dimensionDrag(event, dimension)} />
                <circle cx={lx2} cy={ly2} r="2.5" className="dimension-handle" onPointerDown={(event) => dimensionDrag(event, dimension)} />
                <g transform={`translate(${mx} ${my})`}><rect className="dimension-label-bg" x={horizontal ? -18 : -20} y="-5.2" width={horizontal ? 36 : 40} height="10.4" rx="2.8"/><text className="dimension-label" textAnchor="middle" dominantBaseline="central">{formatMeasurement(dimension.valueUm, project.display.unit, project.display.precision)}</text></g>
              </g>;
            })}
          </g>
        </g>
        <text className="sheet-label" x="8" y={sheetH - 8}>{sheetName} · {formatMeasurement(layout.sheetWidthUm, "mm", 0)} × {formatMeasurement(layout.sheetHeightUm, "mm", 0)} · {Math.round(layout.utilization * 100)}% used</text>
      </svg>
    </div>
    {dimensionEditor && <div className="dimension-popover" style={{ left: dimensionEditor.x, top: dimensionEditor.y }} role="dialog" aria-label={`Edit ${PARAMETER_LABELS[dimensionEditor.id]}`} onPointerDown={(event) => event.stopPropagation()}>
      <div className="dimension-popover-head"><span>{PARAMETER_LABELS[dimensionEditor.id]}</span><button aria-label="Close dimension editor" onClick={() => { finishDimensionPreview(); setDimensionEditor(undefined); }}><X size={13}/></button></div>
      {dimensionEditor.manual ? <div className={`dimension-manual${dimensionEditor.error ? " has-error" : ""}`}>
        <input ref={manualInputRef} value={dimensionEditor.raw} onChange={(event) => setDimensionEditor({ ...dimensionEditor, raw: event.target.value, error: undefined })} onBlur={commitManualDimension} onKeyDown={(event) => { if (event.key === "Enter") commitManualDimension(); if (event.key === "Escape") setDimensionEditor({ ...dimensionEditor, manual: false, raw: formatMeasurement(dimensionEditor.value, project.display.unit, project.display.precision), error: undefined }); }}/>
        {dimensionEditor.error && <small>{dimensionEditor.error}</small>}
      </div> : <button className="dimension-value" title="Click to type an exact value" onClick={() => setDimensionEditor({ ...dimensionEditor, manual: true })}>{formatMeasurement(dimensionEditor.value, project.display.unit, project.display.precision)}<small>click to type</small></button>}
      <div className="dimension-stepper"><button aria-label="Decrease by 1 millimetre" onClick={() => nudgeDimension(-1)}><Minus size={13}/></button><input type="range" min={PARAMETER_LIMITS[dimensionEditor.id][0]} max={PARAMETER_LIMITS[dimensionEditor.id][1]} step="1000" value={dimensionEditor.value} onChange={(event) => previewDimensionValue(Number(event.target.value))} onPointerUp={finishDimensionPreview} onPointerCancel={finishDimensionPreview} onKeyUp={finishDimensionPreview} onBlur={finishDimensionPreview}/><button aria-label="Increase by 1 millimetre" onClick={() => nudgeDimension(1)}><Plus size={13}/></button></div>
      <div className="dimension-popover-foot"><span>{PARAMETER_LIMITS[dimensionEditor.id][0] / 1000} mm</span><strong>1 mm steps</strong><span>{PARAMETER_LIMITS[dimensionEditor.id][1] / 1000} mm</span></div>
    </div>}
    <div className="canvas-tools" aria-label="Canvas controls"><IconButton label="Select tool" active><MousePointer2 size={16}/></IconButton><span className="tool-separator"/><IconButton label="Zoom out" onClick={() => setZoom(Math.max(MIN_ZOOM, zoom / 1.25))}><Minus size={16}/></IconButton><button className="zoom-readout" title="Reset to sheet overview" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button><IconButton label="Zoom in" onClick={() => setZoom(Math.min(MAX_ZOOM, zoom * 1.25))}><Plus size={16}/></IconButton><IconButton label="Fit dieline to view" onClick={onFitDieline}><Maximize2 size={16}/></IconButton></div>
  </div>;
}

export default function Editor() {
  const { project, past, future, savedAt, hydrate, setParameter, setTemplate, previewParameter, commitParameterDrag, setName, setUnit, setOpeningStyle, setTuckPanel, setLockStyle, setGlueAngle, setDustTaper, setSliceAngle, setMaterialThickness, setSheetPreset, setCustomSheetSize, setOrientation, setCreaseMode, undo, redo, reset } = useProjectStore();
  const [leftTab, setLeftTab] = useState<LeftTab>("templates");
  const [templateSearch, setTemplateSearch] = useState("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("design");
  const [selectedParameter, setSelectedParameter] = useState<ParameterId>();
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
  const selectTemplate = (id: TemplateId) => { setTemplate(id); setSelectedParameter(undefined); setZoom(1); setPan({ x: 0, y: 0 }); setInspectorTab("design"); setMobilePanel(undefined); };
  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const workingTemplates = WORKING_TEMPLATES.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(normalizedTemplateSearch));
  const upcomingTemplates = UPCOMING_TEMPLATES.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(normalizedTemplateSearch));
  const isLockBottom = project.template.id === "crash-lock-carton" || project.template.id === "auto-lock-bottom";
  const isCartonBand = project.template.id === "tuck-end-carton" || isLockBottom;
  const finishedFields: readonly { id: ParameterId; label: string }[] = project.template.id === "box-with-lid"
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
        <div className="unit-switch" aria-label="Display units">{(["mm", "in"] as const).map((unit) => <button key={unit} className={project.display.unit === unit ? "active" : ""} onClick={() => setUnit(unit)}>{unit}</button>)}</div>
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
          <div className="template-list">{workingTemplates.map((item) => <TemplateCard key={item.id} active={project.template.id === item.id} title={item.title} meta={item.meta} onClick={() => selectTemplate(item.id)}/>)}</div>
          {upcomingTemplates.length > 0 && <><div className="section-heading second"><span>NEXT CLOSURES</span></div><div className="template-list">{upcomingTemplates.map((item) => <TemplateCard key={item.title} locked title={item.title} meta={item.meta}/>)}</div></>}
          {!workingTemplates.length && !upcomingTemplates.length && <div className="template-empty"><Search size={18}/><strong>No matching templates</strong><span>Try box, sleeve, tuck, or lock.</span></div>}
          <button className="request-template"><Sparkles size={15}/> Request a template</button>
        </div> : <div className="sidebar-content layer-panel">
          <div className="section-heading"><span>MANUFACTURING LAYERS</span><small>{visibleRoles.size} visible</small></div>
          {VISIBLE_ROLES.map((role) => <button className="layer-row" key={role} onClick={() => toggleRole(role)}><span className={`role-swatch swatch-${role}`}/><span><strong>{ROLE_LABELS[role]}</strong><small>{scene.paths.filter((path) => path.role === role).length} semantic paths</small></span>{visibleRoles.has(role) ? <Eye size={16}/> : <EyeOff size={16}/>}</button>)}
          <div className="layer-note"><LockKeyhole size={15}/><p><strong>Semantic layers are protected</strong><span>Roles travel with the geometry into SVG, PDF, and DXF exports.</span></p></div>
        </div>}
      </aside>

      <section className="canvas-area">
        <div className="canvas-options"><button className={showGrid ? "active" : ""} onClick={() => setShowGrid(!showGrid)}><Grid3X3 size={15}/> Grid</button><span/><button onClick={fitDieline}><Maximize2 size={15}/> Fit dieline</button></div>
        <DielineCanvas project={project} selectedParameter={selectedParameter} onSelectParameter={setSelectedParameter} visibleRoles={visibleRoles} showGrid={showGrid} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} onFitDieline={fitDieline} previewParameter={previewParameter} commitParameterDrag={commitParameterDrag} setParameter={setParameter}/>
      </section>

      <aside className={`inspector${mobilePanel === "right" ? " mobile-open" : ""}`}>
        <div className="mobile-panel-head"><strong>Inspector</strong><button onClick={() => setMobilePanel(undefined)}><X size={18}/></button></div>
        <div className="inspector-tabs">{(["design", "material", "sheet"] as const).map((tab) => <button key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>)}</div>
        <div className="inspector-scroll">
          {inspectorTab === "design" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>FINISHED SIZE</span><small>Inside dimensions</small></div><Ruler size={16}/></div><div className="parameter-grid">{finishedFields.map(({ id, label }) => <ParameterField key={`${id}-${project.display.unit}-${project.parameters[id]}`} id={id} label={label} project={project} onCommit={setParameter}/>)}</div><div className="parameter-hint"><MousePointer2 size={14}/> Click or drag dimensions on the dieline</div></section>
            {isCartonBand ? <section className="inspector-section"><div className="inspector-heading"><div><span>{isLockBottom ? "LOCK-BOTTOM CONSTRUCTION" : "END CONSTRUCTION"}</span><small>{isLockBottom ? "Tuck top and controlled collapsing base" : "Independent closing and tuck geometry"}</small></div><Settings2 size={16}/></div>
              {!isLockBottom && <><span className="control-label">Opening style</span><div className="segmented-control two-up"><button className={project.construction.openingStyle === "straight-tuck" ? "active" : ""} onClick={() => setOpeningStyle("straight-tuck")}>Straight tuck</button><button className={project.construction.openingStyle === "reverse-tuck" ? "active" : ""} onClick={() => setOpeningStyle("reverse-tuck")}>Reverse tuck</button></div></>}
              {isLockBottom && <div className="construction-badge"><LockKeyhole size={14}/><span><strong>{project.template.id === "crash-lock-carton" ? "Crash-lock base" : "Hooked auto-lock base"}</strong><small>Two diagonal collapse folds · pre-glued major flaps</small></span></div>}
              <div className="parameter-grid construction-grid">{(["tuckFlap", "glueFlap", ...(isLockBottom ? ["bottomFlap", "lockOverlap"] : [])] as ParameterId[]).map((id) => <ParameterField key={`${id}-${project.display.unit}-${project.parameters[id]}`} id={id} project={project} onCommit={setParameter}/>)}</div>
              <button className={`advanced-toggle${advancedConstruction ? " open" : ""}`} onClick={() => setAdvancedConstruction(!advancedConstruction)}><Settings2 size={13}/> Advanced construction <ChevronDown size={13}/></button>
              {advancedConstruction && <div className="advanced-controls">
                <div className="parameter-grid">{(["dustFlap", "thumbHole", "cornerRadius", "clearance"] as ParameterId[]).map((id) => <ParameterField key={`${id}-${project.display.unit}-${project.parameters[id]}`} id={id} project={project} onCommit={setParameter}/>)}</div>
                <span className="control-label">Tuck panel</span><div className="segmented-control two-up"><button className={project.construction.tuckPanel === "front" ? "active" : ""} onClick={() => setTuckPanel("front")}>Front</button><button className={project.construction.tuckPanel === "back" ? "active" : ""} onClick={() => setTuckPanel("back")}>Back</button></div>
                <span className="control-label">Lock geometry</span><div className="segmented-control two-up"><button className={project.construction.lockStyle === "slit-lock" ? "active" : ""} onClick={() => setLockStyle("slit-lock")}>Slit lock</button><button className={project.construction.lockStyle === "friction" ? "active" : ""} onClick={() => setLockStyle("friction")}>Friction</button></div>
                <div className="numeric-grid"><label className="number-field"><span>Glue angle</span><div><input key={project.construction.glueAngleMilliDegrees} type="number" min="45" max="89" defaultValue={project.construction.glueAngleMilliDegrees / 1000} onBlur={(event) => setGlueAngle(Math.max(45, Math.min(89, Number(event.target.value))))}/><b>°</b></div></label><label className="number-field"><span>Dust taper / side</span><div><input key={project.construction.dustTaperPercent} type="number" min="0" max="40" defaultValue={project.construction.dustTaperPercent} onBlur={(event) => setDustTaper(Math.max(0, Math.min(40, Number(event.target.value))))}/><b>%</b></div></label></div>
              </div>}
            </section> : <section className="inspector-section"><div className="inspector-heading"><div><span>ASSEMBLY FIT</span><small>{project.template.id === "box-with-lid" ? "Single-wall base and lid · four glued corners" : project.template.id === "cake-slice-box" ? "Convex triangular profile · three glued corners per part" : "Single-wall tray and sliding sleeve"}</small></div><Settings2 size={16}/></div>
              {project.template.id === "cake-slice-box" && <label className="number-field assembly-angle"><span>Slice angle</span><div><input key={project.construction.sliceAngleMilliDegrees} type="number" min="15" max="90" step="1" defaultValue={project.construction.sliceAngleMilliDegrees / 1000} onBlur={(event) => setSliceAngle(Number(event.target.value))}/><b>°</b></div></label>}
              <div className="parameter-grid construction-grid"><ParameterField key={`glue-${project.display.unit}-${project.parameters.glueFlap}`} id="glueFlap" label={project.template.id === "match-box" ? "Corner / seam glue" : "Corner glue tab"} project={project} onCommit={setParameter}/><ParameterField key={`clearance-${project.display.unit}-${project.parameters.clearance}`} id="clearance" label={project.template.id === "match-box" ? "Sleeve clearance" : "Lid clearance"} project={project} onCommit={setParameter}/></div>
              <label className="number-field assembly-angle"><span>Glue tab angle</span><div><input key={`${project.template.id}-${project.construction.glueAngleMilliDegrees}`} type="number" min="45" max="89" defaultValue={project.construction.glueAngleMilliDegrees / 1000} onBlur={(event) => setGlueAngle(Math.max(45, Math.min(89, Number(event.target.value))))}/><b>°</b></div></label>
              <div className="material-stats">{project.template.id === "cake-slice-box" ? <><div><span>Rear slice width</span><strong>{formatMeasurement(um(Math.round(2 * project.parameters.width * Math.sin(project.construction.sliceAngleMilliDegrees / 2000 * Math.PI / 180))), "mm", 2)}</strong></div><div><span>Uniform lid offset</span><strong>{formatMeasurement(um(project.material.thicknessUm + project.parameters.clearance), "mm", 2)}</strong></div></> : <><div><span>{project.template.id === "box-with-lid" ? "Lid inside length" : "Sleeve inside length"}</span><strong>{formatMeasurement(matingLength, "mm", 2)}</strong></div><div><span>{project.template.id === "box-with-lid" ? "Lid inside width" : "Sleeve inside width"}</span><strong>{formatMeasurement(matingWidth, "mm", 2)}</strong></div></>}<div><span>Caliper compensation</span><strong>{formatMeasurement(um(project.material.thicknessUm * 2), "mm", 2)}</strong></div></div>
              <p className="section-copy">{project.template.id === "cake-slice-box" ? "The lid is a true uniform offset of the nominal triangular profile. Each profile edge receives one wall and one semantically folded corner tab." : "Each wall is one finished-height flap with one base crease. The four corner tabs fold from the short-side walls; this is not a double-wall construction."}</p>
            </section>}
            <section className="inspector-section constraint-section"><div className="inspector-heading"><div><span>INTEGRITY CHECK</span><small>{scene.warnings.length ? `${scene.warnings.length} issue${scene.warnings.length === 1 ? "" : "s"}` : "All checks passed"}</small></div>{scene.warnings.length ? <AlertTriangle size={16}/> : <Check size={16}/>}</div>{scene.warnings.length ? scene.warnings.map((warning) => <button key={warning.id} className={`constraint-card ${warning.severity}`} onClick={() => setSelectedParameter(warning.parameterIds[0])}><AlertTriangle size={15}/><span><strong>{warning.message}</strong>{warning.technicalDetails && <small>{warning.technicalDetails}</small>}<code>{warning.id}</code></span></button>) : <div className="integrity-ok"><span><Check size={16}/></span><p><strong>Manufacturable geometry</strong><small>{scene.parts?.length ?? 1} part{(scene.parts?.length ?? 1) === 1 ? "" : "s"} · {scene.foldGraph?.connections.length ?? 0} verified folds · all anchors resolved</small></p></div>}</section>
          </>}
          {inspectorTab === "material" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>MATERIAL PROFILE</span><small>Thickness drives shoulders, clearance, and scoring</small></div><Layers3 size={16}/></div><label className="select-field"><span>Stock</span><select defaultValue="SBS"><option>SBS paperboard</option><option>FBB paperboard</option><option>Recycled chipboard</option></select></label><div className="material-edit"><MeasurementField key={`${project.display.unit}-${project.material.thicknessUm}`} label="Material thickness" value={project.material.thicknessUm} project={project} onCommit={setMaterialThickness} minUm={100} maxUm={10_000}/></div><div className="material-stats"><div><span>Board caliper</span><strong>{formatMeasurement(project.material.thicknessUm, "mm", 2)}</strong></div><div><span>Estimated score allowance</span><strong>{formatMeasurement(project.material.scoreAllowanceUm, "mm", 2)}</strong></div><div><span>Cut kerf</span><strong>{formatMeasurement(project.material.kerfUm, "mm", 2)}</strong></div></div><p className="section-copy material-note">Board caliper is the physical material thickness. Score allowance is estimated at 1.25× caliper and rounded to 0.05 mm; confirm the crease rule and channel with your board supplier.</p></section>
            <section className="inspector-section"><div className="inspector-heading"><div><span>CREASE OUTPUT</span><small>Manufacturing convention</small></div><Zap size={16}/></div><div className="segmented-control">{(["line", "dash", "perforation"] as const).map((mode) => <button key={mode} className={project.exportProfile.creaseMode === mode ? "active" : ""} onClick={() => setCreaseMode(mode)}>{mode}</button>)}</div><p className="section-copy">Crease roles stay semantic in the project; this only changes their output representation.</p></section>
          </>}
          {inspectorTab === "sheet" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>SHEET LAYOUT</span><small>Production sheet dimensions</small></div><FileText size={16}/></div><label className="select-field"><span>Sheet preset</span><select value={project.sheet.preset} onChange={(event) => setSheetPreset(event.target.value as ProjectDocument["sheet"]["preset"])}><option value="600x400">600 × 400 mm</option><option value="700x500">700 × 500 mm</option><option value="Custom">Custom size</option></select></label>{project.sheet.preset === "Custom" && <div className="custom-sheet-grid"><MeasurementField key={`sheet-w-${project.display.unit}-${project.sheet.widthUm}`} label="Sheet width" value={project.sheet.widthUm} project={project} onCommit={(value) => setCustomSheetSize(value, project.sheet.heightUm)} minUm={50_000} maxUm={2_000_000}/><MeasurementField key={`sheet-h-${project.display.unit}-${project.sheet.heightUm}`} label="Sheet height" value={project.sheet.heightUm} project={project} onCommit={(value) => setCustomSheetSize(project.sheet.widthUm, value)} minUm={50_000} maxUm={2_000_000}/></div>}<label className="select-field"><span>Orientation</span><select value={project.sheet.orientation} onChange={(event) => setOrientation(event.target.value as ProjectDocument["sheet"]["orientation"])}><option value="auto">Auto — best fit</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><div className={`sheet-result ${layout.fits ? "fits" : "overflow"}`}><span>{layout.fits ? <Check size={18}/> : <AlertTriangle size={18}/>}</span><p><strong>{layout.fits ? `Fits in ${layout.orientation}` : "Sheet overflow"}</strong><small>{formatMeasurement(layout.contentWidthUm, "mm", 0)} × {formatMeasurement(layout.contentHeightUm, "mm", 0)} content · {Math.round(layout.utilization * 100)}% sheet use</small></p></div>{layout.suggestion && <p className="section-copy">{layout.suggestion}</p>}</section>
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

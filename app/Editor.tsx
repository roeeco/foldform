"use client";

import {
  AlertTriangle, Box, Check, ChevronDown, CircleHelp, Download, Eye, EyeOff,
  FileCode2, FileImage, FileText, Grid3X3, Layers3, LockKeyhole,
  Maximize2, Menu, Minus, MousePointer2, PackageOpen, Plus,
  Redo2, RotateCcw, Ruler, Save, Search, Settings2, Sparkles, Undo2, X, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  PARAMETER_LABELS, ROLE_LABELS, anchorMap, calculateSheetFit, formatMeasurement,
  generateStraightTuck, parseMeasurement, pathToSvg, pointMm, type DimensionSpec,
  type LineRole, type Micrometres, type ParameterId, type ProjectDocument, um,
} from "./lib/dieline";
import { downloadDxf, downloadPdf, downloadPng, downloadProject, downloadSvg } from "./lib/exporters";
import { useProjectStore } from "./lib/store";

type LeftTab = "templates" | "layers";
type InspectorTab = "design" | "material" | "sheet";
const VISIBLE_ROLES: LineRole[] = ["outer-cut", "crease", "glue-boundary"];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function IconButton({ label, children, disabled, onClick, active }: { label: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void; active?: boolean }) {
  return <button className={`icon-button${active ? " active" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function ParameterField({ id, project, onCommit, compact = false }: { id: ParameterId; project: ProjectDocument; onCommit: (id: ParameterId, value: Micrometres) => void; compact?: boolean }) {
  const value = project.parameters[id];
  const [raw, setRaw] = useState(formatMeasurement(value, project.display.unit, project.display.precision));
  const [error, setError] = useState<string>();
  const commit = () => {
    const parsed = parseMeasurement(raw, project.display.unit);
    if (!parsed.ok) { setError(parsed.message); return; }
    setError(undefined); onCommit(id, parsed.value);
  };
  return <label className={`parameter-field${compact ? " compact" : ""}${error ? " has-error" : ""}`}>
    <span>{PARAMETER_LABELS[id]}</span>
    <input value={raw} onChange={(event) => setRaw(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setRaw(formatMeasurement(value, project.display.unit, project.display.precision)); setError(undefined); event.currentTarget.blur(); } }} aria-invalid={Boolean(error)} aria-label={`${PARAMETER_LABELS[id]}, ${formatMeasurement(value, project.display.unit)}`} />
    {error && <small>{error}</small>}
  </label>;
}

function TemplateCard({ active, title, meta, locked, onClick }: { active?: boolean; title: string; meta: string; locked?: boolean; onClick?: () => void }) {
  return <button className={`template-card${active ? " active" : ""}${locked ? " locked" : ""}`} onClick={onClick} disabled={locked}>
    <span className="template-thumb" aria-hidden="true">
      {title === "Straight tuck box" ? <><i className="net-main" /><i className="net-side" /><i className="net-flap" /></> : <PackageOpen size={32} strokeWidth={1.25} />}
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
  previewParameter: (id: ParameterId, value: Micrometres) => void;
  commitParameterDrag: (id: ParameterId, original: Micrometres, value: Micrometres) => void;
}

function DielineCanvas({ project, selectedParameter, onSelectParameter, visibleRoles, showGrid, zoom, setZoom, previewParameter, commitParameterDrag }: CanvasProps) {
  const scene = useMemo(() => generateStraightTuck(project), [project]);
  const layout = useMemo(() => calculateSheetFit(scene, project), [scene, project]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ type: "pan"; x: number; y: number; ox: number; oy: number } | { type: "dimension"; id: ParameterId; startValue: Micrometres; x: number; y: number } | undefined>(undefined);
  const anchors = useMemo(() => anchorMap(scene), [scene]);
  const sheetW = pointMm(layout.sheetWidthUm), sheetH = pointMm(layout.sheetHeightUm);
  const sceneW = pointMm(um(scene.bounds.maxX - scene.bounds.minX)), sceneH = pointMm(um(scene.bounds.maxY - scene.bounds.minY));
  const fitScale = Math.min((sheetW - 16) / sceneW, (sheetH - 16) / sceneH);
  const baseScale = Math.max(0.35, Math.min(1.15, fitScale));
  const contentX = (sheetW - sceneW * baseScale) / 2 - pointMm(scene.bounds.minX) * baseScale;
  const contentY = (sheetH - sceneH * baseScale) / 2 - pointMm(scene.bounds.minY) * baseScale;

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
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { type: "pan", x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
  };
  const dimensionDrag = (event: ReactPointerEvent, dimension: DimensionSpec) => {
    event.stopPropagation(); (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const start = eventWorld(event); const startValue = project.parameters[dimension.parameterId];
    let latestValue = startValue;
    const move = (native: PointerEvent) => {
      const svg = svgRef.current; if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const current = { x: ((native.clientX - rect.left) / rect.width) * sheetW, y: ((native.clientY - rect.top) / rect.height) * sheetH };
      const deltaMm = dimension.dragDirection === "x" ? current.x - start.x : current.y - start.y;
      const snapped = Math.round((startValue + (deltaMm / baseScale) * 1000) / 500) * 500;
      const ranges: Record<ParameterId, [number, number]> = { width: [15_000, 500_000], depth: [8_000, 300_000], height: [20_000, 700_000], glueFlap: [5_000, 60_000] };
      latestValue = um(Math.max(ranges[dimension.parameterId][0], Math.min(ranges[dimension.parameterId][1], snapped)));
      previewParameter(dimension.parameterId, latestValue);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); commitParameterDrag(dimension.parameterId, startValue, latestValue); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
  };

  const wheel = (event: React.WheelEvent) => { event.preventDefault(); setZoom(Math.max(0.5, Math.min(2.4, zoom * (event.deltaY > 0 ? 0.9 : 1.1)))); };
  return <div className="canvas-viewport" style={{ "--pan-x": `${pan.x}px`, "--pan-y": `${pan.y}px`, "--canvas-zoom": zoom } as React.CSSProperties}>
    <div className="canvas-title-row"><div><h1>Straight tuck box</h1><span>Folding carton · ECMA A2120</span></div><span className={`fit-pill ${layout.fits ? "fits" : "overflow"}`}>{layout.fits ? <Check size={13} /> : <AlertTriangle size={13} />}{layout.fits ? `Fits ${project.sheet.preset} · ${layout.orientation}` : `Doesn’t fit ${project.sheet.preset}`}</span></div>
    <div className="sheet-stage">
      <svg ref={svgRef} className={`dieline-sheet${showGrid ? " show-grid" : ""}`} viewBox={`0 0 ${sheetW} ${sheetH}`} onPointerDown={startPan} onPointerMove={onPointerMove} onPointerUp={endDrag} onWheel={wheel} role="application" aria-label="Interactive straight tuck box dieline. Drag dimension handles or edit measurements in the inspector.">
        <defs>
          <pattern id="minor-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#d8dde3" strokeWidth=".12" /></pattern>
          <pattern id="major-grid" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="url(#minor-grid)"/><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#c7ced6" strokeWidth=".18" /></pattern>
          <pattern id="glue-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#e4b54a" strokeWidth=".6" /></pattern>
        </defs>
        <rect className="sheet-background" width={sheetW} height={sheetH} rx="1.8" />
        <rect className="grid-layer" width={sheetW} height={sheetH} rx="1.8" fill="url(#major-grid)" />
        <g transform={`translate(${contentX + pan.x / 4} ${contentY + pan.y / 4}) scale(${baseScale * zoom})`}>
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
              return <g key={dimension.id} data-dimension={dimension.id} className={`dimension${selectedParameter === dimension.parameterId ? " selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelectParameter(dimension.parameterId); }}>
                <line x1={x1} y1={y1} x2={lx1} y2={ly1} className="extension-line"/><line x1={x2} y1={y2} x2={lx2} y2={ly2} className="extension-line"/>
                <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} className="dimension-line" />
                <circle cx={lx1} cy={ly1} r="1.4" className="dimension-handle" onPointerDown={(event) => dimensionDrag(event, dimension)} />
                <circle cx={lx2} cy={ly2} r="1.4" className="dimension-handle" onPointerDown={(event) => dimensionDrag(event, dimension)} />
                <g transform={`translate(${mx} ${my})`}><rect className="dimension-label-bg" x={horizontal ? -12 : -13} y={horizontal ? -3.7 : -4} width={horizontal ? 24 : 26} height="7.4" rx="2"/><text className="dimension-label" textAnchor="middle" dominantBaseline="central">{formatMeasurement(dimension.valueUm, project.display.unit, project.display.precision)}</text></g>
              </g>;
            })}
          </g>
        </g>
        <text className="sheet-label" x="6" y={sheetH - 5}>{project.sheet.preset} · {formatMeasurement(layout.sheetWidthUm, "mm", 0)} × {formatMeasurement(layout.sheetHeightUm, "mm", 0)} · {Math.round(layout.utilization * 100)}% used</text>
      </svg>
    </div>
    <div className="canvas-tools" aria-label="Canvas controls"><IconButton label="Select tool" active><MousePointer2 size={16}/></IconButton><span className="tool-separator"/><IconButton label="Zoom out" onClick={() => setZoom(Math.max(.5, zoom - .1))}><Minus size={16}/></IconButton><button className="zoom-readout" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><IconButton label="Zoom in" onClick={() => setZoom(Math.min(2.4, zoom + .1))}><Plus size={16}/></IconButton><IconButton label="Fit to sheet" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize2 size={16}/></IconButton></div>
  </div>;
}

export default function Editor() {
  const { project, past, future, savedAt, hydrate, setParameter, previewParameter, commitParameterDrag, setName, setUnit, setSheetPreset, setOrientation, setCreaseMode, undo, redo, reset } = useProjectStore();
  const [leftTab, setLeftTab] = useState<LeftTab>("templates");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("design");
  const [selectedParameter, setSelectedParameter] = useState<ParameterId>();
  const [visibleRoles, setVisibleRoles] = useState<Set<LineRole>>(new Set(VISIBLE_ROLES));
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">();
  const scene = useMemo(() => generateStraightTuck(project), [project]);
  const layout = useMemo(() => calculateSheetFit(scene, project), [scene, project]);
  const errors = scene.warnings.filter((warning) => warning.severity === "error");

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
          <label className="search-field"><Search size={15}/><input placeholder="Search templates" aria-label="Search templates"/></label>
          <div className="section-heading"><span>FOLDING CARTONS</span><small>1 available</small></div>
          <div className="template-list"><TemplateCard active title="Straight tuck box" meta="4 panels · glued seam"/><TemplateCard locked title="Reverse tuck box" meta="Coming in the next release"/><TemplateCard locked title="Auto-lock bottom" meta="Coming in the next release"/></div>
          <div className="section-heading second"><span>OTHER FORMATS</span></div>
          <div className="template-list"><TemplateCard locked title="Two-piece box" meta="Base + lid"/><TemplateCard locked title="Tray & sleeve" meta="Sliding construction"/></div>
          <button className="request-template"><Sparkles size={15}/> Request a template</button>
        </div> : <div className="sidebar-content layer-panel">
          <div className="section-heading"><span>MANUFACTURING LAYERS</span><small>{visibleRoles.size} visible</small></div>
          {VISIBLE_ROLES.map((role) => <button className="layer-row" key={role} onClick={() => toggleRole(role)}><span className={`role-swatch swatch-${role}`}/><span><strong>{ROLE_LABELS[role]}</strong><small>{scene.paths.filter((path) => path.role === role).length} semantic paths</small></span>{visibleRoles.has(role) ? <Eye size={16}/> : <EyeOff size={16}/>}</button>)}
          <div className="layer-note"><LockKeyhole size={15}/><p><strong>Semantic layers are protected</strong><span>Roles travel with the geometry into SVG, PDF, and DXF exports.</span></p></div>
        </div>}
      </aside>

      <section className="canvas-area">
        <div className="canvas-options"><button className={showGrid ? "active" : ""} onClick={() => setShowGrid(!showGrid)}><Grid3X3 size={15}/> Grid</button><span/><button onClick={() => setZoom(1)}><Maximize2 size={15}/> Fit</button></div>
        <DielineCanvas project={project} selectedParameter={selectedParameter} onSelectParameter={setSelectedParameter} visibleRoles={visibleRoles} showGrid={showGrid} zoom={zoom} setZoom={setZoom} previewParameter={previewParameter} commitParameterDrag={commitParameterDrag}/>
      </section>

      <aside className={`inspector${mobilePanel === "right" ? " mobile-open" : ""}`}>
        <div className="mobile-panel-head"><strong>Inspector</strong><button onClick={() => setMobilePanel(undefined)}><X size={18}/></button></div>
        <div className="inspector-tabs">{(["design", "material", "sheet"] as const).map((tab) => <button key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>)}</div>
        <div className="inspector-scroll">
          {inspectorTab === "design" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>FINISHED SIZE</span><small>Inside dimensions</small></div><Ruler size={16}/></div><div className="parameter-grid">{(["width", "depth", "height"] as ParameterId[]).map((id) => <ParameterField key={`${id}-${project.display.unit}-${project.parameters[id]}`} id={id} project={project} onCommit={setParameter}/>)}</div><div className="parameter-hint"><MousePointer2 size={14}/> Click or drag dimensions on the dieline</div></section>
            <section className="inspector-section"><div className="inspector-heading"><div><span>CONSTRUCTION</span><small>Joint and flap settings</small></div><Settings2 size={16}/></div><ParameterField key={`glueFlap-${project.display.unit}-${project.parameters.glueFlap}`} id="glueFlap" project={project} onCommit={setParameter}/><div className="derived-row"><span>Tuck flap</span><strong>{formatMeasurement(project.parameters.depth, project.display.unit, project.display.precision)}</strong><LockKeyhole size={12}/></div><div className="derived-row"><span>Dust flap</span><strong>{formatMeasurement(um(Math.round(project.parameters.depth * .68)), project.display.unit, project.display.precision)}</strong><LockKeyhole size={12}/></div></section>
            <section className="inspector-section constraint-section"><div className="inspector-heading"><div><span>INTEGRITY CHECK</span><small>{scene.warnings.length ? `${scene.warnings.length} issue${scene.warnings.length === 1 ? "" : "s"}` : "All checks passed"}</small></div>{scene.warnings.length ? <AlertTriangle size={16}/> : <Check size={16}/>}</div>{scene.warnings.length ? scene.warnings.map((warning) => <button key={warning.id} className={`constraint-card ${warning.severity}`} onClick={() => setSelectedParameter(warning.parameterIds[0])}><AlertTriangle size={15}/><span><strong>{warning.message}</strong>{warning.technicalDetails && <small>{warning.technicalDetails}</small>}<code>{warning.id}</code></span></button>) : <div className="integrity-ok"><span><Check size={16}/></span><p><strong>Manufacturable geometry</strong><small>14 stable paths · all anchors resolved · bounds verified</small></p></div>}</section>
          </>}
          {inspectorTab === "material" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>MATERIAL PROFILE</span><small>Folding carton board</small></div><Layers3 size={16}/></div><label className="select-field"><span>Stock</span><select defaultValue="SBS"><option>SBS paperboard</option><option>FBB paperboard</option><option>Recycled chipboard</option></select></label><div className="material-stats"><div><span>Caliper</span><strong>{project.material.thicknessUm / 1000} mm</strong></div><div><span>Kerf</span><strong>{project.material.kerfUm / 1000} mm</strong></div><div><span>Score allowance</span><strong>{project.material.scoreAllowanceUm / 1000} mm</strong></div></div></section>
            <section className="inspector-section"><div className="inspector-heading"><div><span>CREASE OUTPUT</span><small>Manufacturing convention</small></div><Zap size={16}/></div><div className="segmented-control">{(["line", "dash", "perforation"] as const).map((mode) => <button key={mode} className={project.exportProfile.creaseMode === mode ? "active" : ""} onClick={() => setCreaseMode(mode)}>{mode}</button>)}</div><p className="section-copy">Crease roles stay semantic in the project; this only changes their output representation.</p></section>
          </>}
          {inspectorTab === "sheet" && <>
            <section className="inspector-section"><div className="inspector-heading"><div><span>SHEET LAYOUT</span><small>Deterministic orientation fit</small></div><FileText size={16}/></div><label className="select-field"><span>Sheet preset</span><select value={project.sheet.preset} onChange={(event) => setSheetPreset(event.target.value as ProjectDocument["sheet"]["preset"])}><option>A4</option><option>A3</option><option>Letter</option></select></label><label className="select-field"><span>Orientation</span><select value={project.sheet.orientation} onChange={(event) => setOrientation(event.target.value as ProjectDocument["sheet"]["orientation"])}><option value="auto">Auto — best fit</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><div className={`sheet-result ${layout.fits ? "fits" : "overflow"}`}><span>{layout.fits ? <Check size={18}/> : <AlertTriangle size={18}/>}</span><p><strong>{layout.fits ? `Fits in ${layout.orientation}` : "Sheet overflow"}</strong><small>{formatMeasurement(layout.contentWidthUm, "mm", 0)} × {formatMeasurement(layout.contentHeightUm, "mm", 0)} content · {Math.round(layout.utilization * 100)}% sheet use</small></p></div>{layout.suggestion && <p className="section-copy">{layout.suggestion}</p>}</section>
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

import type { DielinePath, DielineScene, LayoutResult, ProjectDocument } from "./dieline";
import { pathToSvg } from "./dieline";

const roleStyle = {
  "outer-cut": { stroke: "#e34b4b", dash: "" },
  "internal-cut": { stroke: "#e34b4b", dash: "" },
  crease: { stroke: "#3978d4", dash: "3 2" },
  perforation: { stroke: "#7b61b7", dash: "1 2" },
  "glue-boundary": { stroke: "#d49a24", dash: "2 2" },
  annotation: { stroke: "#64748b", dash: "" },
} as const;

export function serializeSvg(scene: DielineScene, layout: LayoutResult, project: ProjectDocument): string {
  const groups = (["outer-cut", "internal-cut", "crease", "perforation", "glue-boundary"] as const)
    .map((role) => {
      const paths = scene.paths.filter((item) => item.role === role);
      if (!paths.length) return "";
      const style = roleStyle[role];
      return `  <g id="${role === "outer-cut" || role === "internal-cut" ? "CUT" : role.toUpperCase().replace("-", "_")}" data-role="${role}">\n${paths.map((item) => `    <path id="${item.id}" d="${pathToSvg(item)}" fill="none" stroke="${style.stroke}" stroke-width="0.2"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""}/>`).join("\n")}\n  </g>`;
    }).filter(Boolean).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.sheetWidthUm / 1000}mm" height="${layout.sheetHeightUm / 1000}mm" viewBox="0 0 ${layout.sheetWidthUm / 1000} ${layout.sheetHeightUm / 1000}">
  <metadata>Foldform Studio · engine ${project.engineVersion} · ${project.template.id}@${project.template.version}</metadata>
  <g transform="translate(${(project.sheet.marginUm - scene.bounds.minX) / 1000} ${(project.sheet.marginUm - scene.bounds.minY) / 1000})">
${groups}
  </g>
</svg>`;
}

function fileName(project: ProjectDocument, extension: string): string {
  const safe = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dieline";
  return `${safe}.${extension}`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadSvg(scene: DielineScene, layout: LayoutResult, project: ProjectDocument): void {
  download(new Blob([serializeSvg(scene, layout, project)], { type: "image/svg+xml" }), fileName(project, "svg"));
}

function pathPoints(path: DielinePath): Array<{ x: number; y: number }> {
  return path.commands.flatMap((command) => command.op === "close" ? [] : [{ x: command.point.x / 1000, y: command.point.y / 1000 }]);
}

export async function downloadPdf(scene: DielineScene, layout: LayoutResult, project: ProjectDocument): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: layout.orientation, unit: "mm", format: [layout.sheetWidthUm / 1000, layout.sheetHeightUm / 1000], compress: true });
  const ox = (project.sheet.marginUm - scene.bounds.minX) / 1000;
  const oy = (project.sheet.marginUm - scene.bounds.minY) / 1000;
  for (const p of scene.paths.filter((item) => item.manufacturable)) {
    const pts = pathPoints(p);
    if (pts.length < 2) continue;
    const style = roleStyle[p.role];
    const rgb = style.stroke === "#e34b4b" ? [227, 75, 75] : [57, 120, 212];
    pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern(style.dash ? [3, 2] : [], 0);
    for (let i = 1; i < pts.length; i += 1) pdf.line(pts[i - 1]!.x + ox, pts[i - 1]!.y + oy, pts[i]!.x + ox, pts[i]!.y + oy);
    if (p.commands.at(-1)?.op === "close") pdf.line(pts.at(-1)!.x + ox, pts.at(-1)!.y + oy, pts[0]!.x + ox, pts[0]!.y + oy);
  }
  pdf.setProperties({ title: project.name, subject: `${project.template.id}@${project.template.version}`, creator: "Foldform Studio" });
  pdf.save(fileName(project, "pdf"));
}

export function serializeDxf(scene: DielineScene): string {
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "TABLES", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  const layerFor = (role: DielinePath["role"]) => role === "crease" ? "CREASE" : role === "perforation" ? "PERF" : role === "glue-boundary" ? "GLUE" : "CUT";
  for (const path of scene.paths.filter((item) => item.manufacturable)) {
    const pts = pathPoints(path);
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!, b = pts[i]!;
      lines.push("0", "LINE", "8", layerFor(path.role), "10", a.x.toFixed(6), "20", (-a.y).toFixed(6), "30", "0", "11", b.x.toFixed(6), "21", (-b.y).toFixed(6), "31", "0");
    }
    if (path.commands.at(-1)?.op === "close" && pts.length > 2) {
      const a = pts.at(-1)!, b = pts[0]!;
      lines.push("0", "LINE", "8", layerFor(path.role), "10", a.x.toFixed(6), "20", (-a.y).toFixed(6), "30", "0", "11", b.x.toFixed(6), "21", (-b.y).toFixed(6), "31", "0");
    }
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\n");
}

export function downloadDxf(scene: DielineScene, project: ProjectDocument): void {
  download(new Blob([serializeDxf(scene)], { type: "application/dxf" }), fileName(project, "dxf"));
}

export async function downloadPng(scene: DielineScene, layout: LayoutResult, project: ProjectDocument): Promise<void> {
  const svg = serializeSvg(scene, layout, project);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("PNG render failed")); image.src = url; });
  const dpi = 180;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((layout.sheetWidthUm / 25_400) * dpi);
  canvas.height = Math.round((layout.sheetHeightUm / 25_400) * dpi);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encode failed");
  download(blob, fileName(project, "png"));
}

export function downloadProject(project: ProjectDocument): void {
  download(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), fileName(project, "json"));
}

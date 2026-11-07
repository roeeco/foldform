import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_PROJECT, assertSceneIntegrity, calculateSheetFit, flattenPath, generateBoxWithLid,
  generateAutoLockCarton, generateBag, generateCakeSliceBox, generateCrashLockCarton, generateEnvelope, generateMatchBox,
  generatePillowPack, generateProjectScene, generateTrapezoidBox, generateTuckCarton, estimateScoreAllowance, offsetConvexProfile, parseMeasurement,
  validateProject, type ParameterId, type PointUm, type ProjectDocument, type TemplateId, um,
} from "../app/lib/dieline";
import { serializeDxf, serializeSvg } from "../app/lib/exporters";
import { TEMPLATE_MANIFESTS, manifestsForImplementation } from "../app/lib/template-kernel";

function projectWith(parameters: Partial<Record<ParameterId, number>>): ProjectDocument {
  return {
    ...DEFAULT_PROJECT,
    parameters: {
      ...DEFAULT_PROJECT.parameters,
      ...Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, um(value)])),
    },
  } as ProjectDocument;
}

function projectForTemplate(templateId: TemplateId, parameters: Partial<Record<ParameterId, number>> = {}): ProjectDocument {
  const project = projectWith(parameters);
  const glueAngleMilliDegrees = templateId === "tuck-end-carton" || templateId === "crash-lock-carton" || templateId === "auto-lock-bottom"
    ? 80_000
    : templateId === "box-with-lid" || templateId === "cake-slice-box" || templateId === "trapezoid-box"
      ? 45_000
      : 90_000;
  return {
    ...project,
    template: { id: templateId, version: templateId === "tuck-end-carton" ? "2.0.0" : "1.0.0" },
    construction: { ...project.construction, glueAngleMilliDegrees },
  };
}

describe("fixed-point measurement boundary", () => {
  it("parses metric, decimal imperial, and mixed fractions exactly", () => {
    expect(parseMeasurement("120 mm", "mm")).toEqual({ ok: true, value: 120_000 });
    expect(parseMeasurement("12 cm", "mm")).toEqual({ ok: true, value: 120_000 });
    expect(parseMeasurement("4.75 in", "mm")).toEqual({ ok: true, value: 120_650 });
    expect(parseMeasurement('3/8"', "mm")).toEqual({ ok: true, value: 9_525 });
    expect(parseMeasurement("3 1/8 in", "mm")).toEqual({ ok: true, value: 79_375 });
    expect(parseMeasurement("0 mm", "mm")).toEqual({ ok: true, value: 0 });
  });

  it("rejects unsafe free-form expressions", () => {
    expect(parseMeasurement("2 + 2", "mm").ok).toBe(false);
    expect(parseMeasurement("-20 mm", "mm").ok).toBe(false);
  });

  it("migrates the original four-parameter document into the construction schema", () => {
    const migrated = validateProject({
      ...DEFAULT_PROJECT, schemaVersion: 1, engineVersion: "0.1.0",
      template: { id: "straight-tuck-box", version: "1.0.0" },
      parameters: { width: 80_000, depth: 30_000, height: 120_000, glueFlap: 15_000 },
      sheet: { preset: "A4", widthUm: 210_000, heightUm: 297_000, marginUm: 8_000, orientation: "auto" },
    });
    expect(migrated.schemaVersion).toBe(10);
    expect(migrated.parameters.width).toBe(80_000);
    expect(migrated.parameters.tuckFlap).toBe(DEFAULT_PROJECT.parameters.tuckFlap);
    expect(migrated.construction.openingStyle).toBe("reverse-tuck");
    expect(migrated.sheet).toMatchObject({ preset: "600x400", widthUm: 600_000, heightUm: 400_000 });
  });

  it("migrates version 2 projects onto the production sheet defaults", () => {
    const migrated = validateProject({
      ...DEFAULT_PROJECT,
      schemaVersion: 2,
      engineVersion: "0.2.0",
      sheet: { preset: "A3", widthUm: 297_000, heightUm: 420_000, marginUm: 10_000, orientation: "portrait" },
    });
    expect(migrated.schemaVersion).toBe(10);
    expect(migrated.sheet).toEqual({ preset: "600x400", widthUm: 600_000, heightUm: 400_000, marginUm: 10_000, orientation: "portrait" });
  });

  it("migrates version 3 projects and adds the reusable lid-wall parameter", () => {
    const v3Parameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => id !== "lidHeight"));
    const migrated = validateProject({
      ...DEFAULT_PROJECT,
      schemaVersion: 3,
      engineVersion: "0.3.0",
      parameters: v3Parameters,
    });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.parameters.lidHeight).toBe(DEFAULT_PROJECT.parameters.lidHeight);
  });

  it("migrates version 4 tray projects to the explicit 45-degree corner-tab construction", () => {
    const migrated = validateProject({
      ...DEFAULT_PROJECT,
      schemaVersion: 4,
      engineVersion: "0.4.0",
      template: { id: "box-with-lid", version: "1.0.0" },
      construction: { ...DEFAULT_PROJECT.construction, glueAngleMilliDegrees: 80_000 },
    });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.construction.glueAngleMilliDegrees).toBe(45_000);
  });

  it("migrates version 5 projects with lock-bottom and profile defaults", () => {
    const oldParameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => id !== "bottomFlap" && id !== "lockOverlap"));
    const oldConstruction = Object.fromEntries(Object.entries(DEFAULT_PROJECT.construction).filter(([id]) => id !== "sliceAngleMilliDegrees"));
    const migrated = validateProject({
      ...DEFAULT_PROJECT, schemaVersion: 5, engineVersion: "0.5.0", parameters: oldParameters, construction: oldConstruction,
    });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.parameters.bottomFlap).toBe(DEFAULT_PROJECT.parameters.bottomFlap);
    expect(migrated.parameters.lockOverlap).toBe(DEFAULT_PROJECT.parameters.lockOverlap);
    expect(migrated.construction.sliceAngleMilliDegrees).toBe(30_000);
  });

  it("migrates version 6 projects to explicit wall construction defaults", () => {
    const oldParameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => id !== "lockTab"));
    const oldConstruction = Object.fromEntries(Object.entries(DEFAULT_PROJECT.construction).filter(([id]) => id !== "wallConstruction"));
    const migrated = validateProject({
      ...DEFAULT_PROJECT, schemaVersion: 6, engineVersion: "0.7.0", parameters: oldParameters, construction: oldConstruction,
    });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.parameters.lockTab).toBe(6_000);
    expect(migrated.construction.wallConstruction).toBe("single-wall");
  });

  it("accepts the migration-safe glue-wall construction ID in project documents", () => {
    const project = validateProject({ ...DEFAULT_PROJECT, construction: { ...DEFAULT_PROJECT.construction, wallConstruction: "fold-over-tuck" } });
    expect(project.construction.wallConstruction).toBe("fold-over-tuck");
  });

  it("migrates version 7 projects with tapered-profile defaults", () => {
    const oldParameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => !["topLength", "bottomLength", "topWidth", "bottomWidth"].includes(id)));
    const migrated = validateProject({ ...DEFAULT_PROJECT, schemaVersion: 7, engineVersion: "0.8.0", parameters: oldParameters });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.parameters).toMatchObject({ topLength: 70_000, bottomLength: 40_000, topWidth: 40_000, bottomWidth: 30_000 });
  });

  it("migrates version 8 projects with gusset and overlap defaults", () => {
    const oldParameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => id !== "gusset" && id !== "overlap"));
    const migrated = validateProject({ ...DEFAULT_PROJECT, schemaVersion: 8, engineVersion: "0.9.0", parameters: oldParameters });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.parameters).toMatchObject({ gusset: 20_000, topFold: 20_000, overlap: 12_000 });
  });

  it("migrates version 9 bag projects to the explicit top-return parameter", () => {
    const oldParameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => id !== "topFold"));
    const migrated = validateProject({ ...DEFAULT_PROJECT, schemaVersion: 9, engineVersion: "1.0.0", parameters: oldParameters });
    expect(migrated).toMatchObject({ schemaVersion: 10, engineVersion: "1.1.0" });
    expect(migrated.parameters.topFold).toBe(20_000);
  });

  it("derives a practical score allowance from board thickness", () => {
    expect(estimateScoreAllowance(um(500))).toBe(650);
    expect(estimateScoreAllowance(um(200))).toBe(300);
  });
});

describe("straight tuck geometry invariants", () => {
  it("is deterministic and preserves semantic identity", () => {
    const first = generateTuckCarton(DEFAULT_PROJECT);
    const second = generateTuckCarton(DEFAULT_PROJECT);
    expect(second).toEqual(first);
    expect(new Set(first.paths.map((path) => path.id)).size).toBe(first.paths.length);
    expect(first.paths.some((path) => path.id === "top.front.tuck.cut.outer")).toBe(true);
    expect(first.paths.some((path) => path.id === "top.back.receiving-edge.cut")).toBe(true);
    expect(first.paths.some((path) => path.id === "top.side-a.dust-flap.cut")).toBe(true);
    expect(first.paths.some((path) => path.commands.some((command) => command.op === "arc"))).toBe(true);
    expect(first.parts).toEqual([{ id: "body", role: "shell", faceIds: ["body.panel.front", "body.panel.side-a", "body.panel.back", "body.panel.side-b"] }]);
    expect(first.faces).toHaveLength(4);
    expect(first.foldGraph?.connections).toHaveLength(3);
  });

  it("holds integrity across randomized valid carton dimensions", () => {
    fc.assert(fc.property(
      fc.record({
        width: fc.integer({ min: 40_000, max: 300_000 }),
        depth: fc.integer({ min: 10_000, max: 150_000 }),
        height: fc.integer({ min: 25_000, max: 450_000 }),
        glueFlap: fc.integer({ min: 5_000, max: 14_000 }),
        tuckFlap: fc.integer({ min: 4_000, max: 40_000 }),
        dustFlap: fc.integer({ min: 4_000, max: 70_000 }),
        thumbHole: fc.integer({ min: 2_000, max: 30_000 }),
        cornerRadius: fc.integer({ min: 500, max: 12_000 }),
        clearance: fc.integer({ min: 500, max: 3_000 }),
      }).filter((p) => p.dustFlap * 2 <= p.width - p.clearance * 2 && p.thumbHole <= p.width * .45 && p.width - 2 * (p.clearance + 1_000) > p.cornerRadius * 2),
      (parameters) => {
        const scene = generateTuckCarton(projectWith(parameters));
        expect(() => assertSceneIntegrity(scene)).not.toThrow();
        expect(scene.paths.every((path) => path.role.length > 0)).toBe(true);
        for (const path of scene.paths) {
          for (const flattened of flattenPath(path)) {
            expect(flattened.x).toBeGreaterThanOrEqual(scene.bounds.minX);
            expect(flattened.y).toBeGreaterThanOrEqual(scene.bounds.minY);
            expect(flattened.x).toBeLessThanOrEqual(scene.bounds.maxX);
            expect(flattened.y).toBeLessThanOrEqual(scene.bounds.maxY);
          }
          for (const command of path.commands) {
            if (command.op === "close") continue;
            const point = command.op === "arc" ? command.center : command.point;
            expect(Number.isSafeInteger(point.x)).toBe(true);
            expect(Number.isSafeInteger(point.y)).toBe(true);
          }
        }
      },
    ), { numRuns: 300 });
  });

  it("selects the 600 × 400 mm sheet deterministically for the default net", () => {
    const scene = generateTuckCarton(DEFAULT_PROJECT);
    expect(calculateSheetFit(scene, DEFAULT_PROJECT)).toMatchObject({ fits: true, orientation: "landscape", sheetWidthUm: 600_000, sheetHeightUm: 400_000 });
  });

  it("moves the lower tuck between panels without changing semantic construction", () => {
    const reverse = generateTuckCarton(DEFAULT_PROJECT);
    const straight = generateTuckCarton({ ...DEFAULT_PROJECT, construction: { ...DEFAULT_PROJECT.construction, openingStyle: "straight-tuck" } });
    expect(reverse.paths.some((path) => path.id === "bottom.back.tuck.cut.outer")).toBe(true);
    expect(straight.paths.some((path) => path.id === "bottom.front.tuck.cut.outer")).toBe(true);
    expect(reverse.paths.length).toBe(straight.paths.length);
  });

  it("preserves analytic curves and manufacturing roles in SVG and DXF", () => {
    const scene = generateTuckCarton(DEFAULT_PROJECT);
    const layout = calculateSheetFit(scene, DEFAULT_PROJECT);
    const svg = serializeSvg(scene, layout, DEFAULT_PROJECT);
    const dxf = serializeDxf(scene);
    expect(svg).toContain("data-role=\"outer-cut\"");
    expect(svg).toMatch(/<path[^>]+d="[^"]* A /);
    expect(dxf).toContain("\nARC\n");
    expect(dxf).toContain("\nCREASE\n");
    expect(dxf).toContain("\nCUT\n");
  });
});

describe("multi-template kernel", () => {
  it("groups product names by reusable generator instead of duplicating engines", () => {
    expect(manifestsForImplementation("rectangular-carton-band").map((item) => item.id)).toEqual([
      "tuck-end-carton", "gift-box", "shallow-box", "crash-lock-carton", "auto-lock-bottom",
    ]);
    expect(manifestsForImplementation("profile-tray-cover").map((item) => item.id)).toEqual(["box-with-lid", "cake-slice-box"]);
    expect(TEMPLATE_MANIFESTS.find((item) => item.id === "box-with-lid")?.aliases).toContain("two-piece box");
    expect(TEMPLATE_MANIFESTS.find((item) => item.id === "match-box")?.aliases).toContain("tray and sleeve");
  });

  it("registers every researched topology family with a stable implementation key", () => {
    const expected = ["bag", "box-with-lid", "cake-slice-box", "cone", "envelope", "gift-box", "match-box", "pillow-pack", "shallow-box", "trapezoid-box"];
    expect(expected.every((id) => TEMPLATE_MANIFESTS.some((manifest) => manifest.id === id && manifest.implementationKey))).toBe(true);
    expect(new Set(TEMPLATE_MANIFESTS.map((manifest) => manifest.id)).size).toBe(TEMPLATE_MANIFESTS.length);
  });

  it("builds a two-piece box as two independently valid glue-corner trays", () => {
    const project = projectForTemplate("box-with-lid", { width: 170_000, depth: 110_000, height: 70_000, lidHeight: 40_000, glueFlap: 10_000, clearance: 2_000 });
    const scene = generateBoxWithLid(project);
    expect(scene.parts?.map((part) => [part.id, part.role])).toEqual([["base", "base"], ["lid", "lid"]]);
    expect(scene.faces).toHaveLength(18);
    expect(scene.foldGraph?.connections).toHaveLength(16);
    expect(new Set(scene.paths.map((path) => path.id)).size).toBe(scene.paths.length);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();

    const lidBase = scene.faces?.find((face) => face.id === "lid.face.base");
    expect(lidBase).toBeDefined();
    expect(lidBase!.boundary[1]!.x - lidBase!.boundary[0]!.x).toBe(175_000);
    expect(lidBase!.boundary[2]!.y - lidBase!.boundary[1]!.y).toBe(115_000);

    const cornerFold = scene.foldGraph?.connections.find((fold) => fold.id === "base.left-to-top-tab");
    expect(cornerFold).toMatchObject({ faceAId: "base.wall.left", faceBId: "base.tab.top-left" });
    expect(cornerFold!.edge[0].y).toBe(cornerFold!.edge[1].y);
    expect(cornerFold!.edge[1].x - cornerFold!.edge[0].x).toBe(70_000);
    const cornerTab = scene.faces?.find((face) => face.id === "base.tab.top-left");
    expect(cornerTab).toBeDefined();
    expect(cornerFold!.edge[0].y - cornerTab!.boundary[1]!.y).toBe(10_000);
    expect(calculateSheetFit(scene, project)).toMatchObject({ fits: true, orientation: "landscape" });
  });

  it("builds a match box from a tray and a material-compensated panel-band sleeve", () => {
    const project = projectForTemplate("match-box", { width: 70_000, depth: 40_000, height: 10_000, glueFlap: 8_000, clearance: 2_000 });
    const scene = generateMatchBox(project);
    expect(scene.parts?.map((part) => [part.id, part.role])).toEqual([["tray", "tray"], ["sleeve", "sleeve"]]);
    expect(scene.faces).toHaveLength(13);
    expect(scene.foldGraph?.connections).toHaveLength(11);
    expect(scene.paths.some((path) => path.id === "sleeve.glue-flap.cut.outer")).toBe(true);
    expect(scene.paths.some((path) => path.id === "sleeve.top.cut")).toBe(true);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("builds crash-lock and auto-lock bottoms from one fold-aware treatment", () => {
    const parameters = { width: 60_000, depth: 30_000, height: 90_000, bottomFlap: 28_000, lockOverlap: 10_000, glueFlap: 15_000, clearance: 1_000 };
    const crash = generateCrashLockCarton(projectForTemplate("crash-lock-carton", parameters));
    const automatic = generateAutoLockCarton(projectForTemplate("auto-lock-bottom", parameters));
    for (const scene of [crash, automatic]) {
      expect(scene.parts).toHaveLength(1);
      expect(scene.faces).toHaveLength(10);
      expect(scene.foldGraph?.connections).toHaveLength(9);
      expect(scene.paths.filter((path) => path.id.includes("diagonal.fold"))).toHaveLength(2);
      expect(scene.paths.filter((path) => path.role === "glue-boundary" && path.id.includes("preglue"))).toHaveLength(2);
      expect(() => assertSceneIntegrity(scene)).not.toThrow();
    }
    expect(crash.paths.some((path) => path.id.includes("hook.cut"))).toBe(false);
    expect(automatic.paths.filter((path) => path.id.includes("hook.cut"))).toHaveLength(2);
    expect(automatic.paths.filter((path) => path.id.includes("hook.cut")).every((path) => path.role === "internal-cut")).toBe(true);
  });

  it("builds a cake slice as two generic triangular profile trays", () => {
    const project = projectForTemplate("cake-slice-box", { width: 140_000, height: 40_000, lidHeight: 25_000, glueFlap: 10_000, clearance: 2_000 });
    const scene = generateCakeSliceBox({ ...project, construction: { ...project.construction, sliceAngleMilliDegrees: 30_000 } });
    expect(scene.parts?.map((part) => [part.id, part.role])).toEqual([["base", "base"], ["lid", "lid"]]);
    expect(scene.faces).toHaveLength(14);
    expect(scene.foldGraph?.connections).toHaveLength(12);
    expect(scene.faces?.find((face) => face.id === "base.face.base")?.boundary).toHaveLength(3);
    expect(scene.faces?.find((face) => face.id === "lid.face.base")?.boundary).toHaveLength(3);
    expect(scene.paths.filter((path) => path.id.endsWith("glue-area"))).toHaveLength(6);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("develops a centered rectangular frustum with explicit closure topology", () => {
    const project = projectForTemplate("trapezoid-box", { topLength: 70_000, bottomLength: 40_000, topWidth: 40_000, bottomWidth: 30_000, height: 40_000, tuckFlap: 15_000, dustFlap: 20_000, glueFlap: 10_000, thumbHole: 10_000, clearance: 1_000 });
    const scene = generateTrapezoidBox(project);
    expect(scene.parts?.map((part) => [part.id, part.role])).toEqual([["body", "shell"]]);
    expect(scene.faces).toHaveLength(13);
    expect(scene.foldGraph?.connections).toHaveLength(12);
    expect(scene.paths.filter((path) => path.id.includes("corner-tab") && path.id.endsWith(".glue-area"))).toHaveLength(4);
    expect(scene.paths.filter((path) => path.id.includes("dust-flap") && path.id.endsWith(".fold"))).toHaveLength(2);
    expect(scene.paths.some((path) => path.id === "body.tuck-tongue.fold")).toBe(true);
    expect(scene.paths.some((path) => path.id === "body.receiving-edge.cut" && path.commands.some((command) => command.op === "arc"))).toBe(true);
    const rear = scene.faces?.find((face) => face.id === "body.wall.rear");
    expect(rear).toBeDefined();
    if (!rear) throw new Error("Missing tapered rear wall");
    const expectedWidthSlant = Math.hypot(project.parameters.height, (project.parameters.bottomWidth - project.parameters.topWidth) / 2);
    const expectedLateralEdge = Math.hypot(project.parameters.height, (project.parameters.bottomLength - project.parameters.topLength) / 2, (project.parameters.bottomWidth - project.parameters.topWidth) / 2);
    expect(Math.abs(rear.boundary[3]!.y - rear.boundary[0]!.y)).toBeCloseTo(expectedWidthSlant, 0);
    expect(Math.hypot(rear.boundary[3]!.x - rear.boundary[0]!.x, rear.boundary[3]!.y - rear.boundary[0]!.y)).toBeCloseTo(expectedLateralEdge, 0);
    expect(scene.dimensions.map((dimension) => dimension.parameterId)).toEqual(["bottomLength", "bottomWidth", "topLength", "topWidth", "height"]);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("builds a flat-folding bag with a reinforced top and interlocking bottom", () => {
    const scene = generateBag(projectForTemplate("bag", { width: 80_000, depth: 50_000, height: 150_000, topFold: 20_000, glueFlap: 15_000, clearance: 1_000 }));
    expect(scene.faces).toHaveLength(14);
    expect(scene.foldGraph?.connections).toHaveLength(16);
    expect(scene.paths.filter((path) => path.id.includes("gusset.center.fold"))).toHaveLength(2);
    expect(scene.paths.filter((path) => path.id.includes("gusset") && path.id.includes("diagonal"))).toHaveLength(4);
    expect(scene.paths.filter((path) => /\.bottom\.(left|right)\.diagonal$/.test(path.id))).toHaveLength(4);
    expect(scene.paths.filter((path) => path.id.includes("bottom-flap") && path.id.endsWith(".fold"))).toHaveLength(4);
    expect(scene.paths.filter((path) => path.id === "body.outline.cut" && path.commands.at(-1)?.op === "close")).toHaveLength(1);
    expect(scene.dimensions.some((dimension) => dimension.parameterId === "topFold")).toBe(true);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("omits the bag top return cleanly when Fold is zero", () => {
    const scene = generateBag(projectForTemplate("bag", { width: 80_000, depth: 50_000, height: 150_000, topFold: 0, glueFlap: 15_000 }));
    expect(scene.faces?.some((face) => face.id.includes("top-return"))).toBe(false);
    expect(scene.paths.some((path) => path.id.includes("top-return"))).toBe(false);
    expect(scene.warnings.some((warning) => warning.severity === "error")).toBe(false);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("builds an envelope as a five-face planar wrap", () => {
    const scene = generateEnvelope(projectForTemplate("envelope", { width: 150_000, height: 100_000, overlap: 12_500, cornerRadius: 7_000 }));
    expect(scene.faces).toHaveLength(5);
    expect(scene.foldGraph?.connections).toHaveLength(4);
    expect(scene.paths.filter((path) => path.role === "glue-boundary")).toHaveLength(2);
    expect(scene.paths.filter((path) => path.role === "internal-cut")).toHaveLength(0);
    expect(scene.paths.filter((path) => path.role === "outer-cut")).toHaveLength(1);
    expect(scene.paths.find((path) => path.id === "body.outline.cut")?.commands.filter((command) => command.op === "arc")).toHaveLength(4);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("keeps pillow closures as exact circular score arcs", () => {
    const project = projectForTemplate("pillow-pack", { width: 80_000, depth: 140_000, height: 15_000, glueFlap: 12_000, clearance: 1_000 });
    const scene = generatePillowPack(project);
    const arcScores = scene.paths.filter((path) => path.id.includes("arc-score"));
    expect(scene.faces).toHaveLength(3);
    expect(scene.foldGraph?.connections).toHaveLength(2);
    expect(arcScores).toHaveLength(4);
    expect(arcScores.every((path) => path.role === "crease" && path.commands.some((command) => command.op === "arc"))).toBe(true);
    const expectedRadius = project.parameters.width ** 2 / (8 * project.parameters.height) + project.parameters.height / 2;
    const radius = arcScores[0]!.commands.find((command) => command.op === "arc");
    expect(radius?.op === "arc" ? radius.radiusUm : 0).toBeCloseTo(expectedRadius, 0);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("switches rectangular trays to material-compensated fold-over locking walls", () => {
    const project = projectForTemplate("box-with-lid", { width: 170_000, depth: 110_000, height: 70_000, lidHeight: 40_000, glueFlap: 10_000, clearance: 2_000, lockTab: 6_000 });
    const scene = generateBoxWithLid({ ...project, construction: { ...project.construction, wallConstruction: "fold-over-lock" } });
    expect(scene.faces).toHaveLength(50);
    expect(scene.foldGraph?.connections).toHaveLength(48);
    expect(scene.paths.filter((path) => path.role === "internal-cut" && path.id.includes("lock-slot"))).toHaveLength(16);
    expect(scene.paths.filter((path) => path.id.includes("lock-tab") && path.id.endsWith(".fold"))).toHaveLength(16);
    const outerRimFold = scene.paths.find((path) => path.id === "base.rim.1.outer.fold")!;
    const innerRimFold = scene.paths.find((path) => path.id === "base.rim.1.inner.fold")!;
    const outerY = outerRimFold.commands[0]!.op === "move" ? outerRimFold.commands[0]!.point.y : 0;
    const innerY = innerRimFold.commands[0]!.op === "move" ? innerRimFold.commands[0]!.point.y : 0;
    expect(Math.abs(innerY - outerY)).toBe(project.material.thicknessUm * 2 + project.material.scoreAllowanceUm);
    const slot = scene.paths.find((path) => path.id === "base.lock-slot.1.1.cut")!;
    const slotPoints = slot.commands.flatMap((command) => command.op === "move" || command.op === "line" ? [command.point] : []);
    expect(slot.commands.at(-1)?.op).toBe("close");
    expect(slotPoints).toHaveLength(4);
    expect(Math.hypot(slotPoints[2]!.x - slotPoints[1]!.x, slotPoints[2]!.y - slotPoints[1]!.y)).toBeCloseTo(project.material.thicknessUm + project.parameters.clearance, 0);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("regenerates reinforced slot apertures from board caliper", () => {
    const baseProject = projectForTemplate("box-with-lid", { width: 170_000, depth: 110_000, height: 70_000, lidHeight: 40_000, glueFlap: 10_000, clearance: 2_000, lockTab: 6_000 });
    const slotAperture = (thicknessUm: number) => {
      const material = { ...baseProject.material, thicknessUm: um(thicknessUm), scoreAllowanceUm: estimateScoreAllowance(um(thicknessUm)) };
      const scene = generateBoxWithLid({ ...baseProject, material, construction: { ...baseProject.construction, wallConstruction: "fold-over-lock" } });
      const slot = scene.paths.find((path) => path.id === "base.lock-slot.1.1.cut")!;
      const points = slot.commands.flatMap((command) => command.op === "move" || command.op === "line" ? [command.point] : []);
      return Math.hypot(points[2]!.x - points[1]!.x, points[2]!.y - points[1]!.y);
    };
    expect(slotAperture(500)).toBeCloseTo(2_500, 0);
    expect(slotAperture(1_200)).toBeCloseTo(3_200, 0);
  });

  it("builds glued fold-over walls without terminal tucks, locks, or slots", () => {
    const project = projectForTemplate("box-with-lid", { width: 170_000, depth: 110_000, height: 70_000, lidHeight: 40_000, glueFlap: 10_000, clearance: 2_000, lockTab: 6_000 });
    const scene = generateBoxWithLid({ ...project, construction: { ...project.construction, wallConstruction: "fold-over-tuck" } });
    expect(scene.faces).toHaveLength(34);
    expect(scene.foldGraph?.connections).toHaveLength(32);
    expect(scene.paths.filter((path) => path.role === "internal-cut")).toHaveLength(0);
    expect(scene.paths.some((path) => path.id.includes("lock-tab") || path.id.includes("lock-slot"))).toBe(false);
    expect(scene.paths.some((path) => path.id.includes("tuck-tab"))).toBe(false);
    expect(scene.paths.filter((path) => path.id.includes("inner-wall") && path.id.endsWith(".glue-area"))).toHaveLength(8);
    expect(() => assertSceneIntegrity(scene)).not.toThrow();
  });

  it("reuses glued fold-over walls for match and triangular tray profiles", () => {
    const matchProject = projectForTemplate("match-box", { width: 70_000, depth: 40_000, height: 10_000, glueFlap: 8_000, clearance: 2_000, lockTab: 4_000 });
    const cakeProject = projectForTemplate("cake-slice-box", { width: 140_000, height: 40_000, lidHeight: 25_000, glueFlap: 10_000, clearance: 2_000, lockTab: 5_000 });
    const match = generateMatchBox({ ...matchProject, construction: { ...matchProject.construction, wallConstruction: "fold-over-tuck" } });
    const cake = generateCakeSliceBox({ ...cakeProject, construction: { ...cakeProject.construction, wallConstruction: "fold-over-tuck", sliceAngleMilliDegrees: 30_000 } });
    expect(match.faces).toHaveLength(21);
    expect(match.foldGraph?.connections).toHaveLength(19);
    expect(match.paths.filter((path) => path.id.startsWith("tray.inner-wall") && path.id.endsWith(".glue-area"))).toHaveLength(4);
    expect(cake.faces).toHaveLength(26);
    expect(cake.foldGraph?.connections).toHaveLength(24);
    expect(cake.paths.filter((path) => path.id.includes("inner-wall") && path.id.endsWith(".glue-area"))).toHaveLength(6);
    expect([...match.paths, ...cake.paths].some((path) => path.role === "internal-cut" || path.id.includes("lock-tab") || path.id.includes("lock-slot"))).toBe(false);
    expect(() => assertSceneIntegrity(match)).not.toThrow();
    expect(() => assertSceneIntegrity(cake)).not.toThrow();
  });

  it("caps corner-tab reach by adjacent geometry and applies the glue angle", () => {
    const project = projectForTemplate("cake-slice-box", { width: 70_000, height: 24_000, lidHeight: 20_000, glueFlap: 18_000, clearance: 2_000 });
    const sceneAt = (angle: number) => generateCakeSliceBox({ ...project, construction: { ...project.construction, glueAngleMilliDegrees: angle, sliceAngleMilliDegrees: 30_000 } });
    const tabAt = (angle: number) => sceneAt(angle).faces?.find((face) => face.id === "base.tab.1");
    const shallow = tabAt(45_000), steep = tabAt(80_000);
    expect(shallow).toBeDefined(); expect(steep).toBeDefined();
    if (!shallow || !steep) throw new Error("Missing guarded corner tab");
    const reach = (face: typeof shallow, outer: boolean) => {
      const a = face.boundary[outer ? 1 : 0]!, b = face.boundary[outer ? 2 : 3]!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    };
    expect(reach(shallow, false)).toBeLessThanOrEqual(project.parameters.height * .72 + 1);
    expect(reach(shallow, true)).toBeLessThan(reach(steep, true));
    expect(sceneAt(45_000).warnings.some((warning) => warning.id === "tray.corner-tab.excessive")).toBe(true);
  });

  it("reuses the reinforced wall strategy for the match tray and triangular cake trays", () => {
    const matchProject = projectForTemplate("match-box", { width: 70_000, depth: 40_000, height: 10_000, glueFlap: 8_000, clearance: 2_000, lockTab: 4_000 });
    const cakeProject = projectForTemplate("cake-slice-box", { width: 140_000, height: 40_000, lidHeight: 25_000, glueFlap: 10_000, clearance: 2_000, lockTab: 5_000 });
    const match = generateMatchBox({ ...matchProject, construction: { ...matchProject.construction, wallConstruction: "fold-over-lock" } });
    const cake = generateCakeSliceBox({ ...cakeProject, construction: { ...cakeProject.construction, wallConstruction: "fold-over-lock", sliceAngleMilliDegrees: 30_000 } });
    expect(match.faces).toHaveLength(29);
    expect(match.foldGraph?.connections).toHaveLength(27);
    expect(match.paths.filter((path) => path.id.startsWith("tray.lock-slot"))).toHaveLength(8);
    expect(cake.faces).toHaveLength(38);
    expect(cake.foldGraph?.connections).toHaveLength(36);
    expect(cake.paths.filter((path) => path.id.includes("lock-slot"))).toHaveLength(12);
    expect(() => assertSceneIntegrity(match)).not.toThrow();
    expect(() => assertSceneIntegrity(cake)).not.toThrow();
  });

  it("uses square 90-degree corner tabs for the default match-box tray", () => {
    const scene = generateMatchBox(projectForTemplate("match-box", { width: 70_000, depth: 40_000, height: 10_000, glueFlap: 7_000, clearance: 2_000 }));
    const tab = scene.faces?.find((face) => face.id === "tray.tab.top-left");
    expect(tab).toBeDefined();
    if (!tab) throw new Error("Missing match-box corner tab");
    expect(tab.boundary[0]!.x).toBe(tab.boundary[1]!.x);
    expect(tab.boundary[2]!.x).toBe(tab.boundary[3]!.x);
  });

  it("offsets every edge of a convex profile by the exact requested allowance", () => {
    const profile: PointUm[] = [{ x: um(0), y: um(0) }, { x: um(100_000), y: um(0) }, { x: um(80_000), y: um(60_000) }];
    const offset = offsetConvexProfile(profile, um(2_500));
    for (let index = 0; index < profile.length; index += 1) {
      const a = profile[index]!, b = profile[(index + 1) % profile.length]!;
      const oa = offset[index]!, ob = offset[(index + 1) % offset.length]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const distanceA = Math.abs((b.x - a.x) * (oa.y - a.y) - (b.y - a.y) * (oa.x - a.x)) / length;
      const distanceB = Math.abs((b.x - a.x) * (ob.y - a.y) - (b.y - a.y) * (ob.x - a.x)) / length;
      expect(distanceA).toBeCloseTo(2_500, 0);
      expect(distanceB).toBeCloseTo(2_500, 0);
    }
  });

  it("dispatches each project through its registered working generator", () => {
    expect(generateProjectScene(projectForTemplate("tuck-end-carton")).parts?.[0]?.id).toBe("body");
    expect(generateProjectScene(projectForTemplate("crash-lock-carton")).paths.some((path) => path.id.includes("diagonal.fold"))).toBe(true);
    expect(generateProjectScene(projectForTemplate("auto-lock-bottom")).paths.some((path) => path.id.includes("hook.cut"))).toBe(true);
    expect(generateProjectScene(projectForTemplate("box-with-lid")).parts?.map((part) => part.id)).toEqual(["base", "lid"]);
    expect(generateProjectScene(projectForTemplate("match-box")).parts?.map((part) => part.id)).toEqual(["tray", "sleeve"]);
    expect(generateProjectScene(projectForTemplate("cake-slice-box")).parts?.map((part) => part.id)).toEqual(["base", "lid"]);
    expect(generateProjectScene(projectForTemplate("trapezoid-box")).parts?.map((part) => part.id)).toEqual(["body"]);
    expect(generateProjectScene(projectForTemplate("bag")).paths.some((path) => path.id.includes("gusset.center"))).toBe(true);
    expect(generateProjectScene(projectForTemplate("envelope")).faces).toHaveLength(5);
    expect(generateProjectScene(projectForTemplate("pillow-pack")).paths.filter((path) => path.id.includes("arc-score"))).toHaveLength(4);
  });

  it("preserves lock and triangular tray integrity across randomized practical dimensions", () => {
    fc.assert(fc.property(
      fc.record({
        width: fc.integer({ min: 50_000, max: 260_000 }), depth: fc.integer({ min: 20_000, max: 120_000 }),
        height: fc.integer({ min: 40_000, max: 300_000 }), bottomFlap: fc.integer({ min: 20_000, max: 70_000 }),
        lockOverlap: fc.integer({ min: 4_000, max: 16_000 }), angle: fc.integer({ min: 20_000, max: 75_000 }),
        lidHeight: fc.integer({ min: 10_000, max: 45_000 }), clearance: fc.integer({ min: 500, max: 4_000 }),
      }).filter((value) => value.bottomFlap >= value.depth * .65 && value.bottomFlap <= value.width * .58 && value.lockOverlap < Math.min(value.width, value.depth) * .45),
      (value) => {
        const lockProject = projectForTemplate("auto-lock-bottom", { ...value, glueFlap: 10_000 });
        const cakeProject = projectForTemplate("cake-slice-box", { width: value.width, height: Math.min(value.height, 70_000), lidHeight: value.lidHeight, glueFlap: Math.min(10_000, Math.floor(value.lidHeight * .7)), clearance: value.clearance });
        const lock = generateAutoLockCarton(lockProject);
        const cake = generateCakeSliceBox({ ...cakeProject, construction: { ...cakeProject.construction, sliceAngleMilliDegrees: value.angle } });
        expect(() => assertSceneIntegrity(lock)).not.toThrow();
        expect(() => assertSceneIntegrity(cake)).not.toThrow();
        expect(new Set(lock.paths.map((path) => path.id)).size).toBe(lock.paths.length);
        expect(new Set(cake.paths.map((path) => path.id)).size).toBe(cake.paths.length);
      },
    ), { numRuns: 160 });
  });

  it("preserves tray topology across randomized practical dimensions", () => {
    fc.assert(fc.property(
      fc.record({
        width: fc.integer({ min: 40_000, max: 300_000 }),
        depth: fc.integer({ min: 20_000, max: 200_000 }),
        height: fc.integer({ min: 8_000, max: 80_000 }),
        lidHeight: fc.integer({ min: 8_000, max: 60_000 }),
        clearance: fc.integer({ min: 500, max: 5_000 }),
      }),
      (parameters) => {
        const glueFlap = Math.min(20_000, Math.floor(Math.min(parameters.height, parameters.lidHeight) * .7));
        const box = generateBoxWithLid(projectForTemplate("box-with-lid", { ...parameters, glueFlap }));
        const match = generateMatchBox(projectForTemplate("match-box", { width: parameters.width, depth: parameters.depth, height: parameters.height, clearance: parameters.clearance, glueFlap }));
        expect(() => assertSceneIntegrity(box)).not.toThrow();
        expect(() => assertSceneIntegrity(match)).not.toThrow();
        expect(box.paths.every((path) => path.commands.every((command) => command.op === "close" || command.op === "arc" || (Number.isSafeInteger(command.point.x) && Number.isSafeInteger(command.point.y))))).toBe(true);
        expect(match.paths.every((path) => path.commands.every((command) => command.op === "close" || command.op === "arc" || (Number.isSafeInteger(command.point.x) && Number.isSafeInteger(command.point.y))))).toBe(true);
      },
    ), { numRuns: 200 });
  });

  it("preserves tapered-shell closure and fold integrity across practical dimensions", () => {
    fc.assert(fc.property(
      fc.record({
        topLength: fc.integer({ min: 35_000, max: 180_000 }), bottomLength: fc.integer({ min: 30_000, max: 160_000 }),
        topWidth: fc.integer({ min: 25_000, max: 120_000 }), bottomWidth: fc.integer({ min: 20_000, max: 110_000 }),
        height: fc.integer({ min: 20_000, max: 100_000 }), tuckFlap: fc.integer({ min: 8_000, max: 25_000 }),
        dustFlap: fc.integer({ min: 5_000, max: 30_000 }), glueFlap: fc.integer({ min: 5_000, max: 15_000 }),
        clearance: fc.integer({ min: 500, max: 2_500 }), thickness: fc.integer({ min: 300, max: 1_200 }),
      }).filter((value) => {
        const lateralEdge = Math.hypot(value.height, (value.bottomLength - value.topLength) / 2, (value.bottomWidth - value.topWidth) / 2);
        return value.dustFlap * 2 <= value.topLength - value.clearance * 2
          && value.glueFlap <= lateralEdge * .6
          && value.topLength - 2 * (value.clearance + value.thickness * 2) > 2_000;
      }),
      (value) => {
        const project = projectForTemplate("trapezoid-box", { ...value, thumbHole: 10_000 });
        const material = { ...project.material, thicknessUm: um(value.thickness), scoreAllowanceUm: estimateScoreAllowance(um(value.thickness)) };
        const scene = generateTrapezoidBox({ ...project, material });
        expect(() => assertSceneIntegrity(scene)).not.toThrow();
        expect(scene.faces).toHaveLength(13);
        expect(scene.foldGraph?.connections).toHaveLength(12);
        expect(scene.paths.every((path) => path.commands.every((command) => command.op === "close" || command.op === "arc" || (Number.isSafeInteger(command.point.x) && Number.isSafeInteger(command.point.y))))).toBe(true);
        expect(new Set(scene.paths.map((path) => path.id)).size).toBe(scene.paths.length);
      },
    ), { numRuns: 120 });
  });

  it("preserves gusseted, planar-wrap, and curved-band integrity across practical dimensions", () => {
    fc.assert(fc.property(
      fc.record({
        width: fc.integer({ min: 50_000, max: 180_000 }), depth: fc.integer({ min: 35_000, max: 180_000 }),
        height: fc.integer({ min: 60_000, max: 240_000 }), crown: fc.integer({ min: 5_000, max: 30_000 }),
        topFold: fc.integer({ min: 0, max: 40_000 }), overlap: fc.integer({ min: 5_000, max: 25_000 }),
        glueFlap: fc.integer({ min: 5_000, max: 15_000 }), clearance: fc.integer({ min: 500, max: 2_000 }),
      }).filter((value) => value.topFold <= value.height * .45 && value.crown < value.width / 2 && value.overlap < Math.min(value.width, value.height) * .45 && value.glueFlap <= value.depth * .35),
      (value) => {
        const bag = generateBag(projectForTemplate("bag", { width: value.width, depth: value.depth, height: value.height, topFold: value.topFold, glueFlap: value.glueFlap, clearance: value.clearance }));
        const envelope = generateEnvelope(projectForTemplate("envelope", { width: value.width, height: value.height, overlap: value.overlap, cornerRadius: 7_000 }));
        const pillow = generatePillowPack(projectForTemplate("pillow-pack", { width: value.width, depth: value.depth, height: value.crown, glueFlap: value.glueFlap, clearance: value.clearance }));
        for (const scene of [bag, envelope, pillow]) {
          expect(() => assertSceneIntegrity(scene)).not.toThrow();
          expect(new Set(scene.paths.map((path) => path.id)).size).toBe(scene.paths.length);
        }
      },
    ), { numRuns: 100 });
  });

  it("preserves reinforced wall topology across randomized convex and rectangular trays", () => {
    fc.assert(fc.property(
      fc.record({
        width: fc.integer({ min: 60_000, max: 260_000 }), depth: fc.integer({ min: 30_000, max: 160_000 }),
        height: fc.integer({ min: 12_000, max: 80_000 }), lidHeight: fc.integer({ min: 12_000, max: 60_000 }),
        clearance: fc.integer({ min: 800, max: 4_000 }), lockTab: fc.integer({ min: 2_000, max: 8_000 }),
        angle: fc.integer({ min: 22_000, max: 70_000 }), thickness: fc.integer({ min: 300, max: 1_200 }),
      }).filter((value) => value.lockTab <= Math.min(value.height, value.lidHeight) * .6 && Math.min(value.height, value.lidHeight) > value.thickness * 2),
      (value) => {
        const scoreAllowanceUm = estimateScoreAllowance(um(value.thickness));
        const boxProject = projectForTemplate("box-with-lid", { width: value.width, depth: value.depth, height: value.height, lidHeight: value.lidHeight, glueFlap: Math.min(10_000, Math.floor(value.lidHeight * .7)), clearance: value.clearance, lockTab: value.lockTab });
        const cakeProject = projectForTemplate("cake-slice-box", { width: value.width, height: value.height, lidHeight: value.lidHeight, glueFlap: Math.min(10_000, Math.floor(value.lidHeight * .7)), clearance: value.clearance, lockTab: value.lockTab });
        const construction = { ...boxProject.construction, wallConstruction: "fold-over-lock" as const };
        const tuckConstruction = { ...boxProject.construction, wallConstruction: "fold-over-tuck" as const };
        const material = { ...boxProject.material, thicknessUm: um(value.thickness), scoreAllowanceUm };
        const box = generateBoxWithLid({ ...boxProject, construction, material });
        const cake = generateCakeSliceBox({ ...cakeProject, construction: { ...construction, sliceAngleMilliDegrees: value.angle }, material });
        const tuckBox = generateBoxWithLid({ ...boxProject, construction: tuckConstruction, material });
        const tuckCake = generateCakeSliceBox({ ...cakeProject, construction: { ...tuckConstruction, sliceAngleMilliDegrees: value.angle }, material });
        expect(() => assertSceneIntegrity(box)).not.toThrow();
        expect(() => assertSceneIntegrity(cake)).not.toThrow();
        expect(() => assertSceneIntegrity(tuckBox)).not.toThrow();
        expect(() => assertSceneIntegrity(tuckCake)).not.toThrow();
        expect(box.paths.filter((path) => path.role === "internal-cut").length).toBeGreaterThanOrEqual(8);
        expect(cake.paths.filter((path) => path.role === "internal-cut").length).toBeGreaterThanOrEqual(6);
        expect([...tuckBox.paths, ...tuckCake.paths].some((path) => path.role === "internal-cut" || path.id.includes("lock-tab") || path.id.includes("lock-slot"))).toBe(false);
      },
    ), { numRuns: 140 });
  });
});

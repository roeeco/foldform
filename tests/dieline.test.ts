import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_PROJECT, assertSceneIntegrity, calculateSheetFit, flattenPath, generateBoxWithLid,
  generateAutoLockCarton, generateCakeSliceBox, generateCrashLockCarton, generateMatchBox,
  generateProjectScene, generateTuckCarton, estimateScoreAllowance, offsetConvexProfile, parseMeasurement,
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
  return {
    ...project,
    template: { id: templateId, version: templateId === "tuck-end-carton" ? "2.0.0" : "1.0.0" },
    construction: { ...project.construction, glueAngleMilliDegrees: templateId === "tuck-end-carton" ? 80_000 : 45_000 },
  };
}

describe("fixed-point measurement boundary", () => {
  it("parses metric, decimal imperial, and mixed fractions exactly", () => {
    expect(parseMeasurement("120 mm", "mm")).toEqual({ ok: true, value: 120_000 });
    expect(parseMeasurement("12 cm", "mm")).toEqual({ ok: true, value: 120_000 });
    expect(parseMeasurement("4.75 in", "mm")).toEqual({ ok: true, value: 120_650 });
    expect(parseMeasurement('3/8"', "mm")).toEqual({ ok: true, value: 9_525 });
    expect(parseMeasurement("3 1/8 in", "mm")).toEqual({ ok: true, value: 79_375 });
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
    expect(migrated.schemaVersion).toBe(6);
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
    expect(migrated.schemaVersion).toBe(6);
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
    expect(migrated).toMatchObject({ schemaVersion: 6, engineVersion: "0.7.0" });
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
    expect(migrated).toMatchObject({ schemaVersion: 6, engineVersion: "0.7.0" });
    expect(migrated.construction.glueAngleMilliDegrees).toBe(45_000);
  });

  it("migrates version 5 projects with lock-bottom and profile defaults", () => {
    const oldParameters = Object.fromEntries(Object.entries(DEFAULT_PROJECT.parameters).filter(([id]) => id !== "bottomFlap" && id !== "lockOverlap"));
    const oldConstruction = Object.fromEntries(Object.entries(DEFAULT_PROJECT.construction).filter(([id]) => id !== "sliceAngleMilliDegrees"));
    const migrated = validateProject({
      ...DEFAULT_PROJECT, schemaVersion: 5, engineVersion: "0.5.0", parameters: oldParameters, construction: oldConstruction,
    });
    expect(migrated).toMatchObject({ schemaVersion: 6, engineVersion: "0.7.0" });
    expect(migrated.parameters.bottomFlap).toBe(DEFAULT_PROJECT.parameters.bottomFlap);
    expect(migrated.parameters.lockOverlap).toBe(DEFAULT_PROJECT.parameters.lockOverlap);
    expect(migrated.construction.sliceAngleMilliDegrees).toBe(30_000);
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
});

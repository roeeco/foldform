import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_PROJECT, assertSceneIntegrity, calculateSheetFit, generateStraightTuck,
  parseMeasurement, type ParameterId, type ProjectDocument, um,
} from "../app/lib/dieline";

function projectWith(parameters: Record<ParameterId, number>): ProjectDocument {
  return {
    ...DEFAULT_PROJECT,
    parameters: {
      width: um(parameters.width), depth: um(parameters.depth),
      height: um(parameters.height), glueFlap: um(parameters.glueFlap),
    },
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
});

describe("straight tuck geometry invariants", () => {
  it("is deterministic and preserves semantic identity", () => {
    const first = generateStraightTuck(DEFAULT_PROJECT);
    const second = generateStraightTuck(DEFAULT_PROJECT);
    expect(second).toEqual(first);
    expect(new Set(first.paths.map((path) => path.id)).size).toBe(first.paths.length);
    expect(first.paths[0]?.id).toBe("body.outer-cut");
  });

  it("holds integrity across randomized valid carton dimensions", () => {
    fc.assert(fc.property(
      fc.record({
        width: fc.integer({ min: 20_000, max: 300_000 }),
        depth: fc.integer({ min: 10_000, max: 150_000 }),
        height: fc.integer({ min: 25_000, max: 450_000 }),
        glueFlap: fc.integer({ min: 5_000, max: 14_000 }),
      }),
      (parameters) => {
        const scene = generateStraightTuck(projectWith(parameters));
        expect(() => assertSceneIntegrity(scene)).not.toThrow();
        expect(scene.paths.every((path) => path.role.length > 0)).toBe(true);
        for (const path of scene.paths) {
          for (const command of path.commands) {
            if (command.op === "close") continue;
            expect(Number.isSafeInteger(command.point.x)).toBe(true);
            expect(Number.isSafeInteger(command.point.y)).toBe(true);
            expect(command.point.x).toBeGreaterThanOrEqual(scene.bounds.minX);
            expect(command.point.y).toBeGreaterThanOrEqual(scene.bounds.minY);
            expect(command.point.x).toBeLessThanOrEqual(scene.bounds.maxX);
            expect(command.point.y).toBeLessThanOrEqual(scene.bounds.maxY);
          }
        }
      },
    ), { numRuns: 300 });
  });

  it("selects A4 landscape deterministically for the default net", () => {
    const scene = generateStraightTuck(DEFAULT_PROJECT);
    expect(calculateSheetFit(scene, DEFAULT_PROJECT)).toMatchObject({ fits: true, orientation: "landscape" });
  });
});

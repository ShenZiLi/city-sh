import { describe, expect, it } from "vitest";
import * as T from "three";
import { riverCenter, riverRibbon } from "../src/art-terrain";

describe("sample river and continuous banks", () => {
  it("shares both shoreline edges for the full curved river, with no gaps or land overlap", () => {
    const water = riverRibbon(-20, 20, 0),
      west = riverRibbon(-700, -20, -0.12),
      east = riverRibbon(20, 700, -0.12);
    const w = water.getAttribute("position"),
      a = west.getAttribute("position"),
      b = east.getAttribute("position");
    for (let i = 0; i < w.count; i += 2) {
      expect(w.getX(i)).toBeCloseTo(a.getX(i + 1), 4);
      expect(w.getX(i + 1)).toBeCloseTo(b.getX(i), 4);
      expect(w.getX(i + 1) - w.getX(i)).toBeCloseTo(40, 3);
    }
    for (const z of [-500, -100, 0, 100, 500])
      expect(Number.isFinite(riverCenter(z))).toBe(true);
    [water, west, east].forEach((g) => g.dispose());
  });
  it("keeps reflective water coplanar and upward facing through its local-plane conversion", () => {
    const original = riverRibbon(-20, 20, 0),
      reflector = original.clone().rotateX(Math.PI / 2);
    reflector.applyMatrix4(new T.Matrix4().makeRotationX(-Math.PI / 2));
    const vertices = reflector.getAttribute("position"),
      normals = reflector.getAttribute("normal");
    for (let i = 0; i < vertices.count; i++) {
      expect(Math.abs(vertices.getY(i))).toBeLessThan(0.0001);
      expect(normals.getY(i)).toBeGreaterThan(0.999);
    }
    original.dispose();
    reflector.dispose();
  });
});

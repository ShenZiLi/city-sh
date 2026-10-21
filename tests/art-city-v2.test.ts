import { describe, it, expect } from "vitest";
import * as T from "three";
import {
  bankPosition,
  riverAt,
  riverGeometry,
  ribbon,
  cityLayout,
  coreIds,
  inCreek,
} from "../src/art-v2/layout";

describe("complete waterfront layout", () => {
  it("retains exactly seven distinct landmark identities and every building family", () => {
    const layout = cityLayout(),
      ids = layout
        .filter((i) => i.landmarkId)
        .map((i) => i.landmarkId)
        .sort();
    expect(ids).toEqual([...coreIds].sort());
    for (const prefix of ["heritage", "modern"])
      for (let i = 0; i < 6; i++)
        expect(layout.some((item) => item.assetId === `${prefix}-${i}`)).toBe(
          true,
        );
    expect(cityLayout()).toEqual(layout);
  });
  it("keeps core architecture and placement centres outside the river", () => {
    for (const item of cityLayout()) {
      const p = new T.Vector3(...item.position),
        r = riverAt(p.z),
        normalDistance = p.clone().sub(r.point).dot(r.normal);
      // Centre projection uses the nearest centre-line station; tolerance
      // accounts for curved-bank normal displacing the Z coordinate.
      expect(Math.abs(normalDistance)).toBeGreaterThan(r.width + 15);
      expect(inCreek(p, 18)).toBe(false);
    }
  });
  it("uses upward-facing surfaces and the same centreline for banks and water", () => {
    for (const geometry of [
      riverGeometry(),
      ribbon(0, 13, 0.3, -1),
      ribbon(0, 13, 0.3, 1),
    ]) {
      const normals = geometry.getAttribute("normal");
      // A cut-out tributary leaves deliberately unreferenced seam vertices.
      for (const i of new Set(Array.from(geometry.index!.array)))
        expect(normals.getY(i)).toBeGreaterThan(0.99);
      geometry.dispose();
    }
    for (const z of [-600, -200, 0, 200, 600])
      for (const side of [-1, 1]) {
        const r = riverAt(z),
          p = bankPosition(z, side, 11);
        expect(p.clone().sub(r.point).dot(r.normal)).toBeCloseTo(
          side * (r.width + 11),
          4,
        );
      }
  });
});

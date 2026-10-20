import { describe, it, expect } from "vitest";
import {
  riverBounds,
  isRiver,
  isCreek,
  quaySegments,
  wrapRange,
  seededRandom,
  landmarks,
} from "../src/world-data";
import { ScalarTransition } from "../src/transition";
describe("urban layout", () => {
  it("keeps every landmark footprint away from the river", () => {
    for (const l of landmarks) {
      for (const x of [
        l.position[0] - l.width / 2,
        l.position[0] + l.width / 2,
      ])
        expect(isRiver(x, l.position[2])).toBe(false);
    }
  });
  it("keeps a navigable river corridor", () => {
    for (let z = -43; z <= 43; z++) {
      const [a, b] = riverBounds(z);
      expect(b - a).toBeGreaterThan(16);
      expect(isRiver((a + b) / 2, z)).toBe(true);
    }
  });
  it("has stable unique landmark identifiers", () => {
    expect(new Set(landmarks.map((l) => l.id)).size).toBe(13);
  });
  it("leaves the Suzhou Creek mouth open through the west quay", () => {
    for (const [a, b] of quaySegments(0))
      for (let z = a; z <= b; z += 0.25)
        expect(isCreek(riverBounds(z)[0] - 0.5, z)).toBe(false);
  });
  it("reproduces the city from a seed", () => {
    const a = seededRandom(14),
      b = seededRandom(14);
    expect(Array.from({ length: 20 }, a)).toEqual(
      Array.from({ length: 20 }, b),
    );
  });
});
describe("interrupted time transitions", () => {
  it("reaches the selected time after 2.4 seconds", () => {
    const t = new ScalarTransition(0);
    t.to(1, 0);
    expect(t.value(1.2)).toBeCloseTo(0.5);
    expect(t.value(2.4)).toBe(1);
  });
  it("continues from the visible value when interrupted", () => {
    const t = new ScalarTransition(0);
    t.to(1, 0);
    const current = t.value(0.8);
    t.to(0, 0.8);
    expect(t.value(0.8)).toBeCloseTo(current);
    expect(t.value(3.2)).toBe(0);
  });
  it("supports reduced motion without division by zero", () => {
    const t = new ScalarTransition(0, 0);
    t.to(1, 0);
    expect(t.value(0)).toBe(1);
  });
});
describe("long-running environment animations", () => {
  it("keeps reverse moving traffic inside its loop over many hours", () => {
    for (const t of [510, 1000, 86400, 864000]) {
      const z = wrapRange(-t * 2 + 7 + 1000, -34, 34);
      expect(z).toBeGreaterThanOrEqual(-34);
      expect(z).toBeLessThan(34);
    }
  });
});

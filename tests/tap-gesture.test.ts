import { it, expect } from "vitest";
import { TapGesture } from "../src/tap-gesture";
it("recognizes a single stationary tap", () => {
  const g = new TapGesture();
  g.down(1, 20, 30);
  expect(g.up(1, 22, 31)).toBe(true);
});
it("suppresses both releases after a pinch", () => {
  const g = new TapGesture();
  g.down(1, 20, 30);
  g.down(2, 80, 30);
  g.move(1, 0, 30);
  expect(g.up(2, 80, 30)).toBe(false);
  expect(g.up(1, 0, 30)).toBe(false);
});
it("does not select after dragging back to the start", () => {
  const g = new TapGesture();
  g.down(1, 20, 30);
  g.move(1, 60, 30);
  expect(g.up(1, 20, 30)).toBe(false);
});
it("clears cancelled gestures and accepts the next tap", () => {
  const g = new TapGesture();
  g.down(1, 20, 30);
  g.cancel(1);
  expect(g.up(1, 20, 30)).toBe(false);
  g.down(2, 40, 40);
  expect(g.up(2, 40, 40)).toBe(true);
});

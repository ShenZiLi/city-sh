export class TapGesture {
  private starts = new Map<number, { x: number; y: number }>();
  private suppressed = false;
  down(id: number, x: number, y: number) {
    if (!this.starts.size) this.suppressed = false;
    this.starts.set(id, { x, y });
    if (this.starts.size > 1) this.suppressed = true;
  }
  move(id: number, x: number, y: number) {
    const start = this.starts.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > 5)
      this.suppressed = true;
  }
  cancel(id: number) {
    this.suppressed = true;
    this.starts.delete(id);
  }
  up(id: number, x: number, y: number) {
    const start = this.starts.get(id);
    const tap =
      !!start &&
      !this.suppressed &&
      this.starts.size === 1 &&
      Math.hypot(x - start.x, y - start.y) <= 5;
    this.starts.delete(id);
    return tap;
  }
}

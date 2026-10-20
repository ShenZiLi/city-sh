/** Interruptible smoothstep animation; the next target starts at the visible value. */
export class ScalarTransition {
  private from: number;
  private target: number;
  private start = 0;
  constructor(
    initial: number,
    private duration = 2.4,
  ) {
    this.from = initial;
    this.target = initial;
  }
  to(target: number, now: number) {
    this.from = this.value(now);
    this.target = target;
    this.start = now;
  }
  value(now: number) {
    if (this.duration <= 0) return this.target;
    const t = Math.max(0, Math.min(1, (now - this.start) / this.duration));
    return this.from + (this.target - this.from) * t * t * (3 - 2 * t);
  }
}

/**
 * Auto-scroll while a drag is in progress (ninth round). The old editor has none: a drop target that is off screen could not be reached.
 *
 * While the pointer is within `zone` px of an edge of the scroller (inside its box), the scroller moves toward that edge, faster the closer the
 * pointer is to the edge: `minSpeed` px/s at the zone's inner border up to `maxSpeed` at the edge itself. It runs on animation frames, using the
 * frames' time stamps so that the speed does not depend on the refresh rate. After every frame `onFrame` is called, so that the caller can find the
 * drop target under the pointer again (CodeMirror 6 only draws the viewport: what has scrolled into view is new DOM).
 *
 * No React, no CodeMirror: the scroller is anything with the usual scroll properties, and the frames are injectable (a test supplies fake ones).
 */
export interface ScrollerLike {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  getBoundingClientRect(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}
export interface AutoScrollOptions {
  scroller: () => ScrollerLike;
  /** called after every frame while the pointer is in a zone, and once more when the scrolling stops by itself */
  onFrame: () => void;
  zone?: number;
  minSpeed?: number;
  maxSpeed?: number;
  raf?: (cb: (t: number) => void) => number;
  caf?: (id: number) => void;
  now?: () => number;
}
export interface AutoScroll {
  /** the pointer is at (x, y) (viewport coordinates): start, change or stop the scrolling */
  update(x: number, y: number): void;
  /** the drag is over (or cancelled): stop */
  stop(): void;
  readonly running: boolean;
}

/** how far into a zone: magnitude 0 at the zone's inner border, 1 at the edge; negative near the low edge (scroll back), positive near the high edge (scroll on); null outside the zone */
export function edgeDepth(
  pos: number,
  lo: number,
  hi: number,
  zone: number
): number | null {
  if (pos < lo || pos > hi) return null;
  const fromLo = pos - lo;
  const fromHi = hi - pos;
  if (fromLo < zone && fromLo <= fromHi) return -(1 - fromLo / zone);
  if (fromHi < zone) return 1 - fromHi / zone;
  return null;
}

export function createAutoScroll(o: AutoScrollOptions): AutoScroll {
  const zone = o.zone ?? 40;
  const minSpeed = o.minSpeed ?? 120;
  const maxSpeed = o.maxSpeed ?? 1400;
  const raf = o.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = o.caf ?? ((id) => cancelAnimationFrame(id));
  let id = 0;
  let active = false;
  let px = 0;
  let py = 0;
  let last = -1;
  let carryX = 0;
  let carryY = 0;
  const speed = (depth: number): number =>
    Math.sign(depth) *
    (minSpeed + (maxSpeed - minSpeed) * Math.abs(depth) ** 1.5);
  /** (the direction and depth of the pointer in each axis; 0 when it is not in a zone, or the editor cannot scroll that way) */
  function depths(): { dx: number; dy: number } {
    const s = o.scroller();
    const r = s.getBoundingClientRect();
    const inX = px >= r.left && px <= r.right;
    const inY = py >= r.top && py <= r.bottom;
    let dy = 0;
    let dx = 0;
    if (inX && inY) {
      if (s.scrollHeight > s.clientHeight)
        dy = edgeDepth(py, r.top, r.bottom, zone) ?? 0;
      if (s.scrollWidth > s.clientWidth)
        dx = edgeDepth(px, r.left, r.right, zone) ?? 0;
    }
    return { dx, dy };
  }
  function tick(t: number): void {
    id = 0;
    if (!active) return;
    const { dx, dy } = depths();
    if (dx === 0 && dy === 0) {
      active = false;
      last = -1;
      carryX = carryY = 0;
      return;
    }
    const dt = last < 0 ? 16 : Math.min(50, Math.max(0, t - last));
    last = t;
    const s = o.scroller();
    if (dy !== 0) {
      carryY += (speed(dy) * dt) / 1000;
      const step = Math.trunc(carryY);
      if (step !== 0) {
        carryY -= step;
        const max = Math.max(0, s.scrollHeight - s.clientHeight);
        s.scrollTop = Math.min(max, Math.max(0, s.scrollTop + step));
      }
    }
    if (dx !== 0) {
      carryX += (speed(dx) * dt) / 1000;
      const step = Math.trunc(carryX);
      if (step !== 0) {
        carryX -= step;
        const max = Math.max(0, s.scrollWidth - s.clientWidth);
        s.scrollLeft = Math.min(max, Math.max(0, s.scrollLeft + step));
      }
    }
    o.onFrame();
    id = raf(tick);
  }
  return {
    update(x, y) {
      px = x;
      py = y;
      if (active) return;
      const { dx, dy } = depths();
      if (dx === 0 && dy === 0) return;
      active = true;
      last = -1;
      id = raf(tick);
    },
    stop() {
      const was = active;
      active = false;
      last = -1;
      carryX = carryY = 0;
      if (id) caf(id);
      id = 0;
      void was;
    },
    get running() {
      return active;
    },
  };
}

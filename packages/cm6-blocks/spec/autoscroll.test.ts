/** @jest-environment jsdom */
/* Ninth round, step 1: auto-scroll during a drag. The logic (zone, speed, stop conditions) with a fake scroller and fake frames, then the wiring. */
import { createAutoScroll, edgeDepth, ScrollerLike } from "../src/autoscroll";
import { checkLezerEditor } from "../src/lezer-view";
import { make, TEXT } from "./helpers";

function fake(over: Partial<ScrollerLike> = {}) {
  const s = { scrollTop: 500, scrollLeft: 0, scrollHeight: 2000, scrollWidth: 300, clientHeight: 400, clientWidth: 300, getBoundingClientRect: () => ({ left: 0, top: 100, right: 300, bottom: 500 }), ...over };
  let queue: ((t: number) => void)[] = [];
  let t = 0;
  const frames = { n: 0 };
  const raf = (cb: (t: number) => void) => {
    queue.push(cb);
    return queue.length;
  };
  const run = (n = 1, dt = 16) => {
    for (let i = 0; i < n; i++) {
      const q = queue;
      queue = [];
      t += dt;
      frames.n++;
      q.forEach((f) => f(t));
    }
  };
  let calls = 0;
  const a = createAutoScroll({ scroller: () => s, onFrame: () => calls++, raf, caf: () => (queue = []) });
  return { s, a, run, calls: () => calls, pending: () => queue.length };
}

describe("edgeDepth", () => {
  test("zero depth outside the zone, deeper the closer to the edge, signed by the edge", () => {
    expect(edgeDepth(300, 100, 500, 40)).toBeNull();
    expect(edgeDepth(140, 100, 500, 40)).toBeNull(); // (the zone's inner border)
    expect(edgeDepth(120, 100, 500, 40)).toBeCloseTo(-0.5);
    expect(edgeDepth(100, 100, 500, 40)).toBe(-1);
    expect(edgeDepth(480, 100, 500, 40)).toBeCloseTo(0.5);
    expect(edgeDepth(500, 100, 500, 40)).toBe(1);
    expect(edgeDepth(50, 100, 500, 40)).toBeNull(); // (outside the box)
  });
});

describe("createAutoScroll", () => {
  test("nothing happens outside the zones, or when the content does not scroll", () => {
    const f = fake();
    f.a.update(150, 300);
    expect(f.a.running).toBe(false);
    expect(f.pending()).toBe(0);
    const g = fake({ scrollHeight: 400 });
    g.a.update(150, 105);
    expect(g.a.running).toBe(false);
  });
  test("near the bottom it scrolls down, near the top up, on frames, and onFrame follows each frame", () => {
    const f = fake();
    f.a.update(150, 495);
    expect(f.a.running).toBe(true);
    f.run(10);
    expect(f.s.scrollTop).toBeGreaterThan(500);
    expect(f.calls()).toBe(10);
    const top = fake();
    top.a.update(150, 105);
    top.run(10);
    expect(top.s.scrollTop).toBeLessThan(500);
  });
  test("faster the closer to the edge, and the same speed whatever the frame rate", () => {
    const dist = (y: number, n = 30, dt = 16) => {
      const f = fake();
      f.a.update(150, y);
      f.run(n, dt);
      return f.s.scrollTop - 500;
    };
    const far = dist(465);
    const mid = dist(480);
    const edge = dist(500);
    expect(far).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(far);
    expect(edge).toBeGreaterThan(mid);
    const a = dist(490, 60, 16);
    const b = dist(490, 120, 8);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(12); // (the first frame counts as 16 ms in both)
  });
  test("a frame that arrives late does not jump", () => {
    const f = fake();
    f.a.update(150, 500);
    f.run(1, 16);
    const before = f.s.scrollTop;
    f.run(1, 2000);
    expect(f.s.scrollTop - before).toBeLessThanOrEqual(80);
  });
  test("sideways, when the content is wider than the box", () => {
    const f = fake({ scrollWidth: 900 });
    f.a.update(298, 300);
    f.run(10);
    expect(f.s.scrollLeft).toBeGreaterThan(0);
    expect(f.s.scrollTop).toBe(500);
  });
  test("stops when the pointer leaves the zone", () => {
    const f = fake();
    f.a.update(150, 495);
    f.run(3);
    const t = f.s.scrollTop;
    f.a.update(150, 300);
    f.run(3);
    expect(f.s.scrollTop).toBeGreaterThanOrEqual(t); // (the frame in flight may still move it, then it stops)
    f.run(5);
    expect(f.a.running).toBe(false);
    expect(f.pending()).toBe(0);
    const t2 = f.s.scrollTop;
    f.run(5);
    expect(f.s.scrollTop).toBe(t2);
  });
  test("stop() ends it at once (the drag is over, or cancelled)", () => {
    const f = fake();
    f.a.update(150, 495);
    f.run(2);
    f.a.stop();
    const t = f.s.scrollTop;
    f.run(5);
    expect(f.s.scrollTop).toBe(t);
    expect(f.a.running).toBe(false);
  });
  test("at the document's ends it does not go past them", () => {
    const f = fake({ scrollTop: 1590 });
    f.a.update(150, 500);
    f.run(100);
    expect(f.s.scrollTop).toBe(1600);
    const g = fake({ scrollTop: 10 });
    g.a.update(150, 100);
    g.run(100);
    expect(g.s.scrollTop).toBe(0);
  });
});

describe.each(["scheme", "javascript", "python"])("wired into the drag: %s", (l) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const ptr = (el: Element | Document, type: string, x: number, y: number, pointerType = "mouse") => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerType", { value: pointerType });
    Object.defineProperty(e, "pointerId", { value: 3 });
    el.dispatchEvent(e);
  };
  function setup() {
    const ed = make(l);
    const sd = ed.view.scrollDOM;
    let top = 0;
    Object.defineProperties(sd, {
      scrollTop: { get: () => top, set: (v) => (top = v), configurable: true },
      scrollHeight: { get: () => 5000, configurable: true },
      clientHeight: { get: () => 400, configurable: true },
    });
    sd.getBoundingClientRect = () => ({ left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const at = { el: document.body as Element };
    document.elementFromPoint = () => at.el;
    const block = ed.view.dom.querySelector(".blocks-node .blocks-node") as HTMLElement;
    return { ed, at, block, top: () => top };
  }
  test("a mouse drag near the bottom scrolls, and the target is found again as the content moves; Escape cancels and stops", () => {
    const { ed, at, block, top } = setup();
    ptr(block, "pointerdown", 50, 50);
    ptr(document, "pointermove", 70, 60);
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(true);
    ptr(document, "pointermove", 70, 395);
    jest.advanceTimersByTime(500);
    expect(top()).toBeGreaterThan(50);
    // the element under the pointer changes as the content moves: the new one is the marked target
    const gap = ed.view.dom.querySelector(".blocks-gap") as HTMLElement;
    at.el = gap;
    jest.advanceTimersByTime(40);
    expect(gap.classList.contains("blocks-drop-target")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
    const t = top();
    jest.advanceTimersByTime(500);
    expect(top()).toBe(t);
    ptr(document, "pointerup", 70, 395);
    expect(ed.view.state.doc.toString()).toBe(TEXT[l]);
    expect(checkLezerEditor(ed)).toEqual([]);
  });
  test("letting go ends the scrolling", () => {
    const { ed, block, top } = setup();
    ptr(block, "pointerdown", 50, 50);
    ptr(document, "pointermove", 70, 395);
    jest.advanceTimersByTime(200);
    ptr(document, "pointerup", 70, 395);
    const t = top();
    expect(t).toBeGreaterThan(0);
    jest.advanceTimersByTime(500);
    expect(top()).toBe(t);
    expect(ed.view.dom.classList.contains("blocks-dragging")).toBe(false);
  });
  test("a template drag from the toolbar scrolls too, near the top it scrolls back", () => {
    const { ed, top } = setup();
    const button = document.createElement("button");
    document.body.appendChild(button);
    ed.beginTemplateDrag(Object.assign(new MouseEvent("pointerdown", { button: 0, clientX: 5, clientY: 5 }), { pointerType: "mouse", pointerId: 3 }) as PointerEvent, "number");
    ptr(document, "pointermove", 70, 30);
    ptr(document, "pointermove", 70, 398);
    jest.advanceTimersByTime(600);
    const down = top();
    expect(down).toBeGreaterThan(100);
    ptr(document, "pointermove", 70, 2);
    jest.advanceTimersByTime(300);
    expect(top()).toBeLessThan(down);
    ptr(document, "pointerup", 70, 2);
    button.remove();
    document.querySelectorAll(".blocks-drag-ghost").forEach((g) => g.remove());
  });
});

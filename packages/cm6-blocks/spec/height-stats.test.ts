/** @jest-environment jsdom */
// The counters of the height check (`ed.heightStats()`), which the soak reads. jsdom lays nothing out: every line's rectangle is 0 high while CodeMirror
// holds an estimate, so the check always finds the page "stale" and a re-measure never changes anything. That is what makes the counters testable here:
// a repair that changes nothing is a false positive, and the cap of two repairs shows.
import { make, TEXT } from "./helpers";

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (k: number) =>
      k === 0 ? resolve() : requestAnimationFrame(() => step(k - 1));
    step(n);
  });

test("nothing happens when idle: the counters are all zero", () => {
  const ed = make("scheme", TEXT.scheme);
  const s = ed.heightStats();
  expect(s.staleCalls).toBe(0);
  expect(s.staleTrue).toBe(0);
  expect(s.staleMs).toBe(0);
  expect(s.repairs).toBe(0);
  expect(s.capped).toBe(0);
});

test("an edit schedules one check; it reads the heights and, finding them stale, repairs once", async () => {
  const ed = make("scheme", TEXT.scheme);
  await frames(6);
  const a = ed.heightStats();
  ed.view.dispatch({ changes: { from: 0, insert: "(z 1)\n" } });
  await frames(8);
  const b = ed.heightStats();
  expect(b.checks).toBeGreaterThan(a.checks);
  expect(b.staleCalls).toBeGreaterThan(a.staleCalls);
  expect(b.staleTrue).toBeGreaterThan(a.staleTrue);
  expect(b.staleMs).toBeGreaterThanOrEqual(a.staleMs);
  expect(b.repairs).toBeGreaterThan(a.repairs);
  expect(b.remeasures).toBeGreaterThanOrEqual(b.repairs);
  // (jsdom: a re-measure changes no height, so the repair was a false positive)
  expect(b.falsePositives).toBeGreaterThan(a.falsePositives);
  expect(b.falsePositives).toBeLessThanOrEqual(b.repairs);
});

test("a check that keeps finding the page stale stops repairing after two tries, and counts what it refused", async () => {
  const ed = make("scheme", TEXT.scheme);
  await frames(6);
  const a = ed.heightStats();
  for (let i = 0; i < 6; i++) {
    ed.view.dispatch({ changes: { from: 0, insert: "(z 1)\n" } });
    await frames(6);
  }
  const b = ed.heightStats();
  expect(b.repairs - a.repairs).toBeLessThanOrEqual(2);
  expect(b.capped).toBeGreaterThan(a.capped);
  // (every repair that happened is counted once, and the re-measure it made is among the re-measures)
  expect(b.remeasures).toBeGreaterThanOrEqual(b.repairs);
});

test("the stats are a copy", () => {
  const ed = make("scheme", TEXT.scheme);
  const s = ed.heightStats();
  s.checks = 99;
  expect(ed.heightStats().checks).not.toBe(99);
});

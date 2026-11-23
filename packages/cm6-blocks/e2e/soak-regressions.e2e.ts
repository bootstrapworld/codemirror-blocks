/*
 * Regressions found by the soak runner's Chromium engine (scripts/soak.js, e2e/soak-run.ts): each case is a shrunk sequence of steps, replayed
 * with every invariant checked after every step. `npm run soak -w @bootstrapworld/cm6-blocks -- --promote <seed>` prints a case.
 */
import { expect, test } from "@playwright/test";
import type { Sequence } from "../spec/soak-gen";
import { runChromium } from "./soak-run";

const baseURL = `http://127.0.0.1:${process.env.CMB6_PORT || 8177}`;

test("seed 552: an edit box that opens (a click on a leaf) and closes (the next click) changes the height of its line: the line numbers follow", async ({
  browser,
}) => {
  const v = await runChromium(
    browser,
    {
      engine: "chromium",
      seed: 552,
      language: "python",
      code: '# a comment\ntotal = 0\nfor x in [1, 2, 3]:\n    total = total + x\nprint(total, "done")\n',
      steps: [
        { op: "click", a: 0.924224688205868, shift: false },
        { op: "focus", a: 0.4647825409192592 },
      ],
      motion: "reduced",
    } as Sequence,
    { baseURL }
  );
  expect(v).toBeNull();
});

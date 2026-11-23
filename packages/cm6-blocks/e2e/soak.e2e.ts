/*
 * The soak runner's Chromium worker (scripts/soak.js starts it with e2e/soak.config.ts; the normal suite skips it). CMB6_SOAK_JOB=<job file>:
 * `{seeds: [..], steps: N, language?, shrinkRuns?, motion?, skip?, out: <results file>, baseURL}`; one JSON line per seed is appended to `out`
 * (`{seed, ok: true}` or the failure's record). CMB6_SOAK_REPLAY=<record file> replays one record.
 */
import { test } from "@playwright/test";
import * as fs from "fs";
import { runChromium, soakSeedChromium } from "./soak-run";

const job = process.env.CMB6_SOAK_JOB
  ? JSON.parse(fs.readFileSync(process.env.CMB6_SOAK_JOB, "utf8"))
  : null;
const replay = process.env.CMB6_SOAK_REPLAY
  ? JSON.parse(fs.readFileSync(process.env.CMB6_SOAK_REPLAY, "utf8"))
  : null;
const baseURL = `http://127.0.0.1:${process.env.CMB6_PORT}`;

test("soak", async ({ browser }) => {
  test.skip(
    !job && !replay,
    "set CMB6_SOAK_JOB (npm run soak starts this worker)"
  );
  if (replay) {
    const v = await runChromium(browser, replay, { baseURL });
    if (v)
      throw new Error(
        `${v.invariant} after step ${v.step} (${v.op}): ${v.message}`
      );
    return;
  }
  for (const seed of job.seeds as number[]) {
    const t0 = Date.now();
    const rec = await soakSeedChromium(browser, seed, job.steps, {
      ...job,
      baseURL,
    });
    fs.appendFileSync(
      job.out,
      JSON.stringify(
        rec
          ? { ...rec, ms: Date.now() - t0 }
          : { seed, ok: true, ms: Date.now() - t0 }
      ) + "\n"
    );
  }
});

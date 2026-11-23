/** @jest-environment jsdom */
/*
 * The soak runner's jsdom worker (scripts/soak.js starts it; it is not a test of its own). It runs only with CMB6_SOAK_JOB=<job file>:
 * `{seeds: [..], steps: N, language?, shrinkRuns?, motion?, out: <results file>}`; one JSON line per seed is appended to `out`:
 * `{seed, ok: true}` or the failure's record (see spec/soak-jsdom.ts). CMB6_SOAK_REPLAY=<record file> replays one record.
 */
import * as fs from "fs";
import { replayJsdom, soakSeed } from "./soak-jsdom";
import { randomProgram } from "./soak-gen";

const job = process.env.CMB6_SOAK_JOB
  ? JSON.parse(fs.readFileSync(process.env.CMB6_SOAK_JOB, "utf8"))
  : null;
const replay = process.env.CMB6_SOAK_REPLAY
  ? JSON.parse(fs.readFileSync(process.env.CMB6_SOAK_REPLAY, "utf8"))
  : null;

if (process.env.CMB6_SOAK_WARM)
  test("read the corpora into the cache file", () => {
    for (const l of ["scheme", "javascript", "python"] as const)
      randomProgram(l, () => 0.9);
  }, 600_000);
else if (!job && !replay)
  test.skip("set CMB6_SOAK_JOB (npm run soak starts this worker)", () => {});
if (replay)
  test("replay of a soak record", () => {
    replayJsdom(replay);
  }, 120_000);
if (job)
  test(
    "soak batch",
    async () => {
      for (const seed of job.seeds as number[]) {
        const t0 = Date.now();
        const rec = await soakSeed(seed, job.steps, job);
        fs.appendFileSync(
          job.out,
          JSON.stringify(
            rec
              ? { ...rec, ms: Date.now() - t0 }
              : { seed, ok: true, ms: Date.now() - t0 }
          ) + "\n"
        );
      }
    },
    24 * 3600e3
  );

const lib = require("./soak-lib");

describe("the height check's counters in the soak results", () => {
  const h = (o) => ({
    checks: 5,
    staleCalls: 5,
    staleTrue: 2,
    staleMs: 3,
    remeasures: 4,
    repairs: 2,
    falsePositives: 1,
    stillStale: 0,
    capped: 0,
    ...o,
  });
  test("read from the results, totalled, the most repairs and the slow sequences kept", () => {
    const text =
      JSON.stringify({ seed: 1, ok: true, heights: h({}) }) +
      "\n" +
      JSON.stringify({
        seed: 2,
        ok: true,
        heights: h({ repairs: 7, staleMs: 80 }),
      }) +
      "\n" +
      JSON.stringify({ seed: 3, ok: true }) +
      "\n";
    const r = lib.readResults(text);
    expect(r.heights.map((x) => x.seed)).toEqual([1, 2]);
    const total = {};
    for (const x of r.heights) lib.addHeights(total, x.seed, x.h);
    expect(total).toMatchObject({
      sequences: 2,
      repairs: 9,
      falsePositives: 2,
      maxRepairs: 7,
      maxRepairsSeed: 2,
      slow: 1,
      slowSeeds: [2],
    });
    const md = lib.summarize(
      {
        engine: "chromium",
        sequences: 3,
        failures: 0,
        nextSeed: 4,
        head: "x",
        heights: total,
      },
      {},
      []
    );
    expect(md).toContain(
      "false positives (a repair that changed no height): 2"
    );
    expect(md).toContain("SLOW: 1 sequences spent over 50 ms");
  });
  test("a summary of a run with no counters has no section", () => {
    const md = lib.summarize(
      { engine: "jsdom", sequences: 1, failures: 0, nextSeed: 2, head: "x" },
      {},
      []
    );
    expect(md).not.toContain("Height check");
  });
});

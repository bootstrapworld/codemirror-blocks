const lib = require("./field-reports");

const report = {
  format: 1,
  version: "0.9.0",
  language: "wescheme",
  blockMode: true,
  userAgent: "x",
  code: "(f x)",
  actions: [
    { type: "SET_AST", code: "(f x)" },
    { type: "SET_FOCUS", nid: 0 },
  ],
  droppedActions: 0,
  error: {
    message: "node 3f2a is gone (12:4)",
    stack: "Error: x\n    at foo (a.js:1:1)",
  },
};
const body = (r) =>
  "**Describe the bug**\nit broke\n\n<details>\n\n```json cmb-report\n" +
  JSON.stringify(r) +
  "\n```\n\n</details>\n";
const issue = (number, b) => ({
  number,
  title: "[BUG] broke",
  html_url: `https://github.com/o/r/issues/${number}`,
  created_at: "2026-11-01T00:00:00Z",
  body: b,
});

describe("format 2 (events)", () => {
  const v2 = {
    ...report,
    format: 2,
    actions: [
      { type: "MOUSE", nid: 1 },
      { type: "KEY", key: "Z", mods: "CS", nid: null },
      { type: "DRAG", from: { tool: "sqrt" }, to: { gap: 2 } },
      { type: "DRAG", from: { nid: 1 }, to: { ws: { line: 0, ch: 3 } } },
      { type: "EDIT", text: "(f y)", how: "enter" },
      { type: "KEY", key: 5, nid: 1 }, // malformed
      { type: "SET_FOCUS", nid: 1 },
    ],
  };
  it("keeps well-formed events and drops malformed ones", () => {
    const p = lib.parseIssueBody(body(v2));
    expect(p.report.actions).toHaveLength(6);
    expect(p.warnings[0]).toMatch(/1 malformed/);
  });
  it("still reads format 1", () => {
    expect(lib.parseIssueBody(body(report)).report.format).toBe(1);
  });
  it("says in the entry how many events there are, and describes them", () => {
    const { report: r } = lib.parseIssueBody(body(v2));
    const e = lib.toEntry(issue(3, ""), r);
    expect(e).toMatchObject({ format: 2, events: 5, steps: 6 });
    expect(e.trace).toContain("drag toolbar sqrt to gap 2");
    expect(e.trace).toContain("key CS-Z on editor");
  });
});

describe("reading an issue body", () => {
  it("finds the report block among the human text", () => {
    const p = lib.parseIssueBody(body(report));
    expect(p.report.actions).toHaveLength(2);
    expect(p.report.code).toBe("(f x)");
  });
  it("skips old-format issues and malformed blocks, with a reason", () => {
    expect(lib.parseIssueBody("**Describe the bug**\nhi").skip).toMatch(
      /no cmb-report/
    );
    expect(lib.parseIssueBody("```json cmb-report\n{oops\n```").skip).toMatch(
      /not valid JSON/
    );
    expect(lib.parseIssueBody(body({ ...report, format: 9 })).skip).toMatch(
      /format/
    );
    expect(
      lib.parseIssueBody(body({ format: 1, language: "x" })).skip
    ).toBeDefined();
    expect(lib.parseIssueBody(undefined).skip).toBeDefined();
  });
  it("keeps the good actions of a report with bad ones", () => {
    const p = lib.parseIssueBody(
      body({
        ...report,
        actions: [...report.actions, { type: "SET_AST" }, { type: "NOPE" }],
      })
    );
    expect(p.report.actions).toHaveLength(2);
    expect(p.warnings[0]).toMatch(/2 malformed/);
  });
  it("reads a report that was trimmed to fit the link", () => {
    const p = lib.parseIssueBody(
      body({ ...report, droppedActions: 40, startCode: "(g)", actions: [] })
    );
    expect(p.report.droppedActions).toBe(40);
    expect(p.report.startCode).toBe("(g)");
  });
});

describe("recording reports", () => {
  it("makes an entry shaped like the soak's, with a replay command", () => {
    const e = lib.toEntry(issue(7, ""), report);
    expect(e).toMatchObject({
      mode: "field",
      kind: "field",
      issue: 7,
      steps: 2,
      failedAt: "error",
      head: "0.9.0",
    });
    expect(e.replay).toBe(
      "CMB_FIELD_REPLAY=soak-results/field/issue-7.json npx jest field-replay"
    );
    expect(e.problem).toBe("node 3f2a is gone (12:4)");
  });
  it("gives the same signature to one error whatever the ids, and another to another", () => {
    const a = lib.signature(issue(1), report);
    const b = lib.signature(issue(2), {
      ...report,
      error: { ...report.error, message: "node 99ab is gone (3:1)" },
    });
    const c = lib.signature(issue(3), {
      ...report,
      error: { message: "other" },
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it("a report without an error is its own signature, and says it is user-reported", () => {
    const noError = { ...report, error: undefined };
    expect(lib.signature(issue(5), noError)).toContain("issue 5");
    expect(lib.toEntry(issue(5), noError).problem).toMatch(/^user-reported/);
  });
  it("does not record an issue twice, and ignores pull requests", () => {
    const issues = [
      issue(1, body(report)),
      issue(2, body(report)),
      issue(3, "old"),
      { ...issue(4, body(report)), pull_request: {} },
    ];
    const first = lib.ingest(issues, []);
    expect(first.fresh.map((f) => f.entry.issue)).toEqual([1, 2]);
    expect(first.skipped.map((s) => s.number)).toEqual([3]);
    const again = lib.ingest(
      issues,
      first.fresh.map((f) => f.entry)
    );
    expect(again.fresh).toEqual([]);
    expect(again.known).toHaveLength(2);
  });
});

describe("jsonValues", () => {
  it("reads the pages gh prints one after another", () => {
    expect(lib.jsonValues('[{"a":1}]\n[{"a":2},{"a":3}]\n[]')).toEqual([
      [{ a: 1 }],
      [{ a: 2 }, { a: 3 }],
      [],
    ]);
  });
  it("is not fooled by brackets and quotes inside a string", () => {
    const body = 'a ] [ " \\ } { b';
    const text = JSON.stringify([{ body }]) + "\n" + JSON.stringify([{ body }]);
    expect(lib.jsonValues(text)).toEqual([[{ body }], [{ body }]]);
  });
});

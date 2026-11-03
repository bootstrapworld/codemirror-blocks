/* eslint-disable no-console -- command-line tool */
// Turn results-{time,profile,render}.json into the markdown tables in the report.
//   node summarize.mjs
import fs from "fs";

const load = (f) =>
  fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : [];
const med = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const rng = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? `${Math.round(s[0])}–${Math.round(s[s.length - 1])}` : "";
};
const r0 = (x) => (Number.isFinite(x) ? Math.round(x) : "–");
const sizes = (rs) => [...new Set(rs.map((r) => r.size))].sort((a, b) => a - b);
const opsOf = (rs) =>
  rs[0]?.ops.map((o) => o.op).filter((o) => !o.startsWith("0.")) ?? [];
const pick = (rs, size, op, f) =>
  rs
    .filter((r) => r.size === size)
    .map((r) => f(r.ops.find((o) => o.op === op)));

const out = [];
const time = load("results-time.json");
if (time.length) {
  out.push(
    "### Wall-clock (ms): first change / settled, median (min–max) of settled\n"
  );
  const ss = sizes(time);
  out.push(`| operation | ${ss.map((s) => `${s} lines`).join(" | ")} |`);
  out.push(`|---|${ss.map(() => "---").join("|")}|`);
  for (const op of opsOf(time)) {
    const cells = ss.map((s) => {
      const f = pick(time, s, op, (o) => o?.first);
      const w = pick(time, s, op, (o) => o?.wall);
      return `${r0(med(f))} / **${r0(med(w))}** (${rng(w)})`;
    });
    out.push(`| ${op} | ${cells.join(" | ")} |`);
  }
  const g = time.map((r) =>
    r.ops.find((o) => o.keyLatencyMedian !== undefined)
  );
  out.push(
    "\nText-mode key latency (keydown → next frame), median per size: " +
      sizes(time)
        .map(
          (s) =>
            `${s}: ${med(time.map((r, i) => (r.size === s ? g[i]?.keyLatencyMedian : null)))} ms`
        )
        .join(", ")
  );
  const nodes = time.map((r) => r.ops[0]?.nodes);
  out.push(
    `\nTop-level forms: ${sizes(time)
      .map(
        (s) =>
          `${s} lines = ${med(time.map((r, i) => (r.size === s ? nodes[i] : null)))}`
      )
      .join(", ")}`
  );
}

const prof = load("results-profile.json");
if (prof.length) {
  out.push(
    "\n### Where the CPU time goes (ms of main-thread work, median; % of busy)\n"
  );
  const ss = sizes(prof);
  const baseRate = med(
    prof.map((r) => {
      const b = r.ops.find((o) => o.op.startsWith("0."));
      const win = Object.values(b.buckets).reduce((a, x) => a + x, 0);
      return b.buckets.program / win;
    })
  );
  const cols = [
    "react",
    "redux",
    "codemirror",
    "parse+patchAst",
    "layout/style/paint",
    "gc",
    "other",
  ];
  const split = (o) => {
    const b = o.buckets;
    const win = Object.values(b).reduce((a, x) => a + x, 0);
    const programNet = Math.max(0, (b.program ?? 0) - baseRate * win);
    const br = o.browser ?? {};
    const browser = [
      "UpdateLayoutTree",
      "Layout",
      "PrePaint",
      "Paint",
      "Layerize",
    ].reduce((a, k) => a + (br[k] ?? 0), 0);
    const known =
      (b.react ?? 0) +
      (b.redux ?? 0) +
      (b.codemirror ?? 0) +
      (b["parse+patchAst"] ?? 0) +
      (b.gc ?? 0);
    const other =
      (b["ours-other"] ?? 0) +
      (b["native-dom"] ?? 0) +
      (b["vendor-other"] ?? 0) +
      Math.max(0, programNet - browser);
    return {
      react: b.react ?? 0,
      redux: b.redux ?? 0,
      codemirror: b.codemirror ?? 0,
      "parse+patchAst": b["parse+patchAst"] ?? 0,
      "layout/style/paint": browser,
      gc: b.gc ?? 0,
      other,
      busy: known + browser + other,
    };
  };
  for (const op of opsOf(prof)) {
    out.push(`\n**${op}**\n`);
    out.push(`| lines | busy ms | ${cols.join(" | ")} |`);
    out.push(`|---|---|${cols.map(() => "---").join("|")}|`);
    for (const s of ss) {
      const sp = pick(prof, s, op, (o) => (o ? split(o) : null)).filter(
        Boolean
      );
      const busy = med(sp.map((x) => x.busy));
      out.push(
        `| ${s} | ${r0(busy)} | ${cols
          .map((c) => {
            const v = med(sp.map((x) => x[c]));
            return `${r0(v)} (${r0((100 * v) / busy)}%)`;
          })
          .join(" | ")} |`
      );
    }
  }
  out.push("\n### Inclusive time of selected functions (ms, median)\n");
  const keys = new Set();
  prof.forEach((r) =>
    r.ops.forEach((o) => Object.keys(o.incl ?? {}).forEach((k) => keys.add(k)))
  );
  const big = [...keys]
    .map((k) => [
      k,
      Math.max(...prof.flatMap((r) => r.ops.map((o) => o.incl?.[k] ?? 0))),
    ])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map((x) => x[0]);
  out.push(`| function | op @ ${ss[ss.length - 1]} lines → ms |`);
  out.push("|---|---|");
  for (const k of big) {
    const cells = opsOf(prof).map(
      (op) =>
        `${op.split(" ").slice(0, 2).join(" ")}: ${r0(med(pick(prof, ss[ss.length - 1], op, (o) => o?.incl?.[k] ?? 0)))}`
    );
    out.push(`| \`${k}\` | ${cells.join("; ")} |`);
  }
}

const rend = load("results-render.json");
if (rend.length) {
  out.push(
    "\n### React component renders per operation (median; commits in brackets)\n"
  );
  const ss = sizes(rend);
  out.push(`| operation | ${ss.map((s) => `${s} lines`).join(" | ")} |`);
  out.push(`|---|${ss.map(() => "---").join("|")}|`);
  for (const op of opsOf(rend)) {
    const cells = ss.map(
      (s) =>
        `${r0(med(pick(rend, s, op, (o) => o?.react?.renders)))} (${r0(med(pick(rend, s, op, (o) => o?.react?.commits)))})`
    );
    out.push(`| ${op} | ${cells.join(" | ")} |`);
  }
  const last = ss[ss.length - 1];
  for (const op of [
    "f. arrow down x50",
    "e. undo",
    "c. edit literal mid-doc (commit)",
  ]) {
    const r = rend.find((x) => x.size === last)?.ops.find((o) => o.op === op);
    if (!r) continue;
    const top = Object.entries(r.react.byName)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    out.push(
      `\nTop components, ${op} @ ${last} lines: ${top.map(([n, c]) => `${n} ${c}`).join(", ")}`
    );
  }
}
console.log(out.join("\n"));

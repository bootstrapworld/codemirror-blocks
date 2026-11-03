// Profile the editor on large generated documents. See ../profile-large-doc.md.
//
//   node profile.mjs [--mode time|profile|render] [--sizes 200,1000,3000]
//                    [--reps 5] [--url http://localhost:8201/] [--out results.json]
//
// The dev server must already be running (see webpack.profile.config.js).
//  time    wall-clock only: no profiler attached (the numbers to quote)
//  profile CDP CPU profile + trace per operation, bucketed (where the time goes)
//  render  a stub React DevTools hook counts component renders per operation
import { chromium } from "@playwright/test";
import { createRequire } from "module";
import fs from "fs";

const gen = createRequire(import.meta.url)("./gen.js");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const MODE = args.mode ?? "time";
const SIZES = (args.sizes ?? "200,1000,3000").split(",").map(Number);
const REPS = Number(args.reps ?? 5);
const URL = args.url ?? "http://localhost:8201/";
const OUT = args.out ?? `results-${MODE}.json`;
const MOD = "ControlOrMeta";
const QUIET = 400; // ms without DOM mutations = the operation has settled

// ---- React render counting (render mode) ------------------------------------
const hookScript = () => {
  const counts = { commits: 0, renders: 0, mounts: 0, byName: {} };
  window.__renders = counts;
  const FN_TAGS = new Set([0, 1, 11, 14, 15]);
  const nameOf = (f) => {
    const t = f.type;
    return (
      (t && (t.displayName || t.name || (t.type && (t.type.displayName || t.type.name)))) ||
      `tag${f.tag}`
    );
  };
  const count = (f, mounted) => {
    if (FN_TAGS.has(f.tag) && (mounted || (f.flags & 1) === 1)) {
      counts.renders++;
      if (mounted) counts.mounts++;
      const n = nameOf(f);
      counts.byName[n] = (counts.byName[n] ?? 0) + 1;
    }
  };
  const mountWalk = (f) => {
    for (; f; f = f.sibling) {
      count(f, true);
      mountWalk(f.child);
    }
  };
  const update = (next, prev) => {
    count(next, false);
    if (next.child === prev.child) return; // bailed out
    for (let c = next.child; c; c = c.sibling) {
      if (c.alternate) update(c, c.alternate);
      else {
        count(c, true);
        mountWalk(c.child);
      }
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(r) {
      this.renderers.set(1, r);
      return 1;
    },
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      counts.commits++;
      const cur = root.current;
      if (cur.alternate) update(cur, cur.alternate);
      else {
        count(cur, true);
        mountWalk(cur.child);
      }
    },
  };
};

// ---- CPU profile bucketing ---------------------------------------------------
const chunkOf = (url) =>
  url.includes("v-react") ? "react"
  : url.includes("v-redux") ? "redux"
  : url.includes("v-codemirror") ? "codemirror"
  : url.includes("v-other") ? "vendor-other"
  : url.includes("main.js") || url.includes("runtime.js") ? "ours"
  : "";

const PARSE = /parse|patchAst|speculate|sexp|lexer|tokenize|fakeAst/i;
const REDUXFN = /useSelector|useSyncExternalStore|selector|dispatch|subscribe|getSnapshot/i;

/** Self time (ms) per bucket, plus inclusive time of some named functions. */
function bucketProfile(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  profile.samples.forEach((id, i) =>
    self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000)
  );
  const buckets = {};
  const inclusive = {};
  const add = (b, ms) => (buckets[b] = (buckets[b] ?? 0) + ms);
  for (const [id, ms] of self) {
    const n = nodes.get(id);
    const leaf = n.callFrame;
    const stack = [];
    for (let p = id; p !== undefined; p = parent.get(p)) stack.push(nodes.get(p).callFrame);
    const name = leaf.functionName;
    let b;
    if (name === "(idle)") b = "idle";
    else if (name === "(program)") b = "program";
    else if (name === "(garbage collector)") b = "gc";
    else if (stack.some((f) => chunkOf(f.url) !== "react" && chunkOf(f.url) !== "codemirror" && PARSE.test(f.functionName))) b = "parse+patchAst";
    else if (chunkOf(leaf.url) === "codemirror") b = "codemirror";
    else if (chunkOf(leaf.url) === "redux" || stack.some((f) => chunkOf(f.url) !== "react" && REDUXFN.test(f.functionName) && chunkOf(f.url) !== "codemirror")) b = "redux";
    else if (chunkOf(leaf.url) === "react") b = "react";
    else if (chunkOf(leaf.url) === "ours") b = "ours-other";
    else if (leaf.url === "") b = "native-dom";
    else b = "vendor-other";
    add(b, ms);
    const seen = new Set();
    for (const f of stack) {
      const key = `${chunkOf(f.url) || "native"}:${f.functionName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inclusive[key] = (inclusive[key] ?? 0) + ms;
    }
  }
  const keep = [
    "react:commitRoot", "react:performWorkOnRoot", "react:flushSyncWorkAcrossRoots_impl",
    "react:commitMutationEffects", "react:commitLayoutEffects", "react:commitPassiveMountEffects",
    "react:renderRootSync", "react:renderRootConcurrent", "react:flushPassiveEffects",
  ];
  const incl = {};
  if (process.env.INCL_TOP) {
    // (all of the top N by inclusive time, to look for what to optimise)
    for (const [k, v] of Object.entries(inclusive).sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.INCL_TOP))) incl[k] = +v.toFixed(1);
    for (const k of Object.keys(buckets)) buckets[k] = +buckets[k].toFixed(1);
    return { buckets, incl };
  }
  for (const [k, v] of Object.entries(inclusive)) {
    if (keep.includes(k) || /patchAst|replaceMarkerWidget|markText|^codemirror:(clear|refresh|updateDisplay|setValue|replaceRange|makeChange)|:parse$|speculateChanges|commitChanges|performEdits|reactElement/i.test(k))
      incl[k] = +v.toFixed(1);
  }
  for (const k of Object.keys(buckets)) buckets[k] = +buckets[k].toFixed(1);
  return { buckets, incl };
}

function bucketTrace(events) {
  const sums = {};
  for (const e of events) {
    if (e.ph !== "X" || e.dur === undefined) continue;
    if (/^(UpdateLayoutTree|Layout|Paint|PrePaint|Layerize|Commit|HitTest|IntersectionObserverController::computeIntersections|ParseHTML|RunTask)$/.test(e.name))
      sums[e.name] = (sums[e.name] ?? 0) + e.dur / 1000;
  }
  for (const k of Object.keys(sums)) sums[k] = +sums[k].toFixed(1);
  return sums;
}

// ---- driving the page ----------------------------------------------------------
async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (MODE === "render") await page.addInitScript(hookScript);
  await page.goto(URL);
  await page.waitForFunction(() => !!window.cmb, { timeout: 30_000 });
  await page.evaluate(() => {
    window.__q = { last: 0, first: 0 };
    // The DOM is quiet when nothing in the document changes and no long task
    // runs. (React renders each top-level block into a container that is not
    // in the document, so mutations alone miss most of the work.)
    const bump = (t) => {
      window.__q.last = Math.max(window.__q.last, t);
      if (!window.__q.first) window.__q.first = t;
    };
    new MutationObserver(() => bump(performance.now())).observe(document, {
      subtree: true, childList: true, attributes: true, characterData: true,
    });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) bump(e.startTime + e.duration);
    }).observe({ type: "longtask" });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  return { page, cdp, errors, ctx };
}

const settle = (page, max = 120_000) =>
  page.evaluate(
    ({ quiet, max }) =>
      new Promise((res) => {
        const s = performance.now();
        const iv = setInterval(() => {
          const n = performance.now();
          if (n - Math.max(window.__q.last, s) > quiet || n - s > max) {
            clearInterval(iv);
            res([window.__q.first, window.__q.last]);
          }
        }, 25);
      }),
    { quiet: QUIET, max }
  );

/** Run `action`, wait for the DOM to go quiet, and report what it cost. */
async function measure(env, name, action) {
  const { page, cdp } = env;
  const prof = MODE === "profile";
  if (MODE === "render") await page.evaluate(() => { const r = window.__renders; r.commits = r.renders = r.mounts = 0; r.byName = {}; });
  const traceEvents = [];
  let traceDone;
  if (prof) {
    cdp.removeAllListeners("Tracing.dataCollected");
    cdp.on("Tracing.dataCollected", (d) => traceEvents.push(...d.value));
    traceDone = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
    await cdp.send("Tracing.start", { categories: "devtools.timeline", transferMode: "ReportEvents" });
    await cdp.send("Profiler.start");
  }
  const t0 = await page.evaluate(() => (window.__q.last = 0, window.__q.first = 0, performance.now()));
  const wallStart = Date.now();
  await action();
  const actionMs = Date.now() - wallStart;
  const [first, last] = await settle(page);
  let result = { op: name, wall: last > t0 ? +(last - t0).toFixed(1) : actionMs, first: first > t0 ? +(first - t0).toFixed(1) : null, actionMs };
  if (prof) {
    const { profile } = await cdp.send("Profiler.stop");
    await cdp.send("Tracing.end");
    await traceDone;
    result = { ...result, ...bucketProfile(profile), browser: bucketTrace(traceEvents) };
  }
  if (MODE === "render") result.react = await page.evaluate(() => JSON.parse(JSON.stringify(window.__renders)));
  return result;
}

const press = (page, k, n = 1) => (async () => { for (let i = 0; i < n; i++) await page.keyboard.press(k); });

async function runOnce(browser, lines) {
  const env = await openPage(browser);
  const { page, errors } = env;
  const text = gen(lines);
  const out = [];
  const m = async (name, fn) => out.push(await measure(env, name, fn));
  const blocksBtn = page.getByRole("button", { name: /switch to blocks mode/i });
  const textBtn = page.getByRole("button", { name: /switch to text mode/i });

  if (MODE === "profile") await m("0. idle baseline", () => page.waitForTimeout(1000));
  // (a) cold: set the text and switch to block mode
  await m("a. load + first blocks render", async () => {
    await page.evaluate((c) => { window.cmb.setValue(c); window.cmb.clearHistory(); }, text);
    await blocksBtn.click();
  });
  out[out.length - 1].nodes = await page.evaluate(() => window.cmb.getAst().rootNodes.length);
  // (b) warm: back to text (not measured), then to blocks again
  await textBtn.click();
  await settle(page);
  await m("b. text -> blocks (warm)", () => blocksBtn.click());

  const scrollToLine = (frac) =>
    page.evaluate((f) => {
      const cm = window.cmb.getCM();
      const line = Math.floor(cm.lastLine() * f);
      try {
        cm.scrollTo(null, cm.heightAtLine(line, "local"));
      } catch {
        // CodeMirror's selection sync can throw right after a commit; the scroll still happened
      }
      return line;
    }, frac);

  // (c) edit a literal in the middle through the edit box, then commit
  await scrollToLine(0.5);
  await settle(page);
  const lit = page.getByRole("treeitem", { name: /^\d+,?$/ }).nth(2);
  await lit.click();
  await page.keyboard.press("Enter");
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type("12345");
  const before = await page.evaluate(() => window.cmb.getValue().length);
  await m("c. edit literal mid-doc (commit)", press(page, "Enter"));
  const after = await page.evaluate(() => window.cmb.getValue());
  if (!after.includes("12345")) errors.push("edit did not apply");

  // (d) insert near the top, then delete it again
  await scrollToLine(0);
  await settle(page);
  await page.getByRole("treeitem").first().click();
  await page.keyboard.press("Shift+,"); // jump to the root: the first define
  await page.evaluate(() => navigator.clipboard.writeText("(+ 1 2)"));
  const preIns = await page.evaluate(() => window.cmb.getValue().length);
  await m("d. insert node at top (paste)", press(page, `${MOD}+v`));
  const withIns = await page.evaluate(() => window.cmb.getValue().length);
  if (!(withIns > preIns)) errors.push("insert did not apply");
  await page.keyboard.press("Space");
  await m("d. delete that node", press(page, "Delete"));
  const afterDel = await page.evaluate(() => window.cmb.getValue().length);
  if (!(withIns > afterDel)) errors.push("delete did not apply");

  // (e) undo and redo the delete
  await m("e. undo", press(page, `${MOD}+z`));
  await m("e. redo", press(page, `${MOD}+Shift+z`));

  // (f) keyboard navigation and collapse/expand
  await page.getByRole("treeitem").first().click();
  const focusLabel = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  const label0 = await focusLabel();
  await m("f. arrow down x50", press(page, "ArrowDown", 50));
  if ((await focusLabel()) === label0) errors.push("arrow down did not move focus");
  await m("f. collapse all", press(page, "Shift+ArrowLeft"));
  const nCollapsed = () => page.evaluate(() => document.querySelectorAll('[aria-expanded="false"]').length);
  const collapsedAfter = await nCollapsed();
  // (collapsing while a deep block has focus leaves focus on <body>: refocus a root)
  await page.getByRole("treeitem").first().click();
  await m("f. expand all", press(page, "Shift+ArrowRight"));
  if (collapsedAfter === 0 || (await nCollapsed()) !== 0) errors.push(`collapse/expand: ${collapsedAfter} collapsed, then ${await nCollapsed()}`);

  // (g) typing in text mode
  await textBtn.click();
  await settle(page);
  await page.evaluate(() => {
    const cm = window.cmb.getCM();
    cm.setCursor({ line: Math.floor(cm.lastLine() / 2), ch: 0 });
    cm.focus();
    window.__lat = [];
    document.addEventListener("keydown", () => {
      const t = performance.now();
      requestAnimationFrame(() => setTimeout(() => window.__lat.push(performance.now() - t), 0));
    }, true);
  });
  await m("g. type 30 chars (text mode)", async () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz1234") await page.keyboard.type(ch, { delay: 30 });
  });
  const lat = await page.evaluate(() => window.__lat);
  out[out.length - 1].keyLatencyMedian = +lat.sort((a, b) => a - b)[Math.floor(lat.length / 2)].toFixed(1);
  out[out.length - 1].keyLatencyMax = +lat[lat.length - 1].toFixed(1);

  await env.ctx.close();
  if (errors.length) console.error("  page errors:", [...new Set(errors)].slice(0, 3));
  return out;
}

const browser = await chromium.launch();
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
for (const size of SIZES) {
  for (let r = 0; r < REPS; r++) {
    const t = Date.now();
    const ops = await runOnce(browser, size);
    results.push({ size, rep: r, mode: MODE, ops });
    fs.writeFileSync(OUT, JSON.stringify(results));
    console.log(`${MODE} size=${size} rep=${r} ${((Date.now() - t) / 1000).toFixed(0)}s: ` + ops.map((o) => `${o.op.split(" ")[0]}${o.first}/${o.wall}`).join(" "));
  }
}
await browser.close();

// usage: node spike/measure.mjs [plain|block]   (port 8124; page = example, wescheme)
import { chromium } from "@playwright/test";
import fs from "fs";
import { programs } from "./programs.mjs";
const MODE = process.argv[2] || "plain"; // plain | block
const out = process.argv[3] || "/private/tmp/claude-503/spike";
fs.mkdirSync(out, { recursive: true });
const plainCss = fs.existsSync("spike/plain.css") ? fs.readFileSync("spike/plain.css","utf8") : "";

// run in page: characters (non-whitespace and whitespace) with rects -> rows
const grab = () => {
  const root = document.querySelector(".CodeMirror-code");
  const chars = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.parentElement.closest(".screenreader-only,.CodeMirror-gutter-wrapper,.CodeMirror-linenumber,[aria-hidden=true]")) continue;
    for (let i = 0; i < n.data.length; i++) {
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
      const rc = r.getClientRects()[0]; if (!rc || rc.width === 0 && n.data[i] !== " ") continue;
      chars.push({ c: n.data[i], x: rc.left, y: Math.round(rc.top), w: rc.width, h: rc.height });
    }
  }
  const base = root.getBoundingClientRect();
  const rows = [];
  for (const ch of chars) {
    let row = rows.find(r => Math.abs(r.y - ch.y) < 4);
    if (!row) rows.push(row = { y: ch.y, chars: [] });
    row.chars.push(ch);
  }
  rows.sort((a, b) => a.y - b.y);
  const cw = (() => { const s = document.createElement("span"); s.textContent = "0000000000"; s.style.cssText="position:absolute;visibility:hidden;white-space:pre"; document.querySelector(".CodeMirror").appendChild(s); const wd = s.getBoundingClientRect().width/10; s.remove(); return wd; })();
  return { cw, left: base.left, top: base.top,
    rows: rows.map(r => { r.chars.sort((a,b)=>a.x-b.x); return { y: r.y - base.top, text: r.chars.map(c=>c.c).join(""), x0: r.chars[0].x - base.left,
      // column of each char in character-cell units from row start of the code area
      cols: r.chars.map(c => Math.round((c.x - base.left) / 1) ) }; }) };
};

const b = await chromium.launch(); 
const res = {};
for (const [name, code] of Object.entries(programs)) {
  const page = await b.newPage({ viewport: { width: 900, height: 800 } });
  if (MODE === "plain") await page.addInitScript(() => { window.__cmbPlain = true; });
  await page.goto("http://localhost:8124/");
  await page.waitForFunction(() => !!window.cmb);
  await page.evaluate(c => { window.cmb.setValue(c); window.cmb.clearHistory(); }, code);
  await page.evaluate(() => { for (const e of document.querySelectorAll(".page-header,#debuggingLog,input")) e.style.display="none"; });
  const text = await page.evaluate(grab);
  await page.locator(".CodeMirror").screenshot({ path: `${out}/${name}-text.png` });
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.getByRole("treeitem").first().waitFor();
  if (MODE === "plain") {
    await page.addStyleTag({ content: plainCss });
    await page.evaluate(() => document.querySelector(".CodeMirror").classList.add("cmb-plain"));
    await page.waitForTimeout(1800); // fadein
  }
  await page.waitForTimeout(1800);
  const blk = await page.evaluate(grab);
  await page.locator(".CodeMirror").screenshot({ path: `${out}/${name}-${MODE}.png` });
  const doc = await page.evaluate(() => window.cmb.getValue());
  res[name] = { text, blk, doc };
  await page.close();
}
await b.close();
fs.writeFileSync(`${out}/result-${MODE}.json`, JSON.stringify(res));
// report
const lcs = (a, b) => { const m = Array.from({length:a.length+1},()=>new Uint16Array(b.length+1)); for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) m[i][j]= a[i-1]===b[j-1]? m[i-1][j-1]+1 : Math.max(m[i-1][j],m[i][j-1]); return m[a.length][b.length]; };
for (const [name, { text, blk, doc }] of Object.entries(res)) {
  const t = text.rows.map(r => r.text), k = blk.rows.map(r => r.text);
  const ts = t.join("").replace(/\s/g, ""), ks = k.join("").replace(/\s/g, "");
  const l = lcs(ts, ks);
  console.log(`\n== ${name} [${MODE}] charWidth ${text.cw.toFixed(2)}`);
  console.log(`rows: text ${t.length}, blocks ${k.length}; nonspace chars text ${ts.length}, blocks ${ks.length}, common ${l} (added ${ks.length - l}, missing ${ts.length - l})`);
  const n = Math.max(t.length, k.length), lh = text.rows.length>1 ? text.rows[1].y-text.rows[0].y : 0;
  for (let i = 0; i < n; i++) {
    const a = text.rows[i], c = blk.rows[i];
    console.log(`${i}: T[${a ? (a.x0/text.cw).toFixed(1)+"|"+JSON.stringify(a.text) : "-"}]  B[${c ? (c.x0/text.cw).toFixed(1)+"@y"+Math.round(c.y)+"|"+JSON.stringify(c.text) : "-"}]`);
  }
  const dl = doc.split("\n").filter(l=>l.trim()), same = k.filter((r,i)=>r===dl[i]).length;
  const lhb = blk.rows.length>1 ? blk.rows[1].y-blk.rows[0].y : 0;
  console.log(`vs block-mode document text: ${dl.length} non-blank lines, ${k.length} rendered rows, ${same} identical rows (text+indent); line pitch text ${text.rows[1]?.y-text.rows[0].y} blocks ${lhb}`);
  console.log(`total height text ${Math.round(text.rows.at(-1).y - text.rows[0].y)} blocks ${Math.round(blk.rows.at(-1).y - blk.rows[0].y)}`);
}

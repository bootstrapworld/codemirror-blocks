import { chromium } from "@playwright/test";
import fs from "fs";
const css = fs.readFileSync("spike/plain.css","utf8");
const code = `(define (f x)
  (let ((y (+ x 1)))
    (* y 2)))
(f 2)`;
const b = await chromium.launch(); const page = await b.newPage({viewport:{width:900,height:700}});
if (process.env.PLAIN!=="0") await page.addInitScript(()=>{window.__cmbPlain=true});
await page.goto("http://localhost:8124/"); await page.waitForFunction(()=>!!window.cmb);
await page.evaluate(c=>{cmb.setValue(c);cmb.clearHistory()},code);
for (const e of await page.$$(".page-header,#debuggingLog,input")) await e.evaluate(x=>x.style.display="none");
await page.getByRole("button",{name:/switch to blocks mode/i}).click();
await page.getByRole("treeitem").first().waitFor();
if (process.env.PLAIN!=="0") { await page.addStyleTag({content:css}); await page.evaluate(()=>document.querySelector(".CodeMirror").classList.add("cmb-plain")); }
await page.waitForTimeout(3000);
const state = () => page.evaluate(()=>{const a=document.activeElement; const cm=cmb.getCM(); return {active:a.tagName+"#"+a.id+" "+(a.getAttribute("aria-label")||a.className).slice(0,40), cursor:cm.getCursor(), sel:cm.getSelection(), doc:cmb.getValue().replace(/\n/g,"⏎")}});
const rectOf = (loc)=>loc.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,font:getComputedStyle(e).font.slice(0,50)}});
// 1 click between chars: inside the word "define" (x between 'd' and 'e')
console.log((await page.$$eval("[aria-label]",e=>e.map(x=>x.getAttribute("aria-label")))).join(" / "));
const sym = page.getByRole("treeitem").first();
const r0 = await rectOf(sym); console.log("operator rect", r0);
await page.mouse.click(r0.x+8.4*3.5, r0.y+8); await page.waitForTimeout(200); console.log("1 click inside 'define' ->", await state());
// click in blank space after line 2 end, and in the leading indentation of line 3
const line3 = page.locator(".CodeMirror-line").nth(0);
const lr = await rectOf(line3); console.log("toplevel line rect", lr);
await page.mouse.click(lr.x+lr.w/2, lr.y+120); await page.waitForTimeout(200); console.log("2 click in empty area right of line ->", await state());
// 3 arrow keys across nodes
await page.locator("[aria-label^=\"f: function definition\"]").focus();
const seq=[]; for (const k of ["ArrowDown","ArrowRight","ArrowRight","ArrowDown","ArrowUp","ArrowLeft"]) { await page.keyboard.press(k); await page.waitForTimeout(80); seq.push(k+" -> "+(await page.evaluate(()=>document.activeElement.getAttribute("aria-label")))); }
console.log("3 arrows from define:\n  "+seq.join("\n  "));
// 4 Enter on a literal: edit box vs node geometry
const n = page.locator("[aria-label=\"2,\"]").nth(0); await n.focus();
await page.keyboard.press("Escape"); const before = await rectOf(n); if (process.env.PLAIN==="0") { await n.dblclick(); await page.waitForTimeout(400); console.log("  dblclick box:", JSON.stringify(await page.evaluate(()=>[document.activeElement.className.slice(0,40), document.activeElement.textContent])), JSON.stringify(await rectOf(page.locator("[contenteditable=true]").first()))); await page.keyboard.press("Escape"); } await n.focus(); await page.keyboard.press("ControlOrMeta+Enter"); await page.waitForTimeout(300);
console.log("  active after Enter:", await page.evaluate(()=>{const a=document.activeElement;return a.tagName+" ce="+a.getAttribute("contenteditable")+" html="+a.outerHTML.slice(0,300)})); const box = page.locator("[contenteditable=true]").first(); const after = await rectOf(box).catch(e=>null);
console.log("4 node before Enter", before, "\n  edit box", after);
const line2before = await page.evaluate(()=>0);
await page.screenshot({path:"/private/tmp/claude-503/spike/editing.png",clip:{x:0,y:0,width:700,height:260}});
// 5 type at the edge: while editing, End then type '2', Enter
console.log("  box text before typing:", JSON.stringify(await page.evaluate(()=>document.activeElement.textContent))); await page.keyboard.press("End"); await page.keyboard.type("7"); console.log("5 after typing 7 in box, doc:", (await state()).doc);
await page.keyboard.press("Enter"); await page.waitForTimeout(300); console.log("  after Enter commit:", await state());
// 6 type a char directly on a focused node (no Enter)
await page.locator("[aria-label^=\"multiply expression\"]").first().focus(); await page.keyboard.type("x"); await page.waitForTimeout(300); console.log("6 type 'x' on focused node ->", await state(), "editing box?", await page.locator("[contenteditable=true]").count());
await page.keyboard.press("Escape");
// 7 newline inside a node edit: Shift+Enter / Enter semantic; try typing text containing newline
await b.close();

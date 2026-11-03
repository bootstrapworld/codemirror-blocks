import { chromium } from "@playwright/test";
const code = `; a comment
(define (f x)
  (let ([y (+ x 1)]
        [z "hi there"])
    (cond
      [(> y 3) y]
      [else   z])))

(f   2)`;
const b = await chromium.launch(); const page = await b.newPage({viewport:{width:900,height:700}});
await page.goto("http://localhost:8124/");
await page.waitForFunction(()=>!!window.cmb);
await page.evaluate(c=>{window.cmb.setValue(c);window.cmb.clearHistory()},code);
await page.getByRole("button",{name:/switch to blocks mode/i}).click();
await page.getByRole("treeitem").first().waitFor();
console.log(await page.evaluate(()=>document.querySelector(".CodeMirror-code").innerHTML.slice(0,3500)));
await b.close();

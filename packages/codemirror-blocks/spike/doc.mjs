import { chromium } from "@playwright/test";
import { programs } from "./programs.mjs";
const b = await chromium.launch(); 
for (const [n,c] of Object.entries(programs)) { const page = await b.newPage();
await page.goto("http://localhost:8124/"); await page.waitForFunction(()=>!!window.cmb);
await page.evaluate(c=>window.cmb.setValue(c),c);
await page.getByRole("button",{name:/switch to blocks mode/i}).click(); await page.waitForTimeout(1500);
console.log("==",n); console.log(await page.evaluate(()=>window.cmb.getValue())); await page.close();}
await b.close();

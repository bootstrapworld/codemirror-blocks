import { chromium } from "@playwright/test";
const b = await chromium.launch(); const page = await b.newPage();
page.on("pageerror", e=>console.log("PAGEERR", e.message.slice(0,300)));
page.on("console", m=>{ if(m.type()==="error") console.log("CONSOLE", m.text().slice(0,300))});
await page.goto("http://localhost:8124/"); await page.waitForFunction(()=>!!window.cmb);
await page.evaluate(()=>window.cmb.setValue("(f 2)"));
await page.getByRole("button",{name:/switch to blocks mode/i}).click(); await page.waitForTimeout(2000);
await b.close();

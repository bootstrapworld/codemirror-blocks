import { chromium } from "@playwright/test"; import fs from "fs";
const dir="/private/tmp/claude-503/spike", out=process.argv[2];
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:300}});
for (const n of ["define_let_cond","multiline_call"]) {
 const im=f=>"data:image/png;base64,"+fs.readFileSync(`${dir}/${n}-${f}.png`).toString("base64");
 await p.setContent(`<body style="margin:8px;font:12px sans-serif"><div style="display:flex;gap:12px"><div>text mode<br><img src="${im("text")}" style="width:460px"></div><div>block mode (default)<br><img src="${im("block")}" style="width:460px"></div><div>plain<br><img src="${im("plain")}" style="width:460px"></div></div>`);
 await p.waitForTimeout(200);
 await p.screenshot({path:`${out}/${n}.png`,fullPage:true});
}
await b.close();

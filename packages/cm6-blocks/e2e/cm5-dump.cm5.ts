import { test } from "@playwright/test";
import * as fs from "fs";
import { SAMPLE } from "./scheme-sample";
test("cm5 dump", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).cmb);
  await page.evaluate((c: string) => {
    (window as any).cmb.setValue(c);
  }, SAMPLE);
  await page.getByRole("button", { name: /switch to blocks mode/i }).click();
  await page.getByRole("treeitem").first().waitFor();
  await page.waitForTimeout(500);
  const html = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        ".CodeMirror-code .blocks-node.blocks-root, .CodeMirror-code > div"
      )
    )
      .map((e) => e.outerHTML)
      .join("\n\n")
  );
  fs.writeFileSync("/private/tmp/claude-503/cm5-dom.html", html);
  const sels = [
    ".blocks-variableDefinition",
    ".blocks-functionDefinition",
    ".blocks-variableDefinition > .blocks-operator",
    ".blocks-variableDefinition > .blocks-args",
    ".blocks-functionApp",
    ".blocks-functionApp > .blocks-operator",
    ".blocks-functionApp > .blocks-args",
    ".blocks-functionApp > .blocks-args > .blocks-literal",
    ".blocks-functionApp > .blocks-operator > .blocks-literal",
    ".blocks-literal-symbol",
    ".blocks-literal-number",
    ".blocks-literal-string",
    ".blocks-literal-boolean",
    ".blocks-literal-char",
    ".blocks-white-space",
    ".blocks-identifierList",
    ".blocks-identifierList > .blocks-args",
    ".blocks-conditional",
    ".blocks-conditional > .blocks-operator",
    ".blocks-cond-table",
    ".blocks-conditionalBranch",
    ".blocks-cond-row",
    ".blocks-cond-predicate",
    ".blocks-cond-result",
    ".blocks-cond-else",
    ".blocks-lambdaExpression",
    ".blocks-lambdaExpression > .blocks-operator",
    ".blocks-ifExpression",
    ".blocks-ifExpression > .blocks-cond-table",
    ".blocks-ifExpression .blocks-cond-row",
    ".blocks-ifExpression .blocks-cond-predicate",
    ".blocks-ifExpression .blocks-cond-result",
    ".blocks-comment-badge",
    ".blocks-comment-wrap",
    ".CodeMirror",
    ".CodeMirror-line",
    ".CodeMirror-widget",
    ".react-container",
  ];
  const props = [
    "display",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "color",
    "backgroundColor",
    "backgroundImage",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
    "borderRadius",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "width",
    "height",
    "minWidth",
    "justifyContent",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "transform",
    "boxShadow",
    "verticalAlign",
    "textAlign",
    "float",
    "whiteSpace",
    "cursor",
  ];
  const res = await page.evaluate(
    ({ sels, props }) =>
      sels.map((s: string) => {
        const e = document.querySelector(s);
        if (!e) return s + " : MISSING";
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return (
          s +
          " :: " +
          Math.round(r.width * 10) / 10 +
          "x" +
          Math.round(r.height * 10) / 10 +
          " :: " +
          props.map((p: string) => p + "=" + (cs as any)[p]).join("; ")
        );
      }),
    { sels, props }
  );
  fs.writeFileSync("/private/tmp/claude-503/cm5-styles.txt", res.join("\n\n"));
});

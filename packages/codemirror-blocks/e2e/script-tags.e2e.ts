import { execFileSync } from "child_process";
import * as path from "path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * The editor and each language are files of their own, for a page that has no
 * bundler: `<script src="codemirror-blocks-min.js">` has the editor and no
 * language, and a language's file, loaded after it, adds that language to it.
 * (The files are built here, by `npm run bundle` in each package.)
 */
const root = path.resolve(__dirname, "..", "..", "..");
const page_ = path.resolve(__dirname, "fixtures", "script-tag.html");

// (one worker builds the files, once: building one empties the folder it goes in)
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(180_000);
  for (const w of [
    "@bootstrapworld/codemirror-blocks",
    "@bootstrapworld/wescheme",
    "@bootstrapworld/lambda",
  ]) {
    execFileSync("npm", ["run", "bundle", `--workspace=${w}`], {
      cwd: root,
      stdio: "ignore",
    });
  }
  // (the editor on Preact, in dist/lite: not cleaned by the build above)
  execFileSync(
    "npm",
    ["run", "bundle:lite", "--workspace=@bootstrapworld/codemirror-blocks"],
    { cwd: root, stdio: "ignore" }
  );
});

const open = async (page: Page, languages: string[], core = "full") => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(
    `file://${page_}?languages=${languages.join(",")}&core=${core}`
  );
  return errors;
};

type Cmb = {
  (el: HTMLElement, options: object, language: string): unknown;
  Languages: { LANGUAGES: Record<string, unknown> };
  defineNode: unknown;
};
// (what the page has: used inside `page.evaluate`, which runs in the browser)
declare global {
  interface Window {
    CodeMirrorBlocks: Cmb;
  }
}

// (the editor's file on React, and on Preact: `npm run bundle:lite`)
for (const core of ["full", "lite"]) {
  test(`the editor's file has the editor and no language (${core})`, async ({
    page,
  }) => {
    const errors = await open(page, [], core);
    const state = await page.evaluate(() => {
      const cmb = (window as unknown as { CodeMirrorBlocks: Cmb })
        .CodeMirrorBlocks;
      let message = "";
      try {
        cmb(document.getElementById("editor")!, {}, "wescheme");
      } catch (e) {
        message = String(e);
      }
      return {
        isAFunction: typeof cmb,
        hasTheApi: typeof cmb.defineNode,
        languages: Object.keys(cmb.Languages.LANGUAGES),
        message,
      };
    });
    expect(errors).toEqual([]);
    expect(state.isAFunction).toBe("function");
    expect(state.hasTheApi).toBe("function");
    expect(state.languages).toEqual([]);
    // (and asking for one says what to do)
    expect(state.message).toMatch(
      /There is no language "wescheme".*loading its module/
    );
  });

  test(`a language's file adds the language, to be asked for by its id (${core})`, async ({
    page,
  }) => {
    const errors = await open(page, ["wescheme"], core);
    expect(
      await page.evaluate(() =>
        Object.keys(window.CodeMirrorBlocks.Languages.LANGUAGES)
      )
    ).toEqual(["wescheme"]);
    await page.evaluate(() => {
      window.CodeMirrorBlocks(
        document.getElementById("editor")!,
        { value: "(+ 1 (* 2 3))" },
        "wescheme"
      );
    });
    await page.locator(".blocks-toggle-btn").click();
    // (blocks, drawn and styled by the files: the frame is the language's style)
    const block = page.locator(".CodeMirror-code .blocks-functionApp").first();
    await expect(block).toBeVisible();
    expect(
      await block.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
    ).not.toBe("0px");
    expect(errors).toEqual([]);
  });

  test(`more than one language can be loaded, each with its own id (${core})`, async ({
    page,
  }) => {
    const errors = await open(page, ["wescheme", "lambda"], core);
    expect(
      await page.evaluate(() =>
        Object.keys(window.CodeMirrorBlocks.Languages.LANGUAGES).sort()
      )
    ).toEqual(["lambda", "wescheme"]);
    await page.evaluate(() => {
      window.CodeMirrorBlocks(
        document.getElementById("editor")!,
        { value: "x = 1 + 2;" },
        "lambda"
      );
    });
    await page.locator(".blocks-toggle-btn").click();
    await expect(
      page.locator(".CodeMirror-code .blocks-compound").first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

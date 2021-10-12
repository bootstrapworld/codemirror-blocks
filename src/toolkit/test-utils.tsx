import CodeMirrorBlocks, {
  API,
  CodeMirrorBlocksReact,
  Language,
} from "../CodeMirrorBlocks";
import { cleanup, render } from "@testing-library/react";
import { afterAllDOMUpdates, cancelAllDOMUpdates } from "../utils";
import type { ASTNode } from "../ast";
import React from "react";
// pass along all the simulated events
export * from "./simulate";

// figure out what platform we're running on
const userAgent = navigator.userAgent;
const platform = navigator.platform;
const edge = /Edge\/(\d+)/.exec(userAgent);
const ios =
  !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);

// pass along useful constants
export const mac = ios || /Mac/.test(platform);
export const cmd_ctrl = mac ? { metaKey: true } : { ctrlKey: true };

// wait a given number of milliseconds
export async function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// wait for the editor to finish rendering and for any
// other async DOM tasks to finish
export function finishRender() {
  return afterAllDOMUpdates();
}

export function teardown() {
  cancelAllDOMUpdates();
  cleanup();
  const rootNode = document.getElementById("root");
  if (rootNode) {
    document.body.removeChild(rootNode);
  } else {
    console.error(
      "cleanupAfterTest() failed to find `root`.",
      " Did your test case use `activationSetup`?"
    );
  }
  const textareas = document.getElementsByTagName("textarea");
  while (textareas[0]) {
    const current = textareas[0];
    current.parentNode!.removeChild(current);
  }
}

const fixture = `
  <div id="root">
    <div id="cmb-editor" class="editor-container"/>
  </div>
`;

export type TestContext = {
  cmb: API;
  activeNode: () => ASTNode | undefined;
  activeAriaId: () => string | null;
  selectedNodes: () => ASTNode[];
};

/**
 * Helper function for tests which constructs and mounts an instance of codemirror blocks
 * into a DOM tree with block mode enabled and some other helpful default settings.
 *
 * @param language the language spec to use
 */
export async function mountCMB(language: Language): Promise<API> {
  document.body.insertAdjacentHTML("afterbegin", fixture);
  const container = document.getElementById("cmb-editor")!;
  const codemirrorOptions = { historyEventDelay: 50 }; // since our test harness is faster than people

  const cmb: API = {} as any;
  render(
    <CodeMirrorBlocksReact
      language={language}
      api={cmb}
      options={{ collapseAll: false, value: "", incrementalRendering: false }}
      codemirrorOptions={codemirrorOptions}
    />,
    { container }
  );
  await finishRender();
  cmb.setBlockMode(true);
  await finishRender();
  return cmb;
}

/**
 * Setup, be sure to use with `apply` (`activationSetup.apply(this, [pyret])`)
 * or `call` (`await activationSetup.call(this, pyret)`)
 * so that `this` is scoped correctly!
 *
 * @deprecated use mountCMB() instead
 */
export async function activationSetup(
  this: TestContext,
  language: Language
): Promise<void> {
  const cmb = await mountCMB(language);
  this.cmb = cmb;
  this.activeNode = () => this.cmb.getFocusedNode();
  this.activeAriaId = () =>
    this.cmb.getScrollerElement().getAttribute("aria-activedescendent");
  this.selectedNodes = () => this.cmb.getSelectedNodes();
}

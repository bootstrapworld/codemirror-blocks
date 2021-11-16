import {
  API,
  ASTNode,
  CodeMirrorBlocksComponent,
  Language,
} from "../CodeMirrorBlocks";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { createAppStore } from "../state/store";
// pass along all the simulated events
export * from "@bootstrapworld/cmb-toolkit/lib/simulate";

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

export function teardown() {
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
    current.parentNode?.removeChild(current);
  }
}

const fixture = `
  <div id="root">
    <div id="cmb-editor" class="editor-container"/>
  </div>
`;

/**
 * Helper function for tests which constructs and mounts an instance of codemirror blocks
 * into a DOM tree with block mode enabled and some other helpful default settings.
 *
 * @param language the language spec to use
 */
export function mountCMB(language: Language) {
  document.body.insertAdjacentHTML("afterbegin", fixture);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const container = document.getElementById("cmb-editor")!;
  const codemirrorOptions = { historyEventDelay: 50 }; // since our test harness is faster than people

  const cmb = {} as API;
  const store = createAppStore();
  render(
    <CodeMirrorBlocksComponent
      store={store}
      language={language}
      onMount={(newAPI) => {
        Object.assign(cmb, newAPI, {
          setBlockMode: (blockMode: boolean) =>
            act(() => newAPI.setBlockMode(blockMode)),
          setValue: (value: string) => {
            act(() => newAPI.setValue(value));
          },
        });
      }}
      options={{ collapseAll: false, value: "", incrementalRendering: false }}
      codemirrorOptions={codemirrorOptions}
    />,
    { container }
  );
  cmb.setBlockMode(true);
  return { cmb, store };
}

// TODO(pcardune): replace the element property on an ASTNode with this function
export const elementForNode = (node: ASTNode) =>
  document.getElementById(`block-node-${node.id}`);

export const isNodeEditable = (node: ASTNode) =>
  elementForNode(node)?.getAttribute("contenteditable") === "true";

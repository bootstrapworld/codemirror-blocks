import CodeMirrorBlocks, { API, Language } from '../CodeMirrorBlocks';
import { cleanup } from "@testing-library/react";
import { setAfterDOMUpdate, cancelAfterDOMUpdate } from '../utils';
import type { afterDOMUpdateHandle } from '../utils';
// pass along all the simulated events
export * from './simulate';

// figure out what platform we're running on
const userAgent = navigator.userAgent;
const platform = navigator.platform;
const edge = /Edge\/(\d+)/.exec(userAgent);
const ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);


// pass along useful constants
export const mac = ios || /Mac/.test(platform);
export const cmd_ctrl = mac? { metaKey: true } : { ctrlKey: true };

// wait a given number of milliseconds
export async function wait(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// wait for the editor to finish rendering, then pad another 100ms 
// NOTE(Emmanuel): 0ms causes all kinds of stuff to break
export async function finishRender(editor:API) {
  return new Promise<void>(resolve => setAfterDOMUpdate(resolve, 100));
}

export function removeEventListeners() {
  const oldElem = document.body;
  const newElem = oldElem.cloneNode(true);
  oldElem.parentNode.replaceChild(newElem, oldElem);
}

export function teardown() {
  cleanup();
  const rootNode = document.getElementById('root');
  if (rootNode) { document.body.removeChild(rootNode); } 
  else {
    console.log('cleanupAfterTest() failed to find `root`.',
      ' Did your test case use `activationSetup`?');
  }
  const textareas = document.getElementsByTagName("textarea");
  while (textareas[0]) {
    const current = textareas[0];
    current.parentNode.removeChild(current);
  }
}

const fixture = `
  <div id="root">
    <div id="cmb-editor" class="editor-container"/>
  </div>
`;
/**
 * Setup, be sure to use with `apply` (`activationSetup.apply(this, [pyret])`)
 * or `call` (`activationSetup.call(this, pyret)`)
 * so that `this` is scoped correctly!
 */
export async function activationSetup(language: Language) : Promise<void>{
  document.body.insertAdjacentHTML('afterbegin', fixture);
  const container = document.getElementById('cmb-editor');
  const cmOptions = {historyEventDelay: 50}; // since our test harness is faster than people
  this.cmb = CodeMirrorBlocks(
    container, 
    { collapseAll: false, value: "", incrementalRendering: false }, 
    language, 
    cmOptions
  );
  this.cmb.setBlockMode(true);
  this.activeNode = () => this.cmb.getFocusedNode();
  this.activeAriaId = () =>
    this.cmb.getScrollerElement().getAttribute('aria-activedescendent');
  this.selectedNodes = () => this.cmb.getSelectedNodes();
  await finishRender(this.cmb);
}
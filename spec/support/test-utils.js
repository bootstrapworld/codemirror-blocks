import CodeMirrorBlocks from '../../src/CodeMirrorBlocks';
import { store } from '../../src/store';

export async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function removeEventListeners() {
  const oldElem = document.body;
  const newElem = oldElem.cloneNode(true);
  oldElem.parentNode.replaceChild(newElem, oldElem);
}

export function cleanupAfterTest(rootId, store) {
  let rootNode = document.getElementById('root');
  if (rootNode) {
  document.body.removeChild(rootNode);
  } else {
    console.log('doing cleanupAfterTest', 'MISSING ROOT');
  }

  store.dispatch({type: "RESET_STORE_FOR_TESTING"});
  const textareas = document.getElementsByTagName("textarea");
  while (textareas[0]) {
    const current = textareas[0];
    current.parentNode.removeChild(current);
  }
}

export function teardown() {
  cleanupAfterTest('root', store);
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
export function activationSetup(language) {
  document.body.insertAdjacentHTML('afterbegin', fixture);
  const container = document.getElementById('cmb-editor');
  this.cmb = new CodeMirrorBlocks(container, { collapseAll: false, value: "" }, language);
  this.cmb.setBlockMode(true);

  this.activeNode = () => this.cmb.getFocusedNode();
  this.activeAriaId = () =>
    this.cmb.getScrollerElement().getAttribute('aria-activedescendent');
  this.selectedNodes = () => this.cmb.getSelectedNodes();
}

/**
 * Setup, be sure to use with `apply` (`cmSetup.apply(this, [pyret])`)
 * or `call` (`cmSetup.call(this, pyret)`)
 * so that `this` is scoped correctly!
 */
export function cmSetup(language) {
  document.body.insertAdjacentHTML('afterbegin', fixture);
  const container = document.getElementById('cmb-editor');
  this.cmb = new CodeMirrorBlocks(container, { collapseAll: false, value: "" }, language);
  this.editor = this.cmb;
  this.cm = this.editor;
  this.blocks = this.cmb;
  this.cmb.setBlockMode(true);
}

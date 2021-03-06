import wescheme from '../src/languages/wescheme';
import 'codemirror/addon/search/searchcursor.js';
import { wait, teardown, activationSetup } from './support/test-utils';
import { mouseDown, keyDown, dragstart, drop } from './support/simulate';

const DELAY = 250;

// be sure to call with `apply` or `call`
let setup = function () { activationSetup.call(this, wescheme); };

describe("trying to create a simple regression test", function () {
  beforeEach(async function () {
    setup.call(this);

    this.cmb.setValue('(collapse me)\n(+ 1 2)');
    await wait(DELAY);
    this.retrieve = function() {
      this.firstRoot = this.cmb.getAst().rootNodes[0];
      this.lastDropTarget = document.querySelectorAll('.blocks-drop-target')[4];
    };
    this.retrieve();
  });

  afterEach(function () { teardown(); });

  it('save collapsed state when dragging root to be the last child of the next root', async function () {
    mouseDown(this.firstRoot); // click the root
    keyDown("ArrowLeft", {}, this.firstRoot); // collapse it
    expect(this.firstRoot.element.getAttribute('aria-expanded')).toBe('false');
    expect(this.firstRoot.nid).toBe(0);
    let dragEvent = dragstart();
    this.firstRoot.element.dispatchEvent(dragEvent); // drag to the last droptarget
    this.lastDropTarget.dispatchEvent(drop(dragEvent.dataTransfer));
    await wait(DELAY);
    this.retrieve();
    this.newFirstRoot = this.cmb.getAst().rootNodes[0];
    this.newLastChild = this.newFirstRoot.args[2];
    expect(this.cmb.getValue()).toBe('\n(+ 1 2 (collapse me))');
    expect(this.newFirstRoot.element.getAttribute('aria-expanded')).toBe('true');
    expect(this.newLastChild.element.getAttribute('aria-expanded')).toBe('false');
  });
});
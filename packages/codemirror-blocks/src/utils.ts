import objToStableString from "fast-json-stable-stringify";
import CodeMirror, { EditorChange } from "codemirror";
import { CodeMirrorFacade } from "./editor";
import type { RootState } from "./state/reducers";
import * as selectors from "./state/selectors";
import type { AST, ASTNode, Pos, Range } from "./ast";

/**************************************************************
 * Compute which platform we're on
 */
const userAgent = navigator.userAgent;
const platform = navigator.platform;
const edge = /Edge\/(\d+)/.exec(userAgent);
const ios =
  !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
export const mac = ios || /Mac/.test(platform);

/**************************************************************
 * Utility functions used in one or more files
 */

/**
 * @internal
 * @returns a number, representing ReturnType<typeof requestAnimationFrame>
 * Expose a scheduler for after react's render cycle is over. Some
 * internal functions use it, and testing infrastructure may use it as well
 * see stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
 *
 * - If an extraDelay is passed, the inner timeout waits Xms after the render cycle
 */
export type afterDOMUpdateHandle = {
  raf: number;
  timeout?: ReturnType<typeof setTimeout>;
};

const uncompletedDOMUpdates: Set<afterDOMUpdateHandle> = new Set();
let afterAllDOMUpdateCallbacks: {
  resolve: () => void;
  reject: (e: unknown) => void;
}[] = [];

function markDOMUpdateCompleted(handle: afterDOMUpdateHandle) {
  // remove the handle from the set of uncompleted handles
  uncompletedDOMUpdates.delete(handle);

  // check that there are still 0 updates left
  // after each callback is called, since the callback could
  // theoreticaly add more dom updates into the
  // queue.
  while (
    uncompletedDOMUpdates.size === 0 &&
    afterAllDOMUpdateCallbacks.length > 0
  ) {
    afterAllDOMUpdateCallbacks.shift()?.resolve();
  }
}

function markDOMUpdateFailed(handle: afterDOMUpdateHandle, e: unknown) {
  // remove the handle from the set of uncompleted handles
  uncompletedDOMUpdates.delete(handle);

  // go through all afterAll callbacks hand reject them
  // so that errors don't get swallowed
  const failedCallbacks = [...afterAllDOMUpdateCallbacks];
  afterAllDOMUpdateCallbacks = [];
  for (const callback of failedCallbacks) {
    callback.reject(e);
  }
}

/**
 * A combination of setTimeout and requestAnimationFrame that executes
 * a callback function after a new animation frame is available and
 * the given delay has past.
 *
 * @param callback callback to call
 * @param extraDelay optional delay in milliseconds
 * @returns a handle that can passed to {@link cancelAfterDOMUpdate}
 *
 * @internal
 */
export function setAfterDOMUpdate(
  callback: () => void,
  extraDelay?: number
): afterDOMUpdateHandle {
  const handle: afterDOMUpdateHandle = {
    raf: window.requestAnimationFrame(() => {
      handle.timeout = setTimeout(() => {
        try {
          callback();
        } catch (e) {
          markDOMUpdateFailed(handle, e);
          return;
        }
        markDOMUpdateCompleted(handle);
      }, extraDelay);
    }),
  };
  uncompletedDOMUpdates.add(handle);
  return handle;
}

/**
 * Cancels a pending call to {@link setAfterDOMUpdate}
 *
 * @param handle a handle returned by {@link setAfterDOMUpdate}
 *
 * @internal
 */
export function cancelAfterDOMUpdate(
  handle: afterDOMUpdateHandle | undefined
): void {
  if (handle) {
    cancelAnimationFrame(handle.raf);
    if (handle.timeout) {
      clearTimeout(handle.timeout);
    }
    markDOMUpdateCompleted(handle);
  }
}

/**
 * Cancels all pendings calls to {@link setAfterDOMUpdate}
 *
 * This should only be used in testing environments.
 *
 * @internal
 */
export function cancelAllDOMUpdates() {
  for (const handle of uncompletedDOMUpdates) {
    cancelAfterDOMUpdate(handle);
  }
}

/**
 * Waits for all outstanding calls to setAfterDOMUpdate to finish or
 * be cancelled.
 *
 * This should really only be used by tests.
 *
 * @returns a promise that will be resolved once all dom updates have finished
 *
 * @internal
 */
export function afterAllDOMUpdates(): Promise<void> {
  const promise: Promise<void> = new Promise((resolve, reject) => {
    afterAllDOMUpdateCallbacks.push({ resolve, reject });
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setAfterDOMUpdate(() => {});
  });
  return promise;
}

/**
 * @internal
 * Create a dummy CM instance, matching relevant state
 * from a passed CodeMirrorFacade
 */
const tmpDiv = document.createElement("div");
export function getTempCM(editor: CodeMirrorFacade) {
  const tmpCM = CodeMirror(tmpDiv, { value: editor.getValue() });
  tmpCM.setCursor(editor.codemirror.getCursor());
  return tmpCM;
}

// make sure we never assign the same ID to two nodes in ANY active
// program at ANY point in time.
let nodeCounter = 0;
/**
 * Generates a unique string id. Note that this is only guaranteed to be
 * unique between calls to {@link resetUniqueIdGenerator}.
 * @internal
 * @returns a unique string id
 */
export function genUniqueId() {
  return (nodeCounter++).toString(16);
}

/**
 * Reset the state of the unique id generator. This should only be used
 * for testing.
 * @internal
 */
export function resetUniqueIdGenerator() {
  nodeCounter = 0;
}

// Use reliable object->string library to generate a pseudohash,
// then hash the string so we don't have giant "hashes" eating memory
// (see https://stackoverflow.com/a/7616484/12026982 and
// https://anchortagdev.com/consistent-object-hashing-using-stable-stringification/ )
export function hashObject(obj: unknown) {
  const str = objToStableString(obj);
  let hash = 0,
    i,
    chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
export function poscmp(a: Pos, b: Pos): number {
  return a.line - b.line || a.ch - b.ch;
}

export function minpos(a: Pos, b: Pos): Pos {
  return poscmp(a, b) <= 0 ? a : b;
}

export function maxpos(a: Pos, b: Pos): Pos {
  return poscmp(a, b) >= 0 ? a : b;
}

// srcRangeIncludes(
//   outerRange: {from: Pos, to: Pos},
//   innerRange: {from: Pos, to: Pos})
// -> boolean
//
// Returns true iff innerRange is contained within outerRange.
export function srcRangeIncludes(outerRange: Range, innerRange: Range) {
  return (
    poscmp(outerRange.from, innerRange.from) <= 0 &&
    poscmp(innerRange.to, outerRange.to) <= 0
  );
}

// srcRangeContains(range: {from: Pos, to: Pos}, pos: Pos) -> boolean
//
// Returns true iff `pos` is inside of `range`.
// (Being on the boundary counts as inside.)
export function srcRangeContains(range: Range, pos: Pos) {
  return poscmp(range.from, pos) <= 0 && poscmp(pos, range.to);
}

export function skipWhile<T>(
  skipper: (i: T | undefined) => boolean | null | undefined,
  start: T,
  next: (i: T | undefined) => T | undefined
) {
  let now: T | undefined = start;
  while (skipper(now)) {
    now = next(now);
  }
  return now;
}

export function warn(origin: string, message: string) {
  console.warn(`CodeMirrorBlocks - ${origin} - ${message}`);
}

export function partition<T>(arr: Readonly<T[]>, f: (i: T) => boolean) {
  const matched: T[] = [];
  const notMatched: T[] = [];
  for (const e of arr) {
    (f(e) ? matched : notMatched).push(e);
  }
  return [matched, notMatched];
}

// // from https://davidwalsh.name/javascript-debounce-function
// export function debounce(func, wait, immediate) {
//   var timeout;
//   return function() {
//     var context = this, args = arguments;
//     var later = function() {
//       timeout = null;
//       if (!immediate) func.apply(context, args);
//     };
//     var callNow = immediate && !timeout;
//     clearTimeout(timeout);
//     timeout = setTimeout(later, wait);
//     if (callNow) func.apply(context, args);
//   };
// }

export function skipCollapsed(
  node: ASTNode,
  next: (node: ASTNode | undefined) => ASTNode | undefined,
  state: RootState
) {
  const { collapsedList } = state;
  const ast = selectors.selectAST(state);
  const collapsedNodeList = collapsedList.map(ast.getNodeById);

  // NOTE(Oak): if this is too slow, consider adding a
  // next/prevSibling attribute to short circuit navigation
  return skipWhile(
    (node) =>
      node &&
      collapsedNodeList.some(
        (collapsed) => collapsed && ast.isAncestor(collapsed.id, node.id)
      ),
    next(node),
    next
  );
}

export function getRoot(ast: AST, node: ASTNode) {
  let next = node;
  // keep going until there's no next parent
  while (next) {
    const parent = ast.getNodeParent(next);
    if (parent) {
      next = parent;
    } else {
      break;
    }
  }
  return next;
}

export function getLastVisibleNode(state: RootState) {
  const ast = selectors.selectAST(state);
  const { collapsedList } = state;
  const collapsedNodeList = collapsedList.map(ast.getNodeByIdOrThrow);
  const lastNode = ast.getNodeBeforeCur(
    ast.rootNodes[ast.rootNodes.length - 1].to
  );
  return skipWhile(
    (node: ASTNode | null) => {
      if (node) {
        const parent = ast.getNodeParent(node);
        if (parent) {
          return collapsedNodeList.some(
            (collapsed) => collapsed.id === parent?.id
          );
        }
      }
      return null;
    },
    lastNode,
    (n) => n && ast.getNodeParent(n)
  );
}

export function posWithinNode(pos: Pos, node: ASTNode) {
  return (
    (poscmp(node.from, pos) <= 0 && poscmp(node.to, pos) > 0) ||
    (poscmp(node.from, pos) < 0 && poscmp(node.to, pos) >= 0)
  );
}

function posWithinNodeBiased(pos: Pos, node: ASTNode) {
  return poscmp(node.from, pos) <= 0 && poscmp(node.to, pos) > 0;
}

export function nodeCommentContaining(pos: Pos, node: ASTNode) {
  return node.options.comment && posWithinNode(pos, node.options.comment);
}

export function getNodeContainingBiased(cursor: Pos, ast: AST) {
  function iter(nodes: Readonly<ASTNode[]>): ASTNode | null {
    const node = nodes.find(
      (node) =>
        posWithinNodeBiased(cursor, node) || nodeCommentContaining(cursor, node)
    );
    if (node) {
      const children = [...node.children()];
      if (children.length === 0) {
        return node;
      } else {
        const result = iter(children);
        return result === null ? node : result;
      }
    } else {
      return null;
    }
  }
  return iter(ast.rootNodes);
}

export const dummyPos = { line: -1, ch: 0 };

export function isDummyPos(pos: Pos) {
  return pos.line === -1 && pos.ch === 0;
}
/*
// Announce, for testing purposes, that something important is about to update
// (like the DOM). Make sure to call `ready` after.
export function notReady(element) {
  SHARED.notReady[element] = null;
}

// Announce, for testing purposes, that an update previously registered with
// `notReady` has completed.
export function ready(element) {
  let thunk = SHARED.notReady[element];
  if (thunk) thunk();
  delete SHARED.notReady[element];
}

// For testing purposes, wait until everything (at least everything that knows
// to register itself with the `notReady` function) is ready. This should, e.g.,
// wait for DOM updates. DO NOT CALL THIS TWICE CONCURRENTLY, or it will not return.
export function waitUntilReady() {
  let waitingOn = Object.keys(SHARED.notReady).length;
  return new Promise(function(resolve, _) {
    for (let element of SHARED.notReady) {
      SHARED.notReady[element] = () => {
        waitingOn--;
        if (waitingOn === 0) {
          resolve();
        }
      };
    }
  });
}
*/
// Compute the position of the end of a change (its 'to' property refers to the pre-change end).
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
export function changeEnd({ from, to, text }: EditorChange) {
  if (!text) return to;
  const lastLine = text[text.length - 1];
  return {
    line: from.line + text.length - 1,
    ch: lastLine.length + (text.length == 1 ? from.ch : 0),
  };
}

// Adjust a Pos to refer to the post-change position, or the end of the change if the change covers it.
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
export function adjustForChange(pos: Pos, change: EditorChange, from: boolean) {
  if (poscmp(pos, change.from) < 0) return pos;
  if (poscmp(pos, change.from) == 0 && from) return pos; // if node.from==change.from, no change
  if (poscmp(pos, change.to) <= 0) return changeEnd(change);
  const line =
    pos.line + change.text.length - (change.to.line - change.from.line) - 1;
  let ch = pos.ch;
  if (pos.line == change.to.line) ch += changeEnd(change).ch - change.to.ch;
  return { line: line, ch: ch };
}

/**
 * Minimize a CodeMirror-style change object, by excluding any shared prefix
 * between the old and new text. Mutates part of the change object.
 *
 * @param param0
 * @returns
 */
export function minimizeChange({
  from,
  to,
  text,
  removed,
  origin = undefined,
}: EditorChange & { removed: string[] }) {
  // Remove shared lines
  while (text.length >= 2 && text[0] && removed[0] && text[0] === removed[0]) {
    text.shift();
    removed.shift();
    from.line += 1;
    from.ch = 0;
  }
  // Remove shared chars
  let n = 0;
  for (let i = 0; i < text[0].length; i++) {
    if (text[0][i] !== removed[0][i]) break;
    n = +i + 1;
  }
  text[0] = text[0].substr(n);
  removed[0] = removed[0].substr(n);
  from.ch += n;
  // Return the result.
  return origin
    ? { from, to, text, removed, origin }
    : { from, to, text, removed };
}

// display the actual exception, and try to log it
export function logResults(
  history: unknown,
  exception: unknown,
  description = "Crash Log"
) {
  debugLog(exception, history);
  try {
    (document.getElementById("description") as HTMLTextAreaElement).value =
      description;
    (document.getElementById("history") as HTMLTextAreaElement).value =
      JSON.stringify(history);
    (document.getElementById("exception") as HTMLTextAreaElement).value =
      String(exception);
    (document.getElementById("errorLogForm") as HTMLFormElement).submit();
  } catch (e) {
    debugLog("LOGGING FAILED.", e, history);
  }
}

export function validateRanges(
  ranges: { anchor: Pos; head?: Pos }[],
  ast: AST
) {
  ranges.forEach(({ anchor, head }) => {
    const c1 = head ? minpos(anchor, head) : anchor;
    const c2 = head ? maxpos(anchor, head) : anchor;
    if (ast.getNodeAt(c1, c2)) return; // if there's a node, it's a valid range
    // Top-Level if there's no node, or it's a root node with the cursor at .from or .to
    const N1 = ast.getNodeContaining(c1); // get node containing c1
    const N2 = ast.getNodeContaining(c2); // get node containing c2
    const c1IsTopLevel =
      !N1 ||
      (!ast.getNodeParent(N1) && (!poscmp(c1, N1.from) || !poscmp(c1, N1.to)));
    const c2IsTopLevel =
      !N2 ||
      (!ast.getNodeParent(N2) && (!poscmp(c2, N2.from) || !poscmp(c2, N2.to)));

    // If they're both top-level, it's a valid text range
    if (c1IsTopLevel && c2IsTopLevel) return;

    // Otherwise, the range is neither toplevel OR falls neatly on a node boundary
    throw `The range {line:${c1.line}, ch:${c1.ch}}, {line:${c2.line}, 
      ch:${c2.ch}} partially covers a node, which is not allowed`;
  });
  return true;
}

/**
 * Generates a description of an edit involving certain nodes
 * that can be announced to the user.
 *
 * @param nodes the ast nodes that are involved
 * @param editWord a word describing the edit like "copied"
 * @returns the human readable description of the edit
 * @internal
 */
export function createEditAnnouncement(nodes: ASTNode[], editWord: string) {
  nodes.sort((a, b) => poscmp(a.from, b.from)); // speak first-to-last
  return (
    editWord + " " + nodes.map((node) => node.shortDescription()).join(" and ")
  );
}
export class BlockError extends Error {
  type: string;
  data: unknown;
  constructor(message: string, type: string, data?: unknown) {
    super(message);
    this.type = type;
    this.data = data;
  }
}

/****************************************************************
 * SOUND HANDLING
 */
// for each sound resource, set crossorigin value to "anonymous"
// and set up state for interruptable playback
// (see https://stackoverflow.com/a/40370077/12026982)
class CustomAudio extends Audio {
  isPlaying: boolean;

  constructor(src: string) {
    super(src);
    this.crossOrigin = "anonymous";
    this.isPlaying = false;
    this.onplaying = () => {
      this.isPlaying = true;
    };
    this.onpause = () => {
      this.isPlaying = false;
    };
  }
}

import beepSound from "./ui/beep.mp3";
export const BEEP = new CustomAudio(beepSound);
import wrapSound from "./ui/wrap.mp3";
export const WRAP = new CustomAudio(wrapSound);

export function playSound(sound: CustomAudio) {
  sound.pause();
  debugLog("BEEP!");
  if (!(sound.paused && !sound.isPlaying)) return;
  if (sound.readyState > 0) sound.currentTime = 0;
  sound.play();
}

export function debugLog(...args: unknown[]) {
  if (global?.process?.env?.DEBUG) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

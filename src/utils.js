import CodeMirror from 'codemirror';
import SHARED from './shared';
import {store} from './store';

const ISMAC   = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i);

// make sure we never assign the same ID to two nodes in ANY active
// program at ANY point in time.
var nodeCounter = 0;
export function gensym() {
  return (nodeCounter++).toString(16);
}
export function resetNodeCounter() { nodeCounter = 0; }


// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
export function poscmp(a, b) {
  return  a.line - b.line || a.ch - b.ch;
}

export function minpos(a, b) {
  return poscmp(a, b) <= 0 ? a : b;
}

export function maxpos(a, b) {
  return poscmp(a, b) >= 0 ? a : b;
}

// srcRangeIncludes(
//   outerRange: {from: Pos, to: Pos},
//   innerRange: {from: Pos, to: Pos})
// -> boolean
//
// Returns true iff innerRange is contained within outerRange.
export function srcRangeIncludes(outerRange, innerRange) {
  return poscmp(outerRange.from, innerRange.from) <= 0
    && poscmp(innerRange.to, outerRange.to) <= 0;
}

// srcRangeContains(range: {from: Pos, to: Pos}, pos: Pos) -> boolean
//
// Returns true iff `pos` is inside of `range`.
// (Being on the boundary counts as inside.)
export function srcRangeContains(range, pos) {
  return poscmp(range.from, pos) <= 0 && poscmp(pos, range.to);
}

export function skipWhile(skipper, start, next) {
  let now = start;
  while (skipper(now)) {
    now = next(now);
  }
  return now;
}

export function assert(x) {
  if (!x) {
    throw new Error("assertion fails");
  }
}

export function warn(origin, message) {
  console.warn(`CodeMirrorBlocks - ${origin} - ${message}`);
}

export function partition(arr, f) {
  const matched = [];
  const notMatched = [];
  for (const e of arr) {
    if (f(e)) {
      matched.push(e);
    } else {
      notMatched.push(e);
    }
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

export function isControl(e) {
  return ISMAC ? e.metaKey : e.ctrlKey;
}

export function say(text, delay=200) {
  // if (this.muteAnnouncements) return; // TODO(Oak): how to mute?
  console.log('say:', text);
  const announcement = document.createTextNode(text + ', ');
  const announcer = store.getState().announcer;
  setTimeout(() => { if (announcer != null) announcer.appendChild(announcement); }, delay);
  setTimeout(() => { if (announcer != null) announcer.removeChild(announcement); }, delay + 10);
}


export function sayActionForNodes(nodes, action) {
  nodes.sort((a,b) => poscmp(a.from, b.from)); // speak first-to-last
  say(action + " " +
    nodes.map((node) => node.options['aria-label'])
      .join(" and "));
}

export function skipCollapsed(node, next, state) {
  const {collapsedList, ast} = state;
  const collapsedNodeList = collapsedList.map(ast.getNodeById);

  // NOTE(Oak): if this is too slow, consider adding a
  // next/prevSibling attribute to short circuit navigation
  return skipWhile(
    node => node && collapsedNodeList.some(
      collapsed => ast.isAncestor(collapsed.id, node.id)
    ),
    next(node),
    next
  );
}

export function getRoot(node) {
  let next = node;
  while (next && next.parent) {
    next = next.parent;
  }
  return next;
}

export function getLastVisibleNode(state) {
  const {collapsedList, ast} = state;
  const collapsedNodeList = collapsedList.map(ast.getNodeById);
  const lastNode = ast.getNodeBeforeCur(ast.reverseRootNodes[0].to);
  return skipWhile(
    node => !!node && node.parent && collapsedNodeList.some(
      collapsed => collapsed.id === node.parent.id),
    lastNode,
    n => n.parent
  );
}

export function withDefaults(obj, def) {
  return {...def, ...obj};
}

export function getBeginCursor(cm) {
  return CodeMirror.Pos(cm, 0);
}

export function getEndCursor(cm) {
  return CodeMirror.Pos(
    cm.lastLine(),
    cm.getLine(cm.lastLine()).length
  );
}

export function posWithinNode(pos, node) {
  return (poscmp(node.from, pos) <= 0) && (poscmp(node.to, pos) >  0)
    ||   (poscmp(node.from, pos) <  0) && (poscmp(node.to, pos) >= 0);
}

function posWithinNodeBiased(pos, node) {
  return (poscmp(node.from, pos) <= 0) && (poscmp(node.to, pos) > 0);
}

export function nodeCommentContaining(pos, node) {
  return node.options.comment && posWithinNode(pos, node.options.comment);
}

export function getNodeContainingBiased(cursor, ast) {
  function iter(nodes) {
    const node = nodes.find(node => posWithinNodeBiased(cursor, node) || nodeCommentContaining(cursor, node));
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

export const dummyPos = {line: -1, ch: 0};

export function isDummyPos(pos) {
  return pos.line === -1 && pos.ch === 0;
}

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

// Compute the position of the end of a change (its 'to' property refers to the pre-change end).
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
export function changeEnd({from, to, text}) {
  if (!text) return to;
  let lastLine = text[text.length - 1];
  return {
    line: from.line + text.length - 1,
    ch: lastLine.length + (text.length == 1 ? from.ch : 0)
  };
}

// Adjust a Pos to refer to the post-change position, or the end of the change if the change covers it.
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
export function adjustForChange(pos, change, from) {
  if (poscmp(pos, change.from) < 0)           return pos;
  if (poscmp(pos, change.from) == 0 && from)  return pos; // if node.from==change.from, no change
  if (poscmp(pos, change.to) <= 0)            return changeEnd(change);
  let line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
  if (pos.line == change.to.line) ch += changeEnd(change).ch - change.to.ch;
  return {line: line, ch: ch};
}

// Minimize a CodeMirror-style change object, by excluding any shared prefix
// between the old and new text. Mutates part of the change object.
export function minimizeChange({from, to, text, removed, origin=undefined}) {
  if (!removed) removed = SHARED.cm.getRange(from, to).split("\n");
  // Remove shared lines
  while (text.length >= 2 && text[0] && removed[0] && text[0] === removed[0]) {
    text.shift();
    removed.shift();
    from.line += 1;
    from.ch = 0;
  }
  // Remove shared chars
  let n = 0;
  for (let i in text[0]) {
    if (text[0][i] !== removed[0][i]) break;
    n = (+i) + 1;
  }
  text[0] = text[0].substr(n);
  removed[0] = removed[0].substr(n);
  from.ch += n;
  // Return the result.
  return origin ? {from, to, text, removed, origin} : {from, to, text, removed};
}

export function logResults(history, exception) {
  try {
    document.getElementById('history').value = JSON.stringify(history);
    document.getElementById('exception').value = exception;
    document.getElementById('errorLogForm').submit();
  } catch (e) {
    console.log('LOGGING FAILED.', e, history);
  }
}

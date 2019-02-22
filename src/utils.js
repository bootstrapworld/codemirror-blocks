import CodeMirror from 'codemirror';
import SHARED from './shared';
import {store} from './store';

const ISMAC   = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i);

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

export function copyToClipboard(text) {
  SHARED.buffer.value = text;
  SHARED.buffer.select();
  document.execCommand('copy');
}

export function pasteFromClipboard(done) {
  SHARED.buffer.value = '';
  SHARED.buffer.focus();
  setTimeout(() => {
    done(SHARED.buffer.value);
  }, 50);
}

export function isControl(e) {
  return ISMAC ? e.metaKey : e.ctrlKey;
}

export function say(text, delay=200) {
  // if (this.muteAnnouncements) return; // TODO(Oak): how to mute?
  console.log('say:', text);
  const announcement = document.createTextNode(text + ', ');
  const announcer = store.getState().announcer;
  setTimeout(() => announcer.appendChild(announcement), delay);
  setTimeout(() => announcer.removeChild(announcement), delay + 300);
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

export function isDummyPos(pos) {
  return pos.line === -1 && pos.ch === 0;
}

export function posAfterChanges(changes, pos, isFrom) {
  changes.forEach(c => pos = adjustForChange(pos, c, isFrom));
  return pos;
}

// computeFocusIdFromChanges : [CMchanges], AST -> Number
// compute the focusId by identifying the node in the newAST that was
// (a) most-recently added (if there's any insertion)
// (b) before the first-deleted (in the case of deletion)
// (c) first root node (in the case of deleting a pre-existing first node)
// (d) null (in the case of deleting the only nodes in the tree)
export function computeFocusIdFromChanges(changes, newAST) {
  let insertion = false, focusId = false;
  let startLocs = changes.map(c => {
    c.from = adjustForChange(c.from, c, true);
    c.to   = adjustForChange(c.to,   c, false);
    if(c.text.join("").length > 0) insertion = c; // remember the most-recent insertion
    return c.from;                                // return the starting srcLoc of the change
  });
  if(insertion) {
    // grab the node that ends in insertion's ending srcLoc (won't ever be null post-insertion)
    return newAST.getNodeBeforeCur(insertion.to).id; // case A
  } else {
    startLocs.sort(poscmp);                                // sort the deleted ranges
    let focusNode = newAST.getNodeBeforeCur(startLocs[0]); // grab the node before the first
    // if the node exists, use the Id (case B). If not, use the first node
    // (case C) unless the tree is empty (case D)
    if (focusNode) {
      return focusNode.id;
    } else {
      let firstRootNode = newAST.getFirstRootNode();
      return firstRootNode ? firstRootNode.id : null;
    }
  }
}

// Compute the position of the end of a change (its 'to' property refers to the pre-change end).
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
function changeEnd({from, to, text}) {
  if (!text) return to;
  let lastText = text[text.length-1];
  return {line: from.line+text.length-1, ch: lastText.length+(text.length==1 ? from.ch : 0)};
}

// Adjust a Pos to refer to the post-change position, or the end of the change if the change covers it.
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
function adjustForChange(pos, change, from) {
  if (poscmp(pos, change.from) < 0)           return pos;
  if (poscmp(pos, change.from) == 0 && from)  return pos; // if node.from==change.from, no change
  if (poscmp(pos, change.to) <= 0)            return changeEnd(change);
  let line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
  if (pos.line == change.to.line) ch += changeEnd(change).ch - change.to.ch;
  return {line: line, ch: ch};
}

// Announce, for testing purposes, that something important is about to update
// (like the DOM). Make sure to call `ready` after.
export function notReady(element) {
  SHARED.notReady[element] = null;
//  console.log("@notReady", element, SHARED.notReady[element], Object.keys(SHARED.notReady).length);
}

// Announce, for testing purposes, that an update previously registered with
// `notReady` has completed.
export function ready(element) {
  let thunk = SHARED.notReady[element];
  if (thunk) thunk();
  delete SHARED.notReady[element];
//  console.log("@ready", element, SHARED.notReady[element], Object.keys(SHARED.notReady).length);
}

// For testing purposes, wait until everything (at least everything that knows
// to register itself with the `notReady` function) is ready. This should, e.g.,
// wait for DOM updates. DO NOT CALL THIS TWICE CONCURRENTLY, or it will not return.
export function waitUntilReady() {
  let waitingOn = Object.keys(SHARED.notReady).length;
//  console.log("@waitingOn", Object.keys(SHARED.notReady));
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

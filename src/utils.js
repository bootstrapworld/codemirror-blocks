import CodeMirror from 'codemirror';
import global from './global';
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
  global.buffer.value = text;
  global.buffer.select();
  document.execCommand('copy');
}

export function pasteFromClipboard(done) {
  global.buffer.value = '';
  global.buffer.focus();
  setTimeout(() => {
    done(global.buffer.value);
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

function posWithinNode(pos, node) {
  return (poscmp(node.from, pos) <= 0) && (poscmp(node.to, pos) >  0)
    ||   (poscmp(node.from, pos) <  0) && (poscmp(node.to, pos) >= 0);
}

function posWithinNodeBiased(pos, node) {
  return (poscmp(node.from, pos) <= 0) && (poscmp(node.to, pos) > 0);
}

function nodeCommentContaining(pos, node) {
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

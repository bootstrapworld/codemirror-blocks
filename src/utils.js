import global from './global';
import {store} from './store';

const ISMAC   = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i);

// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
export function poscmp(a, b) {
  return  a.line - b.line || a.ch - b.ch;
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

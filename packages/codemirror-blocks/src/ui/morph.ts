/*
 * The animation when the editor switches between text and blocks: the words of
 * the program float from where they are written in the text to where they are in
 * the blocks (and back), as if the blocks were built around them.
 *
 * It is made of the page itself, and knows nothing of a language: the words on
 * the screen before the switch (the text nodes of the editor's lines, cut at
 * spaces and brackets) are matched, in order, with the words on the screen after
 * it. A matched word is a copy that is moved from one place to the other (a
 * word of a keyword or of an operator, as well as of a literal); a word with no
 * match fades out where it was, or in where it is. Only the words that are in
 * view before the switch, or after it, are animated.
 *
 *   switchWithMorph(editorElement, toBlocks, () => { switch the mode...; return ok });
 */

/** where a word is on the page, and how it looks */
type Word = {
  text: string;
  rect: { left: number; top: number; width: number; height: number };
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
};

/** how long the words take to float */
export const MORPH_MS = 450;
/** the most words that are animated (the rest appear and disappear) */
const MAX_WORDS = 400;
/** what a word is: not spaces, and not brackets */
const WORD = /[^\s()[\]{}]+/g;
/** text that is not part of the program that is drawn: popups, hints, numbers */
const SKIP =
  '[aria-hidden="true"], .blocks-comment, .blocks-comment-badge, .screenreader-only, .CodeMirror-gutters, .cmb-morph';

let active: { cancel(): void; waiting(): boolean } | null = null;

const canAnimate = () =>
  typeof Element !== "undefined" &&
  typeof Element.prototype.animate === "function" &&
  typeof document.createRange === "function" &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** the part of the page the editor shows its lines in */
const viewOf = (root: HTMLElement) => {
  const scroll = root
    .querySelector<HTMLElement>(".CodeMirror-scroll")
    ?.getBoundingClientRect();
  if (!scroll) return undefined;
  // (what is of it inside the editor's own box: the lines can run on past it)
  const box = root.getBoundingClientRect();
  const left = Math.max(scroll.left, box.left);
  const top = Math.max(scroll.top, box.top);
  const right = Math.min(scroll.right, box.right);
  const bottom = Math.min(scroll.bottom, box.bottom);
  return new DOMRect(
    left,
    top,
    Math.max(0, right - left),
    Math.max(0, bottom - top)
  );
};

const meets = (r: Word["rect"], v: DOMRect) =>
  r.left < v.right &&
  r.left + r.width > v.left &&
  r.top < v.bottom &&
  r.top + r.height > v.top;

/** The words on the screen now, in the order of the page, those near the view */
function collectWords(root: HTMLElement): Word[] {
  const lines = root.querySelector(".CodeMirror-lines");
  const view = viewOf(root);
  if (!lines || !view) return [];
  // (a screen above and below the view: the lines CodeMirror has drawn)
  const near = new DOMRect(
    view.left,
    view.top - view.height,
    view.width,
    view.height * 3
  );
  const words: Word[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(lines, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && words.length < MAX_WORDS * 2;) {
    const parent = n.parentElement;
    const text = n.textContent ?? "";
    const next = walker.nextNode();
    if (parent && text.trim() && !parent.closest(SKIP)) {
      const style = getComputedStyle(parent);
      if (style.visibility !== "hidden" && style.display !== "none") {
        for (const m of text.matchAll(WORD)) {
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const box = range.getClientRects()[0];
          if (!box || box.width === 0) continue;
          const rect = {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          };
          if (!meets(rect, near)) continue;
          words.push({
            text: m[0],
            rect,
            fontSize: parseFloat(style.fontSize),
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            color: style.color,
          });
        }
      }
    }
    n = next;
  }
  return words;
}

/** The words that are in both, in order: [index before, index after] */
function match(before: Word[], after: Word[]): [number, number][] {
  const n = before.length;
  const m = after.length;
  // (the longest run of the same words, in the same order)
  const table: Uint16Array[] = Array.from(
    { length: n + 1 },
    () => new Uint16Array(m + 1)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        before[i].text === after[j].text
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (before[i].text === after[j].text) {
      pairs.push([i, j++]);
      i++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

function makeWord(word: Word, layer: HTMLElement): HTMLElement {
  const el = document.createElement("span");
  el.className = "cmb-morph";
  el.textContent = word.text;
  Object.assign(el.style, {
    position: "fixed",
    left: `${word.rect.left}px`,
    top: `${word.rect.top}px`,
    height: `${word.rect.height}px`,
    lineHeight: `${word.rect.height}px`,
    fontSize: `${word.fontSize}px`,
    fontFamily: word.fontFamily,
    fontWeight: word.fontWeight,
    color: word.color,
    whiteSpace: "pre",
    pointerEvents: "none",
  });
  layer.appendChild(el);
  return el;
}

const centerY = (r: Word["rect"]) => r.top + r.height / 2;

/** set on the editor while the toolbar is held open (see Editor.less) */
const TOOLBAR = "data-morph-toolbar";

/**
 * Switches the editor between text and blocks, with the words floating from the
 * one to the other. `doSwitch` makes the switch (and says if it was made); it is
 * called when the words are ready, which is not at once:
 *
 * - to blocks: the toolbar opens first (the editor is still text, which moves
 *   with it), then the words of the text are measured where they now are, the
 *   mode is switched, and the words float to the blocks;
 * - to text: the words of the blocks are measured, the mode is switched with the
 *   toolbar kept open, the words float to the text, and then the toolbar closes.
 *
 * so that nothing but the words is moving when they float. Without motion (or
 * with nothing to see) it is just `doSwitch()`.
 */
export function switchWithMorph(
  root: HTMLElement | null,
  toBlocks: boolean,
  doSwitch: () => boolean
): void {
  if (active) {
    // (a click while the toolbar is opening makes the switch now, and that is
    // all it does)
    const waiting = active.waiting();
    active.cancel();
    if (waiting) return;
  }
  if (!root || !canAnimate()) {
    doSwitch();
    return;
  }

  let switched = false;
  const switchOnce = () => {
    if (switched) return true;
    switched = true;
    return doSwitch();
  };
  let waiting = false;
  let done = false;
  let before: Word[] = [];
  let fragments: HTMLElement[] = [];
  let layer: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = (delayToolbar = false) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    layer?.remove();
    root.removeAttribute("data-morphing");
    // (a toolbar that was held open closes now; one that was opened for the
    // switch has the mode that keeps it open, a moment after it is switched)
    // (not if another switch has begun since: the marker is its own then)
    if (delayToolbar) {
      setTimeout(() => {
        if (!active) root.removeAttribute(TOOLBAR);
      }, 100);
    } else {
      root.removeAttribute(TOOLBAR);
    }
    window.removeEventListener("keydown", cancel, true);
    window.removeEventListener("pointerdown", cancel, true);
    window.removeEventListener("resize", cancel);
    root
      .querySelector(".CodeMirror-scroll")
      ?.removeEventListener("scroll", cancel);
    if (active === handle) active = null;
  };
  function cancel() {
    if (done) return;
    // (the user wants the switch: it is made, without the words)
    const early = !switched;
    switchOnce();
    stop(early);
  }

  const animate = (after: Word[]) => {
    // (the blocks come in with the words: see Editor.less)
    root.setAttribute("data-morphing", "play");
    const view = viewOf(root);
    const pairs = match(before, after);
    const matchedAfter = new Set(pairs.map(([, j]) => j));
    const matchedBefore = new Set(pairs.map(([i]) => i));
    const options: KeyframeAnimationOptions = {
      duration: MORPH_MS,
      easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
      fill: "forwards",
    };
    const running: Animation[] = [];
    // the words that are in both, which float
    for (const [i, j] of pairs) {
      const from = before[i];
      const to = after[j];
      const visible = view && (meets(from.rect, view) || meets(to.rect, view));
      if (!visible) {
        fragments[i].remove();
        continue;
      }
      running.push(
        fragments[i].animate(
          [
            { transform: "translate(0, 0)", fontSize: `${from.fontSize}px` },
            {
              transform: `translate(${to.rect.left - from.rect.left}px, ${
                centerY(to.rect) - centerY(from.rect)
              }px)`,
              fontSize: `${to.fontSize}px`,
              color: to.color,
            },
          ],
          options
        )
      );
    }
    // the words before that are not after fade out where they are
    before.forEach((w, i) => {
      if (matchedBefore.has(i)) return;
      if (view && !meets(w.rect, view)) {
        fragments[i].remove();
        return;
      }
      running.push(
        fragments[i].animate([{ opacity: 1 }, { opacity: 0 }], options)
      );
    });
    // the words after that were not before fade in where they are
    after.forEach((w, j) => {
      if (matchedAfter.has(j) || (view && !meets(w.rect, view)) || !layer) {
        return;
      }
      running.push(
        makeWord(w, layer).animate([{ opacity: 0 }, { opacity: 1 }], options)
      );
    });
    // (the text of the new mode is drawn from the start, and shown when the
    // words have got to it)
    if (!running.length) return stop();
    Promise.allSettled(running.map((a) => a.finished)).then(() => stop());
  };

  /** The mode is switched, and drawn a few frames later: wait for the page to be still */
  const play = () => {
    let last = "";
    let still = 0;
    let tries = 0;
    const wait = () => {
      if (done) return;
      const now = collectWords(root);
      // (the same words in the same places as the frame before)
      const seen = now
        .map(
          (w) => `${w.text}${Math.round(w.rect.left)},${Math.round(w.rect.top)}`
        )
        .join(" ");
      still = seen === last ? still + 1 : 0;
      last = seen;
      if ((still >= 2 && now.length) || ++tries > 40) {
        if (now.length) animate(now);
        else stop();
        return;
      }
      timer = setTimeout(wait, 16);
    };
    timer = setTimeout(wait, 16);
    // (a hard stop, whatever happens)
    setTimeout(() => stop(), MORPH_MS + 2500);
  };

  /** The words as they are now are drawn over the editor, and the switch is made */
  const float = () => {
    if (done || !waiting) return;
    waiting = false;
    before = collectWords(root);
    if (!before.length) {
      switchOnce();
      stop(true);
      return;
    }
    layer = document.createElement("div");
    layer.className = "cmb-morph-layer";
    layer.setAttribute("aria-hidden", "true");
    // (as big as the window: the clip below is measured from its box, and the
    // words are placed in the window)
    Object.assign(layer.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "100000",
    });
    // (the words are seen only where the editor shows its lines: one that
    // floats to a place out of view slides out of it)
    const view = viewOf(root);
    if (view) {
      layer.style.clipPath = `inset(${view.top}px ${
        window.innerWidth - view.right
      }px ${window.innerHeight - view.bottom}px ${view.left}px)`;
    }
    document.body.appendChild(layer);
    const made = layer;
    fragments = before.map((w) => makeWord(w, made));
    root.setAttribute("data-morphing", "");
    // (going to text, the toolbar stays open while the words float)
    if (!toBlocks) root.setAttribute(TOOLBAR, "");
    if (!switchOnce()) {
      stop();
      return;
    }
    play();
  };

  const handle = { cancel, waiting: () => waiting };
  active = handle;
  window.addEventListener("keydown", cancel, true);
  window.addEventListener("pointerdown", cancel, true);
  window.addEventListener("resize", cancel);
  root.querySelector(".CodeMirror-scroll")?.addEventListener("scroll", cancel);

  const pane = root.querySelector(":scope > .toolbar-pane");
  waiting = true;
  if (toBlocks && pane) {
    // the toolbar opens (the editor is text still: it moves with it), and the
    // words are measured when it has
    root.setAttribute(TOOLBAR, "");
    pane.getBoundingClientRect(); // (the transition starts at the next style)
    Promise.allSettled(pane.getAnimations().map((a) => a.finished)).then(() => {
      timer = setTimeout(float, 30);
    });
    setTimeout(float, 1500); // (whatever happens)
  } else {
    float();
  }
}

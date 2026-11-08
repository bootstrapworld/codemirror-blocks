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
 *   const morph = beginMorph(editorElement, toBlocks);
 *   switch the mode...
 *   morph?.play();   (or morph?.cancel() if the switch did not happen)
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

export type Morph = {
  /** Plays the animation, from the words before the switch to those after it */
  play(): void;
  /** Ends it at once (the switch did not happen, or the user did something) */
  cancel(): void;
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

let active: Morph | null = null;

const canAnimate = () =>
  typeof Element !== "undefined" &&
  typeof Element.prototype.animate === "function" &&
  typeof document.createRange === "function" &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** the part of the page the editor shows its lines in */
const viewOf = (root: HTMLElement) =>
  root
    .querySelector<HTMLElement>(".CodeMirror-scroll")
    ?.getBoundingClientRect();

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

/**
 * Starts a switch: the words that are on the screen now are drawn over the
 * editor (and its own text is hidden), so that nothing changes until the switch
 * is made. Returns nothing if there is nothing to animate (nobody can see it, or
 * does not want to).
 */
export function beginMorph(root: HTMLElement | null): Morph | null {
  if (!root || !canAnimate()) return null;
  active?.cancel();
  const before = collectWords(root);
  if (!before.length) return null;
  const layer = document.createElement("div");
  layer.className = "cmb-morph-layer";
  layer.setAttribute("aria-hidden", "true");
  // (the words are seen only where the editor shows its lines: one that floats
  // to a place out of view slides out of it)
  const view = viewOf(root);
  if (view) {
    layer.style.clipPath = `inset(${view.top}px ${
      window.innerWidth - view.right
    }px ${window.innerHeight - view.bottom}px ${view.left}px)`;
  }
  document.body.appendChild(layer);
  const fragments = before.map((w) => makeWord(w, layer));
  root.setAttribute("data-morphing", "");

  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    layer.remove();
    root.removeAttribute("data-morphing");
    window.removeEventListener("keydown", cancel, true);
    window.removeEventListener("pointerdown", cancel, true);
    window.removeEventListener("resize", cancel);
    root
      .querySelector(".CodeMirror-scroll")
      ?.removeEventListener("scroll", cancel);
    if (active === morph) active = null;
  };
  function cancel() {
    stop();
  }

  const animate = (after: Word[]) => {
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
      if (matchedAfter.has(j) || (view && !meets(w.rect, view))) return;
      running.push(
        makeWord(w, layer).animate([{ opacity: 0 }, { opacity: 1 }], options)
      );
    });
    // (the text of the new mode is drawn from the start, and shown when the
    // words have got to it)
    const finish = () => stop();
    if (!running.length) return finish();
    Promise.allSettled(running.map((a) => a.finished)).then(finish);
  };

  const morph: Morph = {
    play() {
      // The mode is switched, and drawn a few frames later (the blocks are put
      // on the text by the editor once it has rendered): wait until what is on
      // the page has stopped changing.
      let last = -1;
      let still = 0;
      let tries = 0;
      const wait = () => {
        if (done) return;
        const now = collectWords(root);
        still = now.length === last ? still + 1 : 0;
        last = now.length;
        if ((still >= 2 && now.length) || ++tries > 40) {
          if (now.length) animate(now);
          else stop();
          return;
        }
        timer = setTimeout(wait, 16);
      };
      timer = setTimeout(wait, 16);
      // (a hard stop, whatever happens)
      setTimeout(stop, MORPH_MS + 1500);
    },
    cancel,
  };
  window.addEventListener("keydown", cancel, true);
  window.addEventListener("pointerdown", cancel, true);
  window.addEventListener("resize", cancel);
  root.querySelector(".CodeMirror-scroll")?.addEventListener("scroll", cancel);
  active = morph;
  return morph;
}

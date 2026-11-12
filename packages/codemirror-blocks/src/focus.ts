import type { AppStore } from "./state/store";
import type { CodeMirrorFacade } from "./editor";
import * as selectors from "./state/selectors";

/**
 * Is keyboard focus on nothing the user could be typing into: nothing, the
 * page's body, or the screenreader placeholder?
 */
export const stranded = () => {
  const active = document.activeElement;
  return (
    !active || active === document.body || active.id === "cmb-focus-placeholder"
  );
};

/**
 * The most animation frames that the keeper goes on trying for, when the block
 * that should have focus is not on the page yet (or does not take it).
 */
const MAX_RETRY_FRAMES = 30;

/**
 * Keeps keyboard focus on the focused block, for the focus that is dropped with
 * no render to notice: the editor puts the elements of a block on the page again
 * (or takes them off, when their line is scrolled out of the document it draws),
 * and the browser then drops focus to the body.
 *
 * One rule, run (at most once a frame) when something that could have dropped
 * focus has happened: if the store names a focused block, and the editor has not
 * been left (a press outside it, or focus gone to something outside it, since
 * focus was last inside it), and keyboard focus is stranded, focus the block's
 * element; or, if it is not on the page, scroll to it so that it is drawn, and
 * hand it focus when it is.
 *
 * One per editor: `dispose` stops it.
 */
export function createFocusKeeper({
  codemirror,
  editor,
  store,
}: {
  codemirror: CodeMirror.Editor;
  editor: CodeMirrorFacade;
  store: AppStore;
}) {
  const wrapper = codemirror.getWrapperElement();
  // Inside the editor: its wrapper (the blocks and CodeMirror's input), and its
  // own placeholder where focus is parked while a block is not on the page,
  // which is outside the wrapper but is the editor's own (the one in the same
  // container: every editor on a page has one). The toolbar, the search dialog
  // and the trash can are not: a press on them is a press outside, and whatever
  // they do next with focus (give it to a block, or back to the dialog's
  // opener) puts it inside again.
  const placeholder = () =>
    wrapper
      .closest(".Editor")
      ?.parentElement?.querySelector("#cmb-focus-placeholder");
  const inside = (target: EventTarget | null) =>
    target instanceof Element &&
    (wrapper.contains(target) || target === placeholder());

  // Has the editor been left? It has, until focus is inside it: the keeper must
  // never pull focus into an editor that the user has not been in.
  let left = !inside(document.activeElement);
  // (focus is owed to a block that had to be scrolled to first)
  let owesFocus = false;
  let frame = 0;
  let retries = 0;

  // Is there more to do in a frame? (the block is not on the page, or did not
  // take focus)
  const reconcile = (): boolean => {
    const id = store.getState().focusId;
    if (!id || left) return false;
    if (!owesFocus && !stranded()) return false;
    const el = document.getElementById(`block-node-${id}`);
    if (el?.isConnected) {
      owesFocus = false;
      el.focus();
      return stranded();
    }
    // The block is not on the page: CodeMirror took it off when the document
    // got shorter (collapse all) or scrolled. Scroll to it, so that
    // CodeMirror draws it again; the next run hands it focus.
    const node = selectors.getAST(store.getState()).getNodeById(id);
    // (the AST may be older than the text during an edit: the block may
    // be gone, with its lines)
    if (node?.element && node.to.line <= codemirror.lastLine()) {
      owesFocus = true;
      editor.scrollASTNodeIntoView(node);
    }
    return true;
  };

  // Runs: at once, when the store or the editor says something has changed
  // (these come after a render, or are the editor drawing: nothing is on its way
  // that a wait would let finish, and a block that is not given focus until a
  // frame later leaves the editor with focus stranded, which is heard); and in
  // the next frame, at most once, for what the page does without saying (focus
  // going to nothing, elements moving), where a render may be on its way. A run
  // that finds the block not on the page, or not taking focus, is tried again
  // each frame, for MAX_RETRY_FRAMES at most.
  const tryAgain = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (reconcile() && retries < MAX_RETRY_FRAMES) {
        retries++;
        tryAgain();
      } else {
        retries = 0;
      }
    });
  };
  const now = () => {
    retries = 0;
    if (reconcile()) tryAgain();
  };
  const later = () => {
    if (frame) return;
    retries = 0;
    tryAgain();
  };

  const onPress = (e: Event) => {
    left = !inside(e.target);
  };
  const onFocusIn = (e: FocusEvent) => {
    left = !inside(e.target);
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!e.relatedTarget) later();
  };

  let lastFocusId = store.getState().focusId;
  const unsubscribe = store.subscribe(() => {
    const { focusId } = store.getState();
    if (focusId === lastFocusId) return;
    lastFocusId = focusId;
    now();
  });
  codemirror.on("update", now);
  const observer = new MutationObserver(later);
  observer.observe(wrapper, { childList: true, subtree: true });
  wrapper.addEventListener("focusout", onFocusOut);
  document.addEventListener("focusin", onFocusIn);
  for (const type of ["pointerdown", "mousedown", "touchstart"]) {
    document.addEventListener(type, onPress, true);
  }

  return {
    dispose() {
      unsubscribe();
      codemirror.off("update", now);
      observer.disconnect();
      wrapper.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("focusin", onFocusIn);
      for (const type of ["pointerdown", "mousedown", "touchstart"]) {
        document.removeEventListener(type, onPress, true);
      }
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

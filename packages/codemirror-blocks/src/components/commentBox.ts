import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { CommentTarget } from "../state/actions";

/**
 * Calls `fn` when the editor has drawn again (it does so a moment after what was
 * typed or scrolled, and that can move the lines in it). Returns what stops it.
 */
function onEditorUpdate(node: HTMLElement, fn: () => void): () => void {
  const wrapper = node.closest<HTMLElement>(".CodeMirror") as
    (HTMLElement & { CodeMirror?: CodeMirror.Editor }) | null;
  const cm = wrapper?.CodeMirror;
  cm?.on("update", fn);
  return () => cm?.off("update", fn);
}

/**
 * Places the popup (or the box) with a node's comment: it hangs from the top of
 * the node, and so grows downwards; where that would put it below the bottom of
 * the editor (and out of sight), it is held at the node's bottom edge instead,
 * and grows upwards, unless that would put it above the top of the editor too.
 */
function placeCommentBox(node: HTMLElement, box: HTMLElement) {
  box.classList.remove("blocks-comment-above");
  const room = node.closest(".CodeMirror")?.getBoundingClientRect();
  if (room && box.getBoundingClientRect().bottom > room.bottom) {
    box.classList.add("blocks-comment-above");
    if (box.getBoundingClientRect().top < room.top) {
      box.classList.remove("blocks-comment-above");
    }
  }
}

/**
 * The popup with a node's comment, and the box the comment is typed in, are
 * placed (see placeCommentBox) after every render that could move them.
 */
export function useCommentBoxPlacement({
  nodeElementRef,
  isFocused,
  commentText,
  commentEditor,
}: {
  nodeElementRef: RefObject<HTMLSpanElement | null>;
  isFocused: boolean;
  commentText: string;
  commentEditor: CommentTarget | null;
}) {
  useLayoutEffect(() => {
    const node = nodeElementRef.current;
    const popup = node?.querySelector<HTMLElement>(":scope > .blocks-comment");
    if (!node || !popup) return;
    const place = () => placeCommentBox(node, popup);
    place();
    if (!isFocused) return;
    // (the editor scrolls a block into view after it has focus, which moves it
    // relative to the edges of the editor: and again as it is scrolled)
    const scroller = node.closest(".CodeMirror-scroll");
    const frame = requestAnimationFrame(place);
    scroller?.addEventListener("scroll", place);
    const stop = onEditorUpdate(node, place);
    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", place);
      stop();
    };
    // (the ref is a parameter now, so the rule does not know it never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, commentText]);

  // The box the comment is typed in is placed the same way, and again each time
  // the text changes (it is as big as the text, so it can grow past an edge).
  useLayoutEffect(() => {
    const node = nodeElementRef.current;
    const box = node?.querySelector<HTMLElement>(".blocks-comment-editing");
    if (!commentEditor || !node || !box) return;
    const place = () => {
      placeCommentBox(node, box);
      // (typing moves the editor's scroll to follow the caret, and the box
      // growing upwards moves it back: keep the box in view, which is what is
      // being typed in)
      const room = node.closest(".CodeMirror")?.getBoundingClientRect();
      const at = box.getBoundingClientRect();
      if (room && (at.bottom > room.bottom || at.top < room.top)) {
        box.scrollIntoView?.({ block: "nearest" });
      }
    };
    place();
    // (once more after the frame: what is typed is drawn again by then, and the
    // editor scrolls to follow the caret, which moves the box in the editor)
    let frame = 0;
    const onInput = () => {
      place();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const scroller = node.closest(".CodeMirror-scroll");
    box.addEventListener("input", onInput);
    scroller?.addEventListener("scroll", place);
    const stop = onEditorUpdate(node, place);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener("input", onInput);
      scroller?.removeEventListener("scroll", place);
      stop();
    };
    // (the ref is a parameter now, so the rule does not know it never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentEditor]);
}

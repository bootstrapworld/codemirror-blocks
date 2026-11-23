/*
 * The editor object stands in for a CodeMirror 6 `EditorView`: code that holds an `EditorView` (a command, `undo(view)`, a plugin's helper)
 * works on the editor object too. The public members of `EditorView` are forwarded to the real view (`ed.view`), which is kept.
 * `destroy` is the editor's own (it also stops the block layer, then destroys the view).
 */
import { EditorView } from "@codemirror/view";

/** the members of `EditorView` that are forwarded (`destroy` is not: the editor has its own) */
export const VIEW_MEMBERS = [
  "state",
  "viewport",
  "visibleRanges",
  "inView",
  "composing",
  "compositionStarted",
  "root",
  "dom",
  "scrollDOM",
  "contentDOM",
  "dispatch",
  "update",
  "setState",
  "themeClasses",
  "requestMeasure",
  "plugin",
  "documentTop",
  "documentPadding",
  "scaleX",
  "scaleY",
  "elementAtHeight",
  "lineBlockAtHeight",
  "viewportLineBlocks",
  "lineBlockAt",
  "contentHeight",
  "moveByChar",
  "moveByGroup",
  "visualLineSide",
  "moveToLineBoundary",
  "moveVertically",
  "domAtPos",
  "posAtDOM",
  "posAtCoords",
  "posAndSideAtCoords",
  "coordsAtPos",
  "coordsForChar",
  "defaultCharacterWidth",
  "defaultLineHeight",
  "textDirection",
  "textDirectionAt",
  "lineWrapping",
  "bidiSpans",
  "hasFocus",
  "focus",
  "setRoot",
  "scrollSnapshot",
  "setTabFocusMode",
] as const;

/** what `ed` has of an `EditorView` (type only) */
export type ViewSurface = Pick<EditorView, (typeof VIEW_MEMBERS)[number]>;

/** forward the members of `view()` to `target`, except those it has already */
export function forwardView<T extends object>(
  target: T,
  view: () => EditorView
): T & ViewSurface {
  for (const name of VIEW_MEMBERS) {
    if (name in target) continue;
    const method =
      typeof Object.getOwnPropertyDescriptor(EditorView.prototype, name)
        ?.value === "function";
    const of = view as unknown as () => Record<string, unknown>;
    Object.defineProperty(
      target,
      name,
      method
        ? {
            value: (...a: unknown[]) =>
              (of()[name] as (...x: unknown[]) => unknown)(...a),
          }
        : { get: () => of()[name] }
    );
  }
  return target as T & ViewSurface;
}

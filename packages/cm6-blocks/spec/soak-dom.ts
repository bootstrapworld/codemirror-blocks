/*
 * Checks of the page that the soak runner makes in both engines. Each is a SELF-CONTAINED function (no import, no outside name), so that
 * Playwright can send it to the page (`page.evaluate(fn)`) and jest can call it on jsdom's `document` as it is.
 */

/** aria-posinset, aria-setsize, aria-expanded, aria-selected and a label on every drawn block (the checks of e2e/a11y.e2e.ts, from the DOM) */
export function a11yProblems(): string[] {
  const out: string[] = [];
  const content = document.querySelector(".cm-content");
  if (!content) return ["no .cm-content"];
  const items = Array.from(
    content.querySelectorAll("[role=treeitem]")
  ) as HTMLElement[];
  // (the block of a comment, not the popup a block shows: that one is a span inside the block and has no role)
  const isComment = (el: Element): boolean =>
    el.classList.contains("blocks-comment");
  for (const h of Array.from(content.querySelectorAll(".blocks-attached")))
    if (h.hasAttribute("role") || h.getAttribute("aria-hidden") !== "true")
      out.push(
        "a comment that goes with a block is a treeitem or is not hidden"
      );
  const groups = new Map<Element, HTMLElement[]>();
  for (const it of items) {
    // (a comment is not counted: not in the set size, not in the positions; a comment that goes with a block is not a treeitem at all)
    if (it.classList.contains("blocks-node") && isComment(it)) {
      if (it.hasAttribute("aria-posinset") || it.hasAttribute("aria-setsize"))
        out.push(
          `a comment has a count (${it.getAttribute("aria-posinset")} of ${it.getAttribute("aria-setsize")}) @ ${it.getAttribute("aria-label")}`
        );
      continue;
    }
    const parentItem = it.parentElement?.closest("[role=treeitem]") ?? null;
    const holder = parentItem
      ? ((it.parentElement as Element).closest("[data-slot]") ?? parentItem)
      : content;
    groups.set(holder, [...(groups.get(holder) ?? []), it]);
  }
  for (const [holder, g] of groups) {
    // (the roots of a program that is taller than the window: CodeMirror draws only the lines near the viewport, so fewer roots than the
    // set size are drawn, from any position on: their positions go up by one and stay within the set. Everything inside a root is drawn)
    const first = Number(g[0].getAttribute("aria-posinset"));
    const size = Number(g[0].getAttribute("aria-setsize"));
    const virtual = holder === content && g.length < size && first >= 1;
    g.forEach((it, i) => {
      const label = it.getAttribute("aria-label");
      const want = virtual ? first + i : i + 1;
      if (Number(it.getAttribute("aria-posinset")) !== want)
        out.push(
          `posinset ${it.getAttribute("aria-posinset")} but position ${want} @ ${label}`
        );
      if (
        virtual
          ? Number(it.getAttribute("aria-setsize")) !== size || want > size
          : Number(it.getAttribute("aria-setsize")) !== g.length
      )
        out.push(
          `setsize ${it.getAttribute("aria-setsize")} but ${g.length} siblings drawn @ ${label}`
        );
    });
  }
  for (const it of items) {
    const label = it.getAttribute("aria-label");
    // (a comment block folds to its emoji like a compound one: it has aria-expanded too)
    const compound =
      it.classList.contains("blocks-compound") ||
      it.classList.contains("blocks-comment");
    if (compound !== it.hasAttribute("aria-expanded"))
      out.push(
        `aria-expanded ${it.getAttribute("aria-expanded")} on a ${compound ? "compound" : "leaf"} block @ ${label}`
      );
    if (!["true", "false"].includes(it.getAttribute("aria-selected") ?? ""))
      out.push(`no aria-selected @ ${label}`);
    if (!label) out.push("a block has no aria-label @ ?");
  }
  return out.slice(0, 5);
}

/**
 * Where the keyboard focus is: null when it is somewhere the editor can hear it (a block, an edit box, the text, a dialog of the editor), else
 * the reason. `toolbarOk`: the toolbar may have it (the step went there on purpose: the toolbar, the mode button).
 */
export function focusProblem(toolbarOk: boolean): string | null {
  const a = document.activeElement as HTMLElement | null;
  if (!a || a === document.body || a === document.documentElement)
    return "keyboard focus is on the page body";
  if (!a.isConnected) return "keyboard focus is on a detached element";
  if (a.closest(".cm-editor")) return null;
  if (a.closest(".blocks-search, .blocks-help, [role=dialog], dialog"))
    return null;
  if (toolbarOk && a.closest("#templates, .blocks-toolbar, .blocks-toggle-btn"))
    return null;
  return `keyboard focus is outside the editor: <${a.tagName.toLowerCase()} class="${a.className}">`;
}

import { AST, ASTNode } from "../../src/ast";
import { isBlockNodeMarker } from "../../src/editor";
import * as selectors from "../../src/state/selectors";
import { getRoot } from "../../src/utils";
import { getMountedCMB } from "../../src/toolkit/test-utils";

/**
 * Properties that must hold for the mounted editor after *any* operation.
 * See doc/internal/test-plan.md, section 12.
 *
 * Returns a list of human-readable violations (empty if everything is fine).
 */
export function findInvariantViolations(): string[] {
  const mounted = getMountedCMB();
  if (!mounted) {
    return [];
  }
  const { cmb, store } = mounted;
  const state = store.getState();
  if (!state.blockMode) {
    return []; // the AST is only maintained in block mode
  }
  const violations: string[] = [];
  const ast = selectors.getAST(state);
  const text = cmb.getValue();
  const posStr = (p: { line: number; ch: number }) => `${p.line}:${p.ch}`;

  // 1. The document text parses to exactly the AST in the store.
  let reparsed: AST | undefined;
  try {
    reparsed = AST.from(ast.language.id, ast.language.parse(text));
  } catch (e) {
    violations.push(`text does not parse: ${e}`);
  }
  if (reparsed) {
    const describe = (a: AST) =>
      a.rootNodes.map(
        (n) =>
          `${posStr(n.srcRange().from)}-${posStr(n.srcRange().to)} ${n.toString()}`
      );
    const expected = describe(reparsed);
    const actual = describe(ast);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      violations.push(
        `AST is out of sync with the text.\n  text parses to: ${JSON.stringify(
          expected
        )}\n  store AST:      ${JSON.stringify(actual)}`
      );
    }
  }

  // 1b. What is printed from the blocks reads back with the same comments: one
  //     that goes with no block is still a block of its own, and one that goes
  //     with a block still does. (Only the comments are compared: the blocks
  //     around them are checked above, against the text.)
  if (reparsed) {
    // (the spacing in a comment is not part of it)
    const words = (c: unknown) => String(c).trim().replace(/\s+/g, " ");
    // (which of two nested nodes that start at the same place a comment above
    // them goes with is not kept: the text of both is the same)
    const comments = (a: AST) => {
      const nodes = [...a.getAllNodes()];
      const orphans = nodes
        .filter((n) => n.options.orphan)
        .map((n) => `orphan ${words(n.fields.comment)}`);
      const attached = nodes
        .filter((n) => n.options.comment)
        .flatMap((n) => words(n.options.comment!.fields.comment).split(" "))
        .sort();
      return [...orphans, `on nodes: ${attached.join(" ")}`];
    };
    try {
      const again = AST.from(
        ast.language.id,
        ast.language.parse(ast.toString())
      );
      if (JSON.stringify(comments(again)) !== JSON.stringify(comments(ast))) {
        violations.push(
          `printing the blocks does not read back with the same comments.\n  printed: ${JSON.stringify(
            ast.toString()
          )}\n  blocks:  ${comments(ast)}\n  read:    ${comments(again)}`
        );
      }
    } catch (e) {
      violations.push(`the printed blocks do not parse: ${e}`);
    }
  }

  // 2. One block marker per root (plus one for an open quarantine), at the
  //    root's position.
  const markers = cmb.getCM().getAllMarks().filter(isBlockNodeMarker);
  const expectedMarkers = ast.rootNodes.length + (state.quarantine ? 1 : 0);
  if (markers.length !== expectedMarkers) {
    violations.push(
      `expected ${expectedMarkers} block markers, found ${markers.length}`
    );
  }
  for (const root of ast.rootNodes) {
    const { from, to } = root.srcRange();
    const found = markers.some((m) => {
      const range = m.find();
      return (
        range &&
        "from" in range &&
        posStr(range.from) === posStr(from) &&
        posStr(range.to) === posStr(to)
      );
    });
    if (!found) {
      violations.push(
        `no block marker at ${posStr(from)}-${posStr(to)} for root "${root.toString()}"`
      );
    }
  }

  // 3. The blocks on screen match the AST: every node that isn't hidden inside
  //    a collapsed ancestor is rendered, and nothing is rendered that isn't in
  //    the AST (collapsed nodes keep their children in the DOM, hidden by css).
  //    CodeMirror only draws the lines near the screen, so a root outside that
  //    window (which is only a few lines tall in jsdom) isn't expected to be.
  const viewport = cmb.getCM().getViewport();
  const isDrawn = (root: ASTNode) =>
    root.srcRange().from.line < viewport.to &&
    root.srcRange().to.line >= viewport.from;
  const collapsed = new Set(state.collapsedList);
  const visibleIds = new Set<string>();
  const knownIds = new Set<string>();
  const visit = (node: ASTNode, hidden: boolean) => {
    knownIds.add(node.id);
    if (!hidden) {
      visibleIds.add(node.id);
    }
    // A node being edited in place is shown as an editing box with only its own
    // text: its comment (still in the document) and its children are not drawn
    // until the edit ends (see Node.tsx, which swaps in NodeEditable).
    const beingEdited =
      document
        .getElementById(`block-node-${node.id}`)
        ?.getAttribute("contenteditable") === "true";
    const comment = node.options.comment;
    if (comment) {
      knownIds.add(comment.id);
      if (!hidden && !beingEdited) {
        visibleIds.add(comment.id);
      }
    }
    for (const child of node.children()) {
      visit(child, hidden || collapsed.has(node.id) || beingEdited);
    }
  };
  ast.rootNodes.forEach((r) => visit(r, !isDrawn(r)));
  const wrapper = cmb.getCM().getWrapperElement();
  const renderedIds = new Set(
    [...wrapper.querySelectorAll('[id^="block-node-"]')].map((el) =>
      el.id.replace("block-node-", "")
    )
  );
  for (const id of visibleIds) {
    if (!renderedIds.has(id)) {
      const node = ast.getNodeById(id);
      violations.push(
        `no block rendered for node ${id} (${node ? node.type : "comment"})`
      );
    }
  }
  for (const id of renderedIds) {
    if (!knownIds.has(id)) {
      violations.push(`stale block rendered for node ${id}: not in the AST`);
    }
  }

  // 3b. A node's registered element (what focus is sent to) is the block that
  //     is actually on the page, not a leftover from an earlier render. (While
  //     a node is being edited, the page shows the editing box instead.)
  for (const id of renderedIds) {
    const node = ast.getNodeById(id);
    const onPage = document.getElementById(`block-node-${id}`);
    if (
      node &&
      node.element !== onPage &&
      onPage?.getAttribute("contenteditable") !== "true"
    ) {
      violations.push(
        `${node.type} "${node.toString()}" is registered with a block that is not the one on the page`
      );
    }
  }

  // 4. Ids and nids are unique and consistent.
  const all = [...ast.rootNodes.flatMap((r) => [...r.descendants()])];
  const ids = new Set(all.map((n) => n.id));
  const nids = new Set(all.map((n) => n.nid));
  if (ids.size !== all.length) {
    violations.push("duplicate node ids in the AST");
  }
  if (nids.size !== all.length) {
    violations.push("duplicate node nids in the AST");
  }
  if (ast.nodeIdMap.size !== all.length) {
    violations.push(
      `nodeIdMap has ${ast.nodeIdMap.size} entries for ${all.length} nodes`
    );
  }

  // 5. Focus is on a node that exists, and not stranded on the placeholder.
  if (state.focusId && !ast.getNodeById(state.focusId)) {
    violations.push(`focused node ${state.focusId} is not in the AST`);
  }
  const focused = state.focusId ? ast.getNodeById(state.focusId) : undefined;
  // (A block that CodeMirror isn't drawing can't hold focus: the placeholder
  // keeps it until the block comes back.)
  if (
    document.activeElement?.id === "cmb-focus-placeholder" &&
    !(focused && !isDrawn(getRoot(ast, focused)))
  ) {
    const where = focused
      ? `the focused node is ${focused.type} "${focused.toString()}", ` +
        `${document.contains(focused.element) ? "in" : "not in"} the page` +
        `, ${document.getElementById(`block-node-${focused.id}`) ? "and" : "but no"} block with its id exists`
      : "no node is focused";
    violations.push(
      `keyboard focus is stranded on cmb-focus-placeholder (${where})`
    );
  }

  // 6. Selections only contain nodes that exist.
  for (const id of selectors.getSelectedNodeIds(state)) {
    if (!ast.getNodeById(id)) {
      violations.push(`selected node ${id} is not in the AST`);
    }
  }

  return violations;
}

/** Assert that every invariant holds for the mounted editor. */
export function expectInvariants() {
  expect(findInvariantViolations()).toEqual([]);
}

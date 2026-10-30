import { AST, ASTNode } from "../../src/ast";
import { isBlockNodeMarker } from "../../src/editor";
import * as selectors from "../../src/state/selectors";
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
  const collapsed = new Set(state.collapsedList);
  const visibleIds = new Set<string>();
  const knownIds = new Set<string>();
  const visit = (node: ASTNode, hidden: boolean) => {
    knownIds.add(node.id);
    if (!hidden) {
      visibleIds.add(node.id);
    }
    const comment = node.options.comment;
    if (comment) {
      knownIds.add(comment.id);
      if (!hidden) {
        visibleIds.add(comment.id);
      }
    }
    // A node being edited in place is shown as text, without its children.
    const beingEdited =
      document
        .getElementById(`block-node-${node.id}`)
        ?.getAttribute("contenteditable") === "true";
    for (const child of node.children()) {
      visit(child, hidden || collapsed.has(node.id) || beingEdited);
    }
  };
  ast.rootNodes.forEach((r) => visit(r, false));
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
  if (document.activeElement?.id === "SR_fix_for_slow_dom") {
    violations.push("keyboard focus is stranded on SR_fix_for_slow_dom");
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

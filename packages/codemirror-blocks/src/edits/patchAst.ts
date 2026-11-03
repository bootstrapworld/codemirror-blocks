import { ASTNode } from "../ast";

function copyAllIds(oldTree: ASTNode, newTree: ASTNode) {
  const oldIter = oldTree.descendants()[Symbol.iterator]();
  const newIter = newTree.descendants()[Symbol.iterator]();
  let oldPtr = oldIter.next();
  let newPtr = newIter.next();
  while (!oldPtr.done) {
    if (newPtr.done) {
      throw new Error(
        `expected newTree to have at least as many descendants as oldTree.`
      );
    }
    newPtr.value.id = oldPtr.value.id;
    oldPtr = oldIter.next();
    newPtr = newIter.next();
  }
}

export default function patchAst(oldTree: ASTNode[], newTree: ASTNode[]) {
  function children(node: ASTNode | ASTNode[]): ASTNode[] {
    if (node instanceof ASTNode) {
      return [...node.children()];
    }
    return node;
  }

  function loop(oldTree: ASTNode | ASTNode[], newTree: ASTNode | ASTNode[]) {
    if (newTree instanceof ASTNode && oldTree instanceof ASTNode) {
      newTree.id = oldTree.id;
    }
    const oldChildren = children(oldTree);
    const processed = new Set<string>();

    // A node that was moved rather than parsed again already has its old id and
    // is its own match. (Matching these first keeps another new node with the
    // same hash from being given the id they already have.)
    const oldById = new Map(oldChildren.map((n) => [n.id, n]));
    const unmatched = children(newTree).filter((newNode) => {
      const oldNode = oldById.get(newNode.id);
      if (oldNode && oldNode.hash === newNode.hash) {
        processed.add(oldNode.id);
        return false;
      }
      return true;
    });

    const index: { [key: string]: ASTNode[] } = {};
    for (const oldNode of oldChildren) {
      if (processed.has(oldNode.id)) continue;
      if (index[oldNode.hash]) {
        index[oldNode.hash].push(oldNode);
      } else {
        index[oldNode.hash] = [oldNode];
      }
    }

    let partiallySuccess = processed.size > 0;
    const newLeftover = unmatched.filter((newNode) => {
      if (index[newNode.hash]?.length > 0) {
        const oldNode = index[newNode.hash].shift();
        if (oldNode) {
          copyAllIds(oldNode, newNode);
          partiallySuccess = true;
          processed.add(oldNode.id);
          return false;
        }
      }
      return true;
    });
    const oldLeftover = oldChildren.filter((oldNode) => {
      return !processed.has(oldNode.id);
    });
    if (partiallySuccess || newLeftover.length <= 1) {
      const commonLength = Math.min(oldLeftover.length, newLeftover.length);
      for (let i = 0; i < commonLength; i++) {
        loop(oldLeftover[i], newLeftover[i]);
      }
    }
  }
  loop(oldTree, newTree);
  return newTree;
}

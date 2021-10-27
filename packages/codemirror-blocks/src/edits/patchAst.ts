import { ASTNode } from "../ast";

function copyAllIds(oldTree: ASTNode, newTree: ASTNode) {
  const oldIter = oldTree.descendants()[Symbol.iterator]();
  const newIter = newTree.descendants()[Symbol.iterator]();
  let oldPtr = oldIter.next();
  let newPtr = newIter.next();
  while (!oldPtr.done) {
    if (newPtr.done) {
      throw new Error(
        "copyAllIds failed. Expected newTree to have same number of descendants as old tree"
      );
    }
    newPtr.value.id = oldPtr.value.id;
    newPtr.value.element = oldPtr.value.element;
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

    // build up a mapping of node hashes to the nodes matching that hash
    const hashToNodeMap: { [key: number]: ASTNode[] } = {};
    for (const oldNode of children(oldTree)) {
      if (hashToNodeMap[oldNode.hash]) {
        hashToNodeMap[oldNode.hash].push(oldNode);
      } else {
        hashToNodeMap[oldNode.hash] = [oldNode];
      }
    }

    const processed = new Set();

    let partiallySuccess = false;
    const newLeftover = [];
    for (const newNode of children(newTree)) {
      if (hashToNodeMap[newNode.hash]?.length > 0) {
        const oldNode = hashToNodeMap[newNode.hash].shift();
        if (oldNode) {
          copyAllIds(oldNode, newNode);
          partiallySuccess = true;
          processed.add(oldNode.id);
        }
      } else {
        newLeftover.push(newNode);
      }
    }
    const oldLeftover = children(oldTree).filter((oldNode) => {
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

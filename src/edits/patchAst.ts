import type { AST, ASTNode } from '../ast';
import {assert} from '../utils';

// defaultdict with empty list
function addIndex<V>(container:Record<string|number, V[]>, k:string|number, v:V) {
  if (container[k]) {
    container[k].push(v);
  } else {
    container[k] = [v];
  }
}

function copyAllIds(oldTree: ASTNode, newTree: ASTNode) {
  const oldIter = oldTree.descendants()[Symbol.iterator]();
  const newIter = newTree.descendants()[Symbol.iterator]();
  let oldPtr = oldIter.next();
  let newPtr = newIter.next();
  while (!oldPtr.done) {
    assert(!newPtr.done);
    newPtr.value.id = oldPtr.value.id;
    newPtr.value.element = oldPtr.value.element;
    oldPtr = oldIter.next();
    newPtr = newIter.next();
  }
}

export default function unify(oldTree: AST, newTree: AST) {
  function loop(oldTree: ASTNode|AST, newTree: ASTNode|AST) {
    newTree.id = oldTree.id;
    const index:{[key:string]: ASTNode[]} = {};
    for (const oldNode of oldTree.children()) {
      addIndex(index, oldNode.hash, oldNode);
    }
    for (const key in index) {
      index[key].reverse();
    }

    const processed = new Set();

    let partiallySuccess = false;
    const newLeftover = [...newTree.children()].filter(newNode => {
      if (index[newNode.hash]?.length > 0) {
        const oldNode = index[newNode.hash].pop();
        copyAllIds(oldNode, newNode);
        partiallySuccess = true;
        processed.add(oldNode.id);
        return false;
      } else {
        return true;
      }
    });
    const oldLeftover = [...oldTree.children()].filter(oldNode => {
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
  newTree.annotateNodes();
  return newTree;
}

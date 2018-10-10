import {assert} from './utils';

// defaultdict with empty list
function addIndex(container, k, v) {
  if (container[k]) {
    container[k].push(v);
  } else {
    container[k] = [v];
  }
}

function copyAllIds(oldTree, newTree) {
  const oldIter = oldTree.descendants()[Symbol.iterator]();
  const newIter = newTree.descendants()[Symbol.iterator]();
  let oldPtr = oldIter.next();
  let newPtr = newIter.next();
  while (!oldPtr.done) {
    assert(!newPtr.done);
    // console.log(oldPtr.value, 'is copied over to ', newPtr.value);
    newPtr.value.id = oldPtr.value.id;
    oldPtr = oldIter.next();
    newPtr = newIter.next();
  }
}

function assignNewIds(n) {
  // console.log(n, ' is assigned a new id');
  // actually the new nodes have new IDs already. Do nothing
}

export default function unify(oldTree, newTree) {
  function loop(oldTree, newTree) {
    const index = {};
    for (const oldNode of oldTree.children()) {
      addIndex(index, oldNode.hash, oldNode);
    }
    for (const key in index) {
      index[key].reverse();
    }

    const processed = new Set();

    let partiallySuccess = false;
    const newLeftover = [...newTree.children()].filter(newNode => {
      if (index[newNode.hash] && index[newNode.hash].length > 0) {
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
    if (!partiallySuccess) {
      assignNewIds(newTree);
    } else {
      const commonLength = Math.min(oldLeftover.length, newLeftover.length);
      for (let i = 0; i < commonLength; i++) {
        loop(oldLeftover[i], newLeftover[i]);
      }
      for (let i = commonLength; i < newLeftover.length; i++) {
        assignNewIds(newLeftover[i]);
      }
    }
  }
  loop(oldTree, newTree);
  newTree.annotateNodes();
  return newTree;
}

import {poscmp, assert} from './utils';
import uuidv4 from 'uuid/v4';

function* getIteratorFromAST(ast) {
  for (const root of ast.rootNodes) {
    yield* root.descendants();
  }
}

function getContent(node, cm) {
  return cm.getRange(node.from, node.to);
}

function markDirty(node) {
  while (node && !node.dirty) {
    node.dirty = true;
    node.id = uuidv4();
    node = node.parent;
  }
}

function advancePtr(iter, node, dirty=false) {
  let ptr = null;
  for (const subnode of node.descendants()) {
    if (dirty) markDirty(subnode);
    ptr = iter.next();
  }
  return ptr;
}

/**
 * The function consumes an oldAST, newAST and changes from CodeMirror
 * and transfer existing ids in oldAST to newAST.
 *
 * The algorithm is inspired by the merge phase of mergesort.
 * We first create streams of oldAST and newAST's preorder traversal,
 * and a stream of changes in increasing order of srcloc.
 * This gives us three streams with three pointers pointing to the
 * current position on each stream.
 *
 * For each iteration, we will advance at least one of the pointers
 * forward.
 */
export default (oldAST, newAST, changes, cm) => {
  /*
   * By the well-formedness of changes, they won't overlap,
   * so sorting by starting or ending point will be the same.
   *
   * Don't forget that appending a new node at the end of the file
   * won't fall into these two cases since there are no nodes following
   * the added node. So we need to walk all changes and cleanup
   * the left element (which should have at most 1).
   *
   * NOTE: initially changes are not ordered by pos, but by
   * event sequence to result in a new text
   */

  const orderedChanges = [...changes];
  orderedChanges.sort((a, b) => poscmp(a.from, b.from));
  const oldIter = getIteratorFromAST(oldAST);
  const newIter = getIteratorFromAST(newAST);
  const changeIter = changes[Symbol.iterator]();

  let oldPtr = oldIter.next();
  let newPtr = newIter.next();
  let changePtr = changeIter.next();
  let buffer = '';

  while (!oldPtr.done && !newPtr.done) {

    /*
     * Suppose we replace 'x' with 'x   ', then '   ' will be left unmatched
     * so we need to trim it out. This is the only exception for whitespace.
     */
    buffer = buffer.trim();

    if (buffer !== '') {
      /*
       * CASE 0: The buffer is not empty, so there was an addition
       * to the new AST that we need to skip over
       */
      const newNodeString = getContent(newPtr.value, cm);

      // NOTE: here we use the property that text->blocks->text is the identity function
      // Otherwise, newNodeString might not appear exactly in the buffer.
      //
      // We could try to normalize whitespace if that's the only thing that makes
      // text->blocks->text failing
      const index = buffer.indexOf(newNodeString);
      if (index !== -1) {
        // if there's really an addition

        // advance the buffer
        buffer = buffer.substring(index + newNodeString.length);
        // advance the newPtr to skip over the addition
        newPtr = advancePtr(newIter, newPtr.value, true);
      } else {

        /*
         * Say we replace '(x >y<)' with '(x >z) (a b<)'
         * It can match the new node `z` perfectly.
         * However, it's hopeless to match the node `(a b)` against the new string
         * which is '(a b', so we let this node pass through, and let
         * `a` and `b` inside match instead.
         */
        newPtr = newIter.next();
      }
      continue;
      // here, we find that there's no addition after all
      // (or there was an addition, but it was out of scope already)
      // so now we will scan for more
    }

    if (!changePtr.done) {
      const {from: changeFrom, to: changeTo, text} = changePtr.value;
      const {from: oldFrom, to: oldTo} = oldPtr.value;

      if (poscmp(changeFrom, oldFrom) === 0 && poscmp(changeTo, oldTo) === 0) {
        /*
         * CASE 1: the node is completely replaced by something else
         *
         * For example:
         *
         * >x< y ==> y         | newNodeString = "y",   buff = ""
         * >x< y ==> abc y     | newNodeString = "abc", buff = "abc"
         * >x< y ==> abc def y | newNodeString = "abc", buff = "abc def"
         * >x< y ==> abc) (d y | newNodeString = "abc", buff = "abc) (d"
         *
         * If the resulting buffer is non-empty, then newPtr.value is an added node!
         */

        // skip over the entire node for oldPtr
        oldPtr = advancePtr(oldIter, oldPtr.value);
        changePtr = changeIter.next();

        // we now possibly have text. Let CASE 0 deal with it
        // in the next iteration
        buffer = text.join('\n');
        continue;
      }

      if (poscmp(changeFrom, oldFrom) <= 0) {
        /*
         * CASE 2: there was an addition right before oldPtr
         */
        assert(poscmp(changeFrom, changeTo) === 0);
        // TODO: this assertion might fail if it's possible to select
        // blankspace and replace them with a node. Don't forget to check!

        // NOTE: we don't skip over oldPtr, since we have an addition
        // before oldPtr

        changePtr = changeIter.next();

        // we now possibly have text. Let CASE 0 deal with it
        // in the next iteration
        buffer = text;
        continue;
      }
    }

    /*
     * CASE 3: matched
     */
    newPtr.value.id = oldPtr.value.id;
    newPtr = newIter.next();
    oldPtr = oldIter.next();
  }
  newAST.annotateNodes();
  return newAST;
};

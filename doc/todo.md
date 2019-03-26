This is an internal TODO list for the docs. It is not itself documentation.

## Language Mistake List

Errors that were made when adding Pyret as a language---these should all turn
into exceptions (e.g. on AST construction) or doc clarifications:

- Forgot to implement `ASTNode.hash`. FIXED by making automating hash
  computation.
- Missed a key in `ASTNode.key`. TODO: make this very clear in the docs, because
  we can't detect this error. (Or can we? Walk fields and look for ASTNodes?)
- Gave an `undefined` from and to srcloc. TODO: raise an exception on AST
  construction.
- Used `id` as a field name on an ASTNode, overriding super's `id` field. TODO:
  use an underscore for all these fields, to prevent accidental overriding?

TODO: How many of these can be fixed with types? Can we provide a typed
interface to `ASTNode` and such that prevents most of these errors?

# Things to do for the language-api branch, and for Pyret blocks in particular

- Fix the regression caused by
  [this commit](https://github.com/bootstrapworld/codemirror-blocks/commit/3ae12b9e93c83ec36473327e5d2a38cb19f7302d)
  (sorry!). The regression is that this test now fails:

        The CodeMirrorBlocks Class events, when dealing with node activation,
        cut/copy/paste should remove selected nodes on cut FAILED
- I (Justin) couldn't for the life of me figure out how to import
  Pyret JS files into CMB. Right now `src/languages/pyret/pyret-lang/`
  has a bunch of Pyret files (including BLerner's RNGL parser stuff)
  copy-pasted into the folder with their import statements modified by
  hand to match the kinds of import statements used in CMB. This is
  awful. If anyone can fix this, please do.
- Merge this branch in with `master`. I have already merged some
  chunks of it, partly in the `pretty-print` branch/PR. The remaining
  changes in this branch that have not been merged are:
    - Everything in the `src/languages/pyret` folder.
    - The Pyret example page, added by 
    [these](https://github.com/bootstrapworld/codemirror-blocks/commit/5a6759ef36672fa48c7dc3dc97beb042ef5eafd3)
    [two](https://github.com/bootstrapworld/codemirror-blocks/commit/c3758468aa380ae50e6ee08008540b86762eec53)
    commits.
    - A switch to different iterators over AST nodes. See
    [these](https://github.com/bootstrapworld/codemirror-blocks/commit/7ad0928d83b220d5503908262f69701ab636d5f2)
    [two](https://github.com/bootstrapworld/codemirror-blocks/commit/a9ff53757e8d29b9336e6d180724fe09814d40d2)
    commits.
    - The note about the srcloc invariant in `src/ast.js`.
    - The notes in `README.md` about screen readers.
- Add support for the kinds of blocks listed below, which is enough
  for Pyret blocks to be used in the Bootstrap data-science
  curriculum.
- Add support for blocks for the rest of Pyret.


## Kinds of Blocks to support (from Emmanuel)

Pyret used in Bootstrap Data Science:

- string, number, boolean and symbol literals
- table literals
- arithmetic and logical operators
- function application
- method application
- function blocks
- example blocks

Pyret that might be good to have available:

- if statements
- ask statements
- lists

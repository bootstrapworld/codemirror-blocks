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
- Document the API needed to add a language to CMB.
- Make a proper API for adding new blocks to a language.
- Document the proper API for adding new blocks to a language.
- Add support for the kinds of blocks listed below, which is enough
  for Pyret blocks to be used in the Bootstrap data-science
  curriculum.
- Add support for blocks for the rest of Pyret.
- Merge with the `reactify` branch that re-does the way that changes
  to the AST are processed and rendered (to use JS `react`).


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

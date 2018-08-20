# Introduction to Codemirror Blocks and the language-api Branch

These are notes for developers: specifically for Dorai, but also
potentially anyone else looking at this branch or CMB in general.

------


## Codemirror-Blocks

The CodeMirror-Blocks project is predicated on a very practical idea:

> A lot of existing online code editors are built on top of
> CodeMirror, or in the worst case could be migrated to use CodeMirror
> without too much trouble. CodeMirror-Blocks will implement the
> essential parts of CodeMirror's API: thus these existing editors
> could simply replace CodeMirror with CodeMirror-Blocks and get a
> (very basic) block editor for free.

Now of course a lot of what going into making good blocks is language
specific and can't be automatically derived, so if you want a block
editor that isn't awful you'll need to additionally specify a lot more
about how your blocks should look and behave. The API for doing so is
under development in the `language-api` branch.


CodeMirror-Blocks (hereafter CMB) has two advantages over most other
block editors:

1. It lets you switch between a block editor and a text editor, thus
   giving a migration path towards grownup textual editing.
2. It has good accessibility (e.g. for screen readers) built in.
3. It creates a separation between the way a block of code is described
   and the way it is written. This allows, for example, for code line public
   static void foo(x, y) { x + y} to be announced as "foo, a function
   definition of two inputs. Public, static, returns void". These
   descriptions can be customized for pedagogical purposes, perhaps using
   different amounts of detail or vocabulary so as to be age appropriate
   (or even announced aloud in Spanish, Tagolog, etc!). This reduces the
   cognitive load when learning a new language, by allowing the user to
   focus on the structure and meaning of a block of code without having
   to consider the syntax.

## Developer Notes

There's a slack channel, and you should join it! It's the channel
`codemirror-blocks` on [pyret.slack.com](https://pyret.slack.com).

Here is the
[codemirror-blocks repo](https://github.com/bootstrapworld/codemirror-blocks).
Follow the developer instructions in the readme to get set up.

To actually play with the editor, start it up and go to the WeScheme
example. That's the most complete one. There's a check box at the
bottom that lets you switch back and forth between blocks.

The implementation makes use of the following technologies:

- Karma for testing
- npm for... running stuff?
- webpack for managing dependencies

If you want to enable logging while running tests, there's an option
for that in the karma config file (search for "console").

Neither Emmanuel nor I deeply understand any of these technologies.
Can't speak for Oak.

The most important files are `src/ast.js` and `src/blocks.js`.


## The language-api Branch

My (Justin's) branch is called `language-api`. It's original purpose
was to provide a clean API for new languages to be added to the block
editor. It's now more specifically to add Pyret support, too.


## More Info

To learn more, ask Emmanuel on the slack channel. Or you can email me
(Justin) if its very `language-api` specific.


## The Architecture of CMB

Every CMB instance comes with a CM instance, even if you only every
use the block editor.

There are two representations of the program: the code-mirror buffer
(managed by CodeMirror), and an ast (as defined in ast.js). These two
representations must always be kept in sync. There's a bijection
between them made possible by the fact that the ast stores srcloc info
(as 'from' and 'to' fields). (Ok, it's not quite a bijection because
of whitespace, but it's pretty close.)

Any time an edit is made; whether in block mode or text mode; it is
translated into a text edit and sent to CM. CM then sends a
`changeEvent` to CMB, which updates the blocks to match, and
re-renders the blocks as necessary. In more detail:

1. Either a text edit is made directly in CM, or a block edit is made
   and translated into a text edit and sent to CM.
2. CM processes this change, and then sends a `changeEvent`
   notification to CMB.
3. CMB receives this event, re-parses the whole program, and updates
   the blocks. (Re-parsing the whole program sounds inefficient, and
   it is, but it's not generally possible to parse just part of a
   program.)
4. CMB re-renders the parts of the blocks that have changed.

When switching from text to blocks:

- The blocks are rendered. Not much magic here, AFAIK.

When switching from blocks to text:

- The blocks are pretty-printed. This is necessary because while
  block-editing, you may have constructed, e.g., a function that's 500
  characters long entirely on one line (because none of the individual
  edits you made had newlines in them; why would they?). The _blocks_
  will look fine because they render their own way, but the text would
  look awful. So we normalize the text by pretty-printing it. As a
  side-effect, if you switch from text to blocks to text, your text
  will be reformatted. (This isn't implemented yet. There's a pretty
  printer (src/pretty.js), but it's not used yet.)

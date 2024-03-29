# codemirror-blocks

A library for making functional languages editable using visual blocks inside of codemirror

## Usage

**CodeMirror-Blocks ("CMB") is not a block editor.** It's a _toolkit for building block editors_. In other words, it is _NOT_ intended to be used in your IDE. ;-)

CMB should instead be _included in language-specific modules_, so your Python editor would include a CMB-enabled Python module. CMB provides the blockification and a11y features, and the language module provides the parser and (optionally) the vocalization and appearance for each construct in the language. The language module is what you use in your IDE.

The following language modules are available now:

- https://github.com/bootstrapworld/wescheme-blocks
- https://github.com/bootstrapworld/pyret-blocks

If you happen to use one of those languages, you're good to go! Export the language module using the normal `npm run build` mechanism, then include it in your favorite CodeMirror-enabled project. You can now use the `CodeMirrorBlocks` constructor to replace an existing CodeMirror instance with blocks. In other words, you'd replace code that looks like this:

        // make a new CM instance inside the container elt, passing in CM ops
        this.editor = CodeMirror(container, {/* CodeMirror options  */}});

With code that looks like this:

        // make a new CMB instance inside the container elt, passing in CMB ops
        this.editor = CodeMirrorBlocks(container, {/* CodeMirrorBlocks options  */});

But if you're here, our guess is that you have a language in mind (Python, Rust, YourFavLang, etc.) and you want to allow people to hack in that language even if they need blocks, or rely on screenreaders. So how does one make a language module?

## Making your own language module

_NOTE: your IDE will need to load CodeMirror as an external dependency._ We assume it already does (otherwise, why would you be here?), so you'll need to provide it yourself.

### Create a new repository

Make a repo (e.g. - `YourFavLang-blocks`), and include CMB as a dependency:

        npm install --save codemirror-blocks

Then add folders for your parser (`src/languages/YourFavLang`) and test cases (`spec/languages/YourFavLang`).

### Provide a Parser

Write a parser for your language that produces an Abstract Syntax Tree composed of [CMB's node types](https://github.com/bootstrapworld/codemirror-blocks/blob/master/src/nodes.jsx).

CMB's AST nodes all have constructors that take arguments specifying (1) the `from` and `to` position of the node (in CodeMirror's `{line, ch}` format), (2) the fields that define the node, and (3) an `options` object.

The `options` object is used for a number of CMB-internal purposes, but there are two (language-dependant) fields that your parser will need to set. First, you'll want to set `options[aria-label]` to a short, descriptive string for how that node should be vocalized by a screenreader (e.g. - "v: a value definition"). Your parser will also be responsible for associating block- and line-comments with the node they describe. For example:

        if (node instanceof structures.defVar) {
           var name = parseNode(node.name);
           var expr = parseNode(node.expr);
           var cmnt = new Comment(cmntFrom, cmtTo, cmtText);
           return new VariableDefinition(
              from,
              to,
              name,
              expr,
              {'aria-label': node.name.val+': a value definition', 'comment' : comment}
           );
        }

#### _Defining your own AST Nodes_

You can also provide your own AST nodes, by extending the built-in `AST.ASTNode` class. [Here is one example](https://github.com/bootstrapworld/wescheme-blocks/blob/master/src/languages/wescheme/ast.js) of a language defining custom AST nodes.

Your subclassed Node _**must**_ contain:

1. `constructor` - Consumes the `from` and `to` locations, all required child fields, and an `options` object initialized to `{}`.
2. `spec` - A static field, which defines specifications for all fields of the node. These specifications are [documented here](https://github.com/bootstrapworld/codemirror-blocks/blob/master/src/nodeSpec.js). Note: failing to properly list all the fields of the node can leave the editor in an unstable state, and result in unspecified behavior.
3. `longDescription()` - a method that dynamically computes a detailed description of the node (optionally referring to its children, for example), and produces a string that will be read aloud to the user.
4. `pretty()` - A method that describes how the node should be pretty-printed. Pretty-printing options are [documented here](https://www.npmjs.com/package/pretty-fast-pretty-printer).
5. `render()` - A method that produces the node (usually in JSX) to be rendered. Note: all DropTargets in a node's `render()` method must declare a `field` property, corresponding to one of the fields of the node that are defined in `spec`. This tells CMB what part of the node is modified when the DropTarget is edited.

### Tell CMB about the Language

Create an index.js [see this example](https://github.com/bootstrapworld/wescheme-blocks/blob/master/src/languages/wescheme/index.js) file that hooks up your language to the CMB library.

### Style Your Blocks

CMB provides [default CSS styling](https://github.com/bootstrapworld/codemirror-blocks/blob/master/src/less/default-style.less) for all node types, but you can always add your own! Add a `style.less` file that overrides the built-in styles, providing your own "look and feel" using standard CSS.

Obviously, if you've added new AST node types, you'll have to provide the styling for those yourself!

### Write Your Tests

In `spec/languages/YourFavLang`, add some unit tests for your parser! Make sure you test all the fields, but _especially_ the `aria-label` and `longDescription()` return values.

You may find it useful to check out [this example](https://github.com/bootstrapworld/wescheme-blocks/blob/master/spec/languages/wescheme/WeschemeParser-test.js).

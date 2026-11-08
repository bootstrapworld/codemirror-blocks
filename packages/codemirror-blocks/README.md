# codemirror-blocks

A library for making functional languages editable using visual blocks inside of codemirror

## Usage

**CodeMirror-Blocks ("CMB") is not a block editor.** It's a _toolkit for building block editors_: the editor itself, with its accessibility and keyboard features, **and no languages**. A language (its parser, how its blocks look and what a screenreader says of them) is a module of its own, added to the editor. The ones in this repository are:

| language                                       | module                         |
| ---------------------------------------------- | ------------------------------ |
| WeScheme                                       | `@bootstrapworld/cmb-wescheme` |
| lambda (a small language of functions)         | `@bootstrapworld/cmb-lambda`   |
| Routine (plans: lets, shows, repeats, choices) | `@bootstrapworld/cmb-routine`  |
| example (numbers and calls: a place to start)  | `@bootstrapworld/cmb-example`  |

### With npm

```sh
npm install @bootstrapworld/codemirror-blocks @bootstrapworld/cmb-wescheme codemirror
```

```js
import CodeMirrorBlocks from "@bootstrapworld/codemirror-blocks";
import "@bootstrapworld/cmb-wescheme"; // adds the language to the editor
import "codemirror/lib/codemirror.css";
import "@bootstrapworld/codemirror-blocks/css/codemirror-blocks.css";
import "@bootstrapworld/cmb-wescheme/css/wescheme.css";

// replaces a CodeMirror with blocks: the language is asked for by its id
const editor = CodeMirrorBlocks(container, { value: "(+ 1 2)" }, "wescheme");
```

The stylesheets are plain CSS: no loader is needed in your bundler.

### With a script tag

No bundler: the editor is one file, and each language another, loaded after it (which adds the language to the editor). CodeMirror 5 is loaded by the page, as it is for any editor that uses it.

```html
<link rel="stylesheet" href="codemirror.css" />
<link rel="stylesheet" href="codemirror-blocks.css" />
<link rel="stylesheet" href="cmb-wescheme.css" />
<div id="editor"></div>
<script src="codemirror.js"></script>
<script src="codemirror-blocks-min.js"></script>
<script src="cmb-wescheme-min.js"></script>
<script>
  CodeMirrorBlocks(
    document.getElementById("editor"),
    { value: "(+ 1 2)" },
    "wescheme"
  );
</script>
```

The files are in the packages' `dist` folders (`npm run bundle` makes them, and they are on unpkg and jsDelivr). A page that uses no language has not shipped any: a language's file is only the language (WeScheme's is about 130 KB, the editor's about 400 KB).

## Making your own language module

_NOTE: your IDE will need to load CodeMirror as an external dependency._ We assume it already does (otherwise, why would you be here?), so you'll need to provide it yourself.

### Create a new package

A language is a package that has the editor as a peer dependency (`cmb-example` is the smallest one to start from: copy it):

        npm install --save-peer @bootstrapworld/codemirror-blocks

CMB requires Node 24 or later, React 19, and CodeMirror 5 (which your IDE provides). It ships its own TypeScript declarations, so your language module can be written in TypeScript. What a language may use is the editor's public API, which is what its root exports (and `/testing`, for your tests): the [language guide](../../doc/language.md) lists it, and says how to build your module's file for a script tag (`getLanguageBundleConfig` of `@bootstrapworld/cmb-toolkit`).

### Provide a Parser

Write a parser for your language that produces an array of top-level nodes, composed of [CMB's node types](https://github.com/bootstrapworld/codemirror-blocks/blob/master/packages/codemirror-blocks/src/nodes.tsx).

CMB's nodes are created with constructor functions that take arguments specifying (1) the `from` and `to` position of the node (in CodeMirror's `{line, ch}` format), (2) the fields that define the node, and (3) an `options` object.

The `options` object is used for a number of CMB-internal purposes, but there are two (language-dependent) fields that your parser will need to set. First, you'll want to set `options.ariaLabel` to a short, descriptive string for how that node should be vocalized by a screenreader (e.g. - "v: a value definition"). Your parser will also be responsible for associating block- and line-comments with the node they describe, using `options.comment`. For example:

```ts
if (node instanceof structures.defVar) {
  const name = parseNode(node.name);
  const expr = parseNode(node.expr);
  const comment = Nodes.Comment(cmntFrom, cmntTo, cmntText);
  return Nodes.VariableDefinition(
    from,
    to,
    { name, body: expr },
    {
      ariaLabel: node.name.val + ": a value definition",
      comment,
    }
  );
}
```

#### _Defining your own AST Nodes_

You can also define your own node types. A node type is described by a spec that lists the fields of the node, and a node is created by `makeNode`, which takes the functions that say how the node is pretty-printed, rendered as a block, and described to a screenreader. [Here is one example](https://github.com/bootstrapworld/codemirror-blocks/blob/master/packages/codemirror-blocks/src/languages/wescheme/ast.tsx) of a language defining custom nodes.

Every node type **must** have:

1. A spec, declared with `Nodes.createASTSpec`, which defines the type of every field of the node. These specifications are [documented here](https://github.com/bootstrapworld/codemirror-blocks/blob/master/packages/codemirror-blocks/src/nodeSpec.ts). Note: failing to properly list all the fields of the node can leave the editor in an unstable state, and result in unspecified behavior.
2. `pretty()` - A function that describes how the node should be pretty-printed. Pretty-printing options are [documented here](https://www.npmjs.com/package/pretty-fast-pretty-printer). A language that has a printer of its own can return the text instead of a doc.
3. `render()` - A function that produces the node (usually in JSX) to be rendered. Note: all DropTargets in a node's `render()` function must declare a `field` property, corresponding to one of the list fields of the node that are defined in the spec, and an `index`, the place in that list that a node dropped there goes (`Args` does both for you). This tells CMB what part of the node is modified when the DropTarget is edited.

and, optionally, `longDescription()` - a function that dynamically computes a detailed description of the node (optionally referring to its children, for example), and produces a string that will be read aloud to the user.

See the [language guide](../../doc/language.md) for a complete walkthrough.

### Tell CMB about the Language

Create an `index.ts` file ([see this example](https://github.com/bootstrapworld/codemirror-blocks/blob/master/packages/codemirror-blocks/src/languages/wescheme/index.ts)) that hooks up your language to the CMB library by calling `Languages.addLanguage({id, name, parse, ...})`.

### Style Your Blocks

CMB provides [default CSS styling](https://github.com/bootstrapworld/codemirror-blocks/blob/master/packages/codemirror-blocks/src/less/default-style.less) for all node types, but you can always add your own! Add a `style.less` file that overrides the built-in styles, providing your own "look and feel" using standard CSS. The editor's stylesheets are plain CSS (`lib/css/codemirror-blocks.css`, and `lib/css/languages/<id>.css` for each language that comes with it), so your bundler needs no loader for them: see [loading the stylesheets](../../doc/stylesheet.md#loading-the-stylesheets).

Obviously, if you've added new AST node types, you'll have to provide the styling for those yourself!

### Write Your Tests

In `spec/languages/YourFavLang`, add some unit tests for your parser! Make sure you test all the fields, but _especially_ the `ariaLabel` option and the `longDescription()` return values.

You may find it useful to check out [this example](https://github.com/bootstrapworld/codemirror-blocks/blob/master/packages/codemirror-blocks/spec/languages/wescheme-node-conversion-test.js).

# Language Guide

[TODO] This documentation was written early in the development of this
project. Before releasing it, check it all against the code, which may
have changed in the meantime.

This is a brief guide on how to add support for a new language in
CodeMirror-Blocks.

## Logistics

[FILL]

## Adding a Language

Here is an example of how to add a language to CodeMirror-Blocks:

    import WeschemeParser from './WeschemeParser';
    import CodeMirrorBlocks from '../../blocks';
    
    require('./style.less');
    
    export default CodeMirrorBlocks.languages.addLanguage(
      {
        id: 'wescheme',
        name: 'WeScheme',
        description: 'The WeScheme language',
        getParser() {
          return new WeschemeParser();
        },
        getRenderOptions() {
          return {
            lockNodesOfType: ['comment', 'structDefinition']
          };
        },
      });

The call to `addLanguage` takes the following arguments:

* `id` is a short alphanumeric identifier to be used internally.
  [TODO: how exactly is this used, e.g. might it show up in error messages?]
* `name` is a human-facing name for the language.
  [TODO: when is this actually shown?]
* `description` [TODO: should say where this is used, or remove it if it's not]
* `getParser()` is a function of no arguments that returns a parser
  for your language. This parser must have a function `parse(text:
  String) -> AST`, described in the next section.
* `getRenderOptions` Right now, the only render option is `lockNodesOfType`,
  which lists the names of nodes that should be "locked", and made opaque to
  novice users.

You can see that this file is also importing a
[`lesscss`](http://lesscss.org/) style file. Follow
[the stylesheet guide](stylesheet.html) to style your blocks with
`lesscss`.

## Defining the Parser

Your parser must have a `parse()` function. Its argument is the source code for
a program, represented as a string with newlines separates by `\n`.

The `parse()` function must produce an `AST` by calling `new AST(rootNodes)`,
where `rootNodes` is an array of top-level AST nodes. These nodes will be
specific to your language, and the rest of this guide describes how to define
them.

You'll see below that ASTNodes must be given a source location range (a `from`
and a `to`) when they are constructed. The source location ranges must obey
these rules:

1. The source location ranges must be well-formed: for each node, `node.from <=
   node.to`. (By `A <= B`, we mean that `A` comes before `B` in the document:
   either it's on an earlier line, or it's on the same line but to the left, or
   it's at exactly the same location.)
2. The source location range of a parent node must encompass the source location
   ranges of its children. (I.e., `parent.from <= child.from` and `child.to <=
   parent.to` for each child.)
3. The source location ranges of a node's children must be non-overlapping and
   in-order. (I.e., if `child1` comes before `child2` in the AST, then
   `child1.to <= child2.from`.)

## Defining Node Types

Let's see how to define a new node type, using the example of variable
definition nodes. As text, these nodes will look like this:

    (define motto "drag-and-drop editing for functional programming languages")

and as blocks, they'll look like this:

![A block rendering of that define statement.](motto.png)

We'll walk through the code to add this kind of node, piece by piece.

### Setup

Our new node type must extend `ASTNode`:

```js
import { ASTNode } from '../../ast';

class VariableDefinition extends ASTNode {
  ...
```

And we'll want a constructor:

```js
constructor(from, to, name, body, options={}) {
  super(from, to, 'variableDefinition', options);
  this.name = name;
  this.body = body;
}
```

Here's an explanation of what this constructor is doing:

- `from` and `to` are source location, giving the left and right boundaries of
  this node in the code. Both `from` and `to` have the form `{line:_, ch:_}`
  (this is the same convention as CodeMirror).
- `variableDefinition` is a name for this node type. This is a pretty private
  name. It won't get displayed/read to users, but it might show up in a console error
  message if something goes wrong.
- `options` - [TODO: describe available options, including aria-label].
- This constructor is expecting a variable `name` and a definition `body` as
  ASTNodes. In general, you can set whatever fields you want, as long as you
  declare them in the Spec, which is described next.

### Spec

All of the fields stored in an `ASTNode` must be declared under a static member
called `spec`:

[TODO: import line for `Spec`]

```js
import * as Spec from '../../nodeSpec';

...

  static spec = Spec.nodeSpec([
    Spec.required('name'),
    Spec.required('body')
  ])
```

There are four kinds of field specs:

- `Spec.required`: the field stores an `ASTNode`, and it must always be present.
- `Spec.optional`: the field stores either an `ASTNode`, or `null`.
- `Spec.list`: the field stores an array of `ASTNode`s.
- `Spec.value`: the field stores any other kind of value, that does not contain
  any `ASTNode`s.

Declaring all of a node's field types up front like this allows CodeMirrorBlocks
to automatically compute things like the hash of a node. It also allows the
block editor to behave intelligently: for example, if you delete a required
block it will be replaced by a "blank" block (shown as `?` by default), but if
you delete a block stored in a `Spec.list` field, that will remove the list
element.

Next, this new node type must now implement some methods.

### Speaking out Loud

The `longDescription(level)` method describes the node aloud for a
screen reader:

```js
longDescription(level) {
  let insert = ["literal", "blank"].includes(this.body.type) ? "" : "the result of:";
  return `define ${this.name} to be ${insert} ${this.body.describe(level)}`;
}
```

It should return a string describing the node.

Most of the time, the description should include descriptions of the node's
children. _Do not use `child.longDescription(level)` for this!_ If you do, and a
user asks a 1000-line function to describe itself, it will read the entire
function recursively, which is too much detail.

Instead, you should use `ASTNode.describe(level)`. This will automatically
use a shorter description for deeply nested nodes. (Specifically, it will use
`node.options["aria-label"]`.)

### Rendering as Text

Nodes need to know how to render themselves as text. Furthermore, the
_best_ way to render something as text depends on the width of the
screen (narrow screens should cause things to wrap more easily), so we
can't simply use a `toString()` method. Instead, nodes have a
`pretty()` method that returns a pretty-printing "`Doc`" that can
adapt itself intelligently to different screen widths.

This _particular_ node type is an s-expression, so it can just use the
pretty printing library's built-in support for displaying various
kinds of s-expressions:

```js
pretty() {
  return P.lambdaLikeSexpr("define", this.name, this.body);
}
```

To learn how to implement `pretty()` in general, see the documentation for the
[pretty printing library](https://github.com/brownplt/pretty-fast-pretty-printer).
You don't need to declare this module as a dependency: CodeMirrorBlocks provides
it to you under the import [FILL].


### Rendering as a Block

Finally, the node needs to know how to render itself as a block. This
is accomplished by a `render(props)` function that returns a React element:

```js
render(props) {
  const body = this.body.reactElement();
  const name = this.name.reactElement();
  return (
    <Node node={this} {...props}>
      <span className="blocks-operator">
        define
        {name}
      </span>
      <span className="blocks-args">
        {body}
      </span>
    </Node>
  );
}
```

Specifically, this is a
[React "Function Component"](https://reactjs.org/docs/components-and-props.html).
Read the React documentation for an overview of what Components are
and how you can define them.

Beyond that, here are some things you should know about defining
CodeMirror-Blocks components:

- This function was written using
  [JSX](https://reactjs.org/docs/introducing-jsx.html), which makes it
  easier to embed React elements in Javascript. This is what allows
  the HTML-like syntax like `<span> ... </span>`.
- All blocks should start with a `<Node>...</Node>` element. Make sure
  to pass it the `node` prop, as well as whatever props were passed into this
  node (using the special `{...props}` syntax).
- The `blocks-operator` span makes the black bar at the top of the
  block, and the `blocks-args` span makes the section at the bottom.
  For more options, see the [stylesheet guide](stylesheet.html).
- To render a child that is also an `ASTNode`, use `child.reactElement()`. This
  produces a React Element. If you wish to pass it any `props`, you may pass
  them in as a dictionary: `child.reactElement({prop: value})`.

#### Rendering DropTargets

If you've played around with the editor, you will have noticed "drop targets":
the small squares betweeen nodes that you can drag blocks onto, or edit to
insert a new child. When defining your blocks, you should include ample drop
targets to make them easy to edit. There are two ways to get these.

Most of the time, you should use `Args`. The syntax is `<Args
field="FIELDNAME">{elts}</Args>`, which will intersperse drop targets
horizontally among `elts` (which should be an array of elements). "FIELDNAME" is
the name of the field containing `elts`, which must be declared as type `Spec.list`.

However, if you want to put drop targets in a more interesting arrangement than
`Args` gives you, you have a second option: you can use `DropTarget`s directly.
Simply construct them with `<DropTarget field="FIELDNAME"/>` anywhere in your
node.

[TODO: eliminate DropTargetContainers]

-----

That's it! We've fully defined the `VariableDefinition` node type.

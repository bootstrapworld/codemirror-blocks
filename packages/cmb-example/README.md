# @bootstrapworld/cmb-example

The example language of CodeMirror-Blocks: numbers and calls, a start for a language of your own.

This is a language module for [CodeMirror-Blocks](https://github.com/bootstrapworld/codemirror-blocks):
the editor (`@bootstrapworld/codemirror-blocks`) comes with no languages, and
a language is added by loading its module.

## npm

```js
import CodeMirrorBlocks from "@bootstrapworld/codemirror-blocks";
import "@bootstrapworld/cmb-example"; // adds the language
import "codemirror/lib/codemirror.css";
import "@bootstrapworld/codemirror-blocks/css/codemirror-blocks.css";
import "@bootstrapworld/cmb-example/css/example.css";

CodeMirrorBlocks(
  document.getElementById("editor"),
  { value: "..." },
  "example"
);
```

The module adds its language when it is imported, and the editor is given it by
its id (`"example"`), or by the object the module exports.

## A script tag

```html
<link rel="stylesheet" href="codemirror-blocks.css" />
<link rel="stylesheet" href="cmb-example.css" />
<script src="codemirror-blocks.js"></script>
<script src="cmb-example.js"></script>
<script>
  CodeMirrorBlocks(
    document.getElementById("editor"),
    { value: "..." },
    "example"
  );
</script>
```

See the [language guide](../../doc/language.md) for how a language is made.

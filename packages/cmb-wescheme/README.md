# @bootstrapworld/cmb-wescheme

The WeScheme language (a Scheme for teaching) for CodeMirror-Blocks: its reader, its blocks and its primitives.

This is a language module for [CodeMirror-Blocks](https://github.com/bootstrapworld/codemirror-blocks):
the editor (`@bootstrapworld/codemirror-blocks`) comes with no languages, and
a language is added by loading its module.

## npm

```js
import CodeMirrorBlocks from "@bootstrapworld/codemirror-blocks";
import "@bootstrapworld/cmb-wescheme"; // adds the language
import "codemirror/lib/codemirror.css";
import "@bootstrapworld/codemirror-blocks/css/codemirror-blocks.css";
import "@bootstrapworld/cmb-wescheme/css/wescheme.css";

CodeMirrorBlocks(
  document.getElementById("editor"),
  { value: "..." },
  "wescheme"
);
```

The module adds its language when it is imported, and the editor is given it by
its id (`"wescheme"`), or by the object the module exports.

## A script tag

```html
<link rel="stylesheet" href="codemirror-blocks.css" />
<link rel="stylesheet" href="cmb-wescheme.css" />
<script src="codemirror-blocks.js"></script>
<script src="cmb-wescheme.js"></script>
<script>
  CodeMirrorBlocks(
    document.getElementById("editor"),
    { value: "..." },
    "wescheme"
  );
</script>
```

See the [language guide](../../doc/language.md) for how a language is made.

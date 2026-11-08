# @bootstrapworld/routine

Routine, a small language of plans (lets, shows, repeats, choices), to try the editor's API with CodeMirror-Blocks.

This is a language module for [CodeMirror-Blocks](https://github.com/bootstrapworld/codemirror-blocks):
the editor (`@bootstrapworld/codemirror-blocks`) comes with no languages, and
a language is added by loading its module.

## npm

```js
import CodeMirrorBlocks from "@bootstrapworld/codemirror-blocks";
import "@bootstrapworld/routine"; // adds the language
import "codemirror/lib/codemirror.css";
import "@bootstrapworld/codemirror-blocks/css/codemirror-blocks.css";
import "@bootstrapworld/routine/css/routine.css";

CodeMirrorBlocks(
  document.getElementById("editor"),
  { value: "..." },
  "routine"
);
```

The module adds its language when it is imported, and the editor is given it by
its id (`"routine"`), or by the object the module exports.

## A script tag

```html
<link rel="stylesheet" href="codemirror-blocks.css" />
<link rel="stylesheet" href="routine.css" />
<script src="codemirror-blocks.js"></script>
<script src="routine.js"></script>
<script>
  CodeMirrorBlocks(
    document.getElementById("editor"),
    { value: "..." },
    "routine"
  );
</script>
```

See the [language guide](../../doc/language.md) for how a language is made.

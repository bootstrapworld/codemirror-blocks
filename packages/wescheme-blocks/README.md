# wescheme-blocks

The build of the editor and the WeScheme language for wescheme.org, in one
file (`dist/WeschemeBlocks.js`, which puts `WeschemeBlocks` on the page), and a
dev page to try it. It is private: it is not published to npm.

The language itself (its reader, its blocks, its styles, its primitives and its
tests) is in [`packages/wescheme`](../wescheme/), so there is one copy to fix and
test. This package only adds what wescheme.org needs around it: `src/wescheme.org.js`
(the entry: it hands the editor the language, and sends crash logs to the
error form).

On wescheme.org, `WeschemeBlocks(container, options)` is used where
`CodeMirror(container, options)` was. CodeMirror itself is loaded by the page.

## Development

Set up as the [repository README](../../README.md#dev-environment) says, then,
from this directory:

    npm start       # the dev page, at http://localhost:8080/
    npm run build   # dist/, as the wescheme.org workflow does

The tests are run from the repository root with `npm test`.

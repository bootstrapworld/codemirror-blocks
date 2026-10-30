# wescheme-blocks

A screenreader-accessible, hybrid block and text editor for a subset of the [Racket programming language](https://www.racket-lang.org), which is used on [WeScheme.org](https://www.WeScheme.org/).

## Usage

Export the wescheme-blocks module using the normal `npm run build` mechanism, then include it in your favorite Racket-using, CodeMirror-enabled project. You can now use the new `CodeMirrorBlocks` constructor to replace an existing CodeMirror instance with blocks. In other words, you'd replace code that looks like this:

    // make a new CM instance inside the container elt, passing in CM ops
    this.editor = CodeMirror(container, {/* CodeMirror options  */}});

With code that looks like this:

    // make a new CMB instance inside the container elt, passing in CMB ops
    this.editor = CodeMirrorBlocks(container, {/* CodeMirrorBlocks options  */});

NOTE: your IDE will need to load CodeMirror as an external dependency. We assume it already does (otherwise, why would you be here?), so you'll need to provide it yourself.

## Development

This package lives in the [codemirror-blocks repository](https://github.com/bootstrapworld/codemirror-blocks), alongside the core library. To get your dev environment up and running, follow the instructions in the [repository README](../../README.md#dev-environment) (you will need Node 22.15 or later), then:

1.  start the webpack development server, from this directory:

        npm start

2.  browse to http://localhost:8080/ and fire away!

3.  while you work, be sure to run the unit tests (early and often!), from the repository root, with:

        npm test

Language-specific code is in the **src/** directory. The files there include:

- `ast.tsx` - a TypeScript file describing the AST nodes for this language, over-and-above the builtin nodes that the CMB library includes natively. If you are _adding support for language features_ or _changing the way existing nodes render_, this is where you'll do most of your work. You'll need some TypeScript and minimal JSX/React chops to work here.
- `index.ts` - the interface where the language mode declares itself to the CMB library. It's unlikely you will edit anything here (except _maybe_ some of the strings).
- `WeschemeParser.js` and `parseNode.ts` - these files contain the code that takes an AST produced by the WeScheme parser and converts it to a CMB AST. **Pay special attention to the `ariaLabel` options**! These strings are what the screenreader will announce to describe an AST node.
- `style.less` - this is where the CSS rules are declared, for styling the rendered AST nodes. If you know CSS, learning [LESS](http://lesscss.org/features/) is pretty easy and downright fun!

4.  you can generate local coverage reports in the **.coverage/** folder, from the repository root, by running:

        npm test -- --coverage

5.  you can generate a static, minified ball of JS and CSS in the **dist/** folder by running:

        npm run build

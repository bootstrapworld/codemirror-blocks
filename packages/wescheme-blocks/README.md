[![dependencies Status](https://david-dm.org/bootstrapworld/codemirror-blocks/status.svg)](https://david-dm.org/bootstrapworld/wescheme-blocks)
[![devDependencies Status](https://david-dm.org/bootstrapworld/codemirror-blocks/dev-status.svg)](https://david-dm.org/bootstrapworld/wescheme-blocks?type=dev)
[![Code Climate](https://codeclimate.com/github/bootstrapworld/codemirror-blocks/badges/gpa.svg)](https://codeclimate.com/github/bootstrapworld/wescheme-blocks)

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

To get your dev environment up and running, follow these steps. Note that to run tests,
you will need either Chrome or Chromium and point the variable `CHROME_BIN` to the binary
like this:

```
export CHROME_BIN=/usr/bin/chromium
```

You must enter the following command in every session before you run the test.
Alternatively, you can put it in your `.{bash,zsh}rc`, which will run them automatically.

1. Checkout the repository in your favorite manner

2. install dependencies with `npm`

        npm install

3. start the webpack development server:

        npm start

4. browse to http://localhost:8080/editor.html and fire away!

5. while you work, be sure to run the unit tests (early and often!) with:

        npm run test

Language-specific code is in the **src/languages/wescheme/** directory. The files there include:
- `ast.tsx` - a TypeScript file describing the AST nodes for this language, over-and-above the builtin nodes that the CMB library includes natively. If you are *adding support for language features* or *changing the way existing nodes render*, this is where you'll do most of your work. You'll need some JS and minimal JSX/React chops to work here.
- `index.js` - the interface where the language mode declares itself to the CMB library. It's unlikely you will edit anything here (except *maybe* some of the strings).
- `Parser.js` - this file contains that code that takes an AST produced by your language's native parser and converts it to a CMB AST. **Pay special attention to the `aria-label` fields**! These strings are what the screenreader will announce to describe an AST node.
- `style.less` - this is where the CSS rules are declared, for styling the rendered AST nodes. If you know CSS, learning [LESS](http://lesscss.org/features/) is pretty easy and downright fun!

6. you can generate local coverage reports in the **.coverage/** folder by running:

        COVERAGE=true npm test

7. you can generate a static, minified ball of JS and CSS in the **dist/** folder by running:

        npm run build

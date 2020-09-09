
[![dependencies Status](https://david-dm.org/bootstrapworld/codemirror-blocks/status.svg)](https://david-dm.org/bootstrapworld/codemirror-blocks)
[![devDependencies Status](https://david-dm.org/bootstrapworld/codemirror-blocks/dev-status.svg)](https://david-dm.org/bootstrapworld/codemirror-blocks?type=dev)
[![Build Status](https://travis-ci.org/bootstrapworld/codemirror-blocks.svg?branch=master)](https://travis-ci.org/bootstrapworld/codemirror-blocks)
[![Coverage Status](https://coveralls.io/repos/bootstrapworld/codemirror-blocks/badge.svg?branch=master&service=github)](https://coveralls.io/github/bootstrapworld/codemirror-blocks?branch=master)
[![Code Climate](https://codeclimate.com/github/bootstrapworld/codemirror-blocks/badges/gpa.svg)](https://codeclimate.com/github/bootstrapworld/codemirror-blocks)

# codemirror-blocks
A library for making functional languages editable using visual blocks inside of codemirror

## Usage
CodeMirror-Blocks ("CMB") is not a block editor. It's a _toolkit for building block editors_. In other words, it is *NOT* intended to be used in your IDE. ;-) 

CMB intended to be _included in language-specific modules_. CMB provides the blockification and a11y features, and the language module provides the parser and (optionally) the vocalization and appearance for each construct in the language.

The following language modules are available now:
- https://github.com/bootstrapworld/wescheme-blocks
- https://github.com/bootstrapworld/pyret-blocks

If you happen to use one of those languages, you're good to go! Export the language module using the normal `npm run build` mechanism, then include it in your favorite CodeMirror-enabled project. You can now use the `new CodeMirrorBlocks` constructor to replace an existing CodeMirror instance with blocks. In other words, you'd replace code that looks like this:

        // make a new CM instance inside the container elt, passing in CM ops
        this.editor = CodeMirror(container, {/* CodeMirror options  */}});

With code that looks like this:

        // make a new CMB instance inside the container elt, passing in CMB ops
        this.editor = CodeMirrorBlocks(container, {/* CodeMirrorBlocks options  */});

But if you're here, our guess is that you have a language in mind (Python, Rust, YourFavLang, etc.) and you want to allow people to hack in that language even if they need blocks, or rely on screenreaders. So...

## Making your own language module

### Create a new repository
Make a repo  (e.g. - `YourFavLang-blocks`), and include CMB as a dependency:

        npm install --save codemirror-blocks
        
Then add folders for your parser (`src/languages/YourFavLang`) and test cases (`spec/languages/YourFavLang`).

### Provide a Parser
Write a parser for your language that produces an Abstract Syntax Tree composed of [CMB's node types](https://github.com/bootstrapworld/codemirror-blocks/blob/master/src/nodes.jsx).

CMB's AST nodes all have constructors that take arguments specifying the `from` and `to` position of the node (in CodeMirror's `{line, ch}` format), the fields that define the node, and an `options` object.

The `options` object is used for a number of CMB-internal purposes, but there are two (which are entirely language-dependant) that your parser will need to set. First, you'll want to provide a string for `options[aria-label]`, which contains a short, descriptive string for how that node should be vocalized by a screenreader. Your parser will also be responsible for associating block- and line-comments with the node they describe. For example:

        var cmnt = new Comment(cmntFrom, cmtTo, cmtText);
        return new IfExpression(
            from, to, predicate, consequence, alternative,
            {'aria-label': "if-then-else expression, 'comment': cmnt});

#### _Defining your own AST Nodes_
You can also provide your own AST nodes, by extending the built-in `AST.ASTNode` class. [Here is one example](https://github.com/bootstrapworld/wescheme-blocks/blob/master/src/languages/wescheme/ast.js) of a language defining custom AST nodes. 

Your subclassed Node must contain:
1.  `constructor` -  consumes the `from` and `to` locations, all required child fields, and an `options` object initialized to `{}`. 
2. `spec` - a static field, which defines specifications for all fields of the node. These specifications are [documented here](https://github.com/bootstrapworld/codemirror-blocks/blob/master/src/nodeSpec.js.)
3. `longDescription()` - a method that dynamically computes a detailed description of the node (optionally referring to its children, for example), and produces a string that will be read aloud to the user.
4. `pretty()` - a method that describes how the node should be pretty-printed. Pretty-printing options are [documented here](https://www.npmjs.com/package/pretty-fast-pretty-printer).
5. `render()` - a method that produces the node (usually in JSX) that will be rendered by React.

### Tell CMB about the Language
Create an index.js [see this example](https://github.com/bootstrapworld/wescheme-blocks/blob/master/src/languages/wescheme/index.js) file that hooks up your language to the CMB library.

### Style Your Blocks
CMB provides [default CSS styling](https://github.com/bootstrapworld/codemirror-blocks/blob/master/src/less/default-style.less) for all node types, but you can always add your own! Add a `style.less` file that overrides the built-in styles, providing your own "look and feel" using standard CSS.

Obviously, if you've added new AST node types, you'll have to provide the styling yourself!

### Write Your Tests

In `spec/languages/YourFavLang`, add some unit tests for your parser! You may find it useful to check out [this example](https://github.com/bootstrapworld/wescheme-blocks/blob/master/spec/languages/wescheme/WeschemeParser-test.js).

## Hacking on CMB Itself

To get your dev environment up and running, follow these steps. Note that to run tests, you will need either Chrome or Chromium and point the variable `CHROME_BIN` to the binary
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

4. browse to http://localhost:8080/ and fire away!

5. while you work, be sure to continuously run the unit tests with:

        npm run test-watch

Library code is in the **src/** directory. An example of how it should be used
is in the **example/** directory.

6. you can generate local coverage reports in the **.coverage/** folder by running:

        COVERAGE=true npm test

7. you can generate a static, minified ball of JS and CSS in the **dist/** folder by running:

        npm run build

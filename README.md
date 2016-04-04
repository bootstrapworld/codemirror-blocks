[![Gitter](https://badges.gitter.im/bootstrapworld/codemirror-blocks.svg)](https://gitter.im/bootstrapworld/codemirror-blocks?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)
[![Build Status](https://travis-ci.org/bootstrapworld/codemirror-blocks.svg?branch=master)](https://travis-ci.org/bootstrapworld/codemirror-blocks)
[![Coverage Status](https://coveralls.io/repos/bootstrapworld/codemirror-blocks/badge.svg?branch=master&service=github)](https://coveralls.io/github/bootstrapworld/codemirror-blocks?branch=master)
[![Code Climate](https://codeclimate.com/github/bootstrapworld/codemirror-blocks/badges/gpa.svg)](https://codeclimate.com/github/bootstrapworld/codemirror-blocks)

# codemirror-blocks
A library for making functional languages editable using visual blocks inside of codemirror

## Usage

1. Install this library with npm:

        npm install --save codemirror-blocks

2. Install the peer dependencies:

        npm install --save babel-polyfill codemirror

3. Make sure `babel-polyfill` is required at the top of your entry point:

        require('babel-polyfill')

4. Hook it up:

        import CodeMirror from 'CodeMirror'
        import CodeMirrorBlocks from 'codemirror-blocks'
        import MyParser from './MyParser.js' //See example/parser.js for an example

        // feel free to include the example css, or roll your own!
        require('codemirror-blocks/example/example.css')

        let cm = CodeMirror.fromTextArea(document.getElementById('mytextarea'))
        let blocks = new CodeMirrorBlocks(cm, new MyParser())
        blocks.setBlockMode(true)

## Development

To get your dev environment up and running, follow these steps

1. Checkout the repository in your favorite manner

2. install dependencies with npm

        npm install

3. start the webpack development server:

        npm start

4. browse to http://localhost:8080/ and fire away!

5. while you work, be sure to continuously run the unit tests with:

        npm run test-watch

Library code is in the **src/** directory. An example of how it should be used
is in the **example/** directory.

6. documentation can be generated from the source code by running:

        npm run docs

7. you can generate local coverage reports in the .coverage/ folder by running:

        COVERAGE=true npm test

8. you can generate a static, minified ball of JS and CSS in the dist/ folder by running:

        npm run build

## Updating demo on project site

To update the demo on the project site with the latest version of the example in
this repository, just run:

    ./deploy-example.sh

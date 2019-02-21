var _ = require('lodash');
var path = require('path');
var webpack = require('webpack');
var baseConfig = require('./base.config.js');

// this is the config for a single js file that can be included with a script tag
var configs = [
  _.extend({}, baseConfig(), {
    entry: {
      "CodeMirrorBlocks": ['./src/languages/wescheme/index.js', './src/CodeMirrorBlocks.js']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: ["CodeMirrorBlocks"]
    },
    externals: {
      'codemirror': 'CodeMirror',
    }
  })
];

/*configs.push(
  _.extend({}, baseConfig(), {
    entry: {
      "CodeMirrorBlocks-pyret": ['./src/languages/pyret/index.js', './src/CodeMirrorBlocks.js']
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].js",
      library: ["CodeMirrorBlocks"]
    },
    externals: {
      'codemirror': 'CodeMirror',
    }
  })
);*/

configs = configs.concat(
  configs.map(function(config) {
    return _.merge({}, config, {
      output: {
        filename: "[name]-min.js"
      }
    });
  })
);

configs.push(
  _.extend({}, baseConfig({extractCSS:true}), {
    entry: {
      "blocks": './src/less/blocks.less'
    },
    output: {
      path: path.resolve(__dirname, '..', "dist"),
      filename: "[name].css"
    },
  })
);
module.exports = configs;
